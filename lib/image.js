var fs = require( 'fs' )
var plist = require( 'plist' )
var UDIF = require( './udif' )

/**
 * Apple Disk Image (DMG)
 * @constructor
 * @return {Image}
 */
function Image( path, options ) {

  if( !(this instanceof Image) )
    return new Image( path, options )

  options = options || {}

  this.path = path
  this.fd = null
  this.footer = null
  this.resourceFork = {}
  this.fs = options.fs || fs

  Object.defineProperty( this, 'fs', {
    enumerable: false
  })

}

Image.parseBlkx = function( blkx ) {

  var block = null
  var resources = []

  for( var i = 0; i < blkx.length; i++ ) {
    block = blkx[i]
    resources.push({
      id: +block['ID'],
      attributes: +block['Attributes'],
      name: block['Name'],
      coreFoundationName: block['CFName'],
      map: UDIF.BlockMap.parse( block['Data'] )
    })
  }

  return resources

}

Image.parseNsiz = function( nsiz ) {

  var block = null
  var resources = []

  for( var i = 0; i < nsiz.length; i++ ) {
    block = nsiz[i]
    resources.push({
      id: +block['ID'],
      attributes: +block['Attributes'],
      name: block['Name'],
      data: plist.parse( block['Data'].toString() ),
    })
  }

  return resources

}

Image.parsePlst = function( plst ) {

  var block = null
  var resources = []

  for( var i = 0; i < plst.length; i++ ) {
    block = plst[i]
    resources.push({
      id: +block['ID'],
      attributes: +block['Attributes'],
      name: block['Name'],
      data: block['Data'],
    })
  }

  return resources

}

Image.parseCsum = function( plst ) {

  var block = null
  var resources = []

  for( var i = 0; i < plst.length; i++ ) {
    block = plst[i]
    resources.push({
      id: +block['ID'],
      attributes: +block['Attributes'],
      name: block['Name'],
      data: {
        unknown: block['Data'].readUInt16LE( 0 ),
        type: block['Data'].readUInt32LE( 2 ),
        value: block['Data'].toString( 'hex', 6 ),
      },
    })
  }

  return resources

}

Image.parseSize = function( size ) {

  var block = null
  var resources = []

  for( var i = 0; i < size.length; i++ ) {
    block = size[i]
    resources.push({
      id: +block['ID'],
      attributes: +block['Attributes'],
      name: block['Name'],
      data: block['Data'],
    })
  }

  return resources

}

/**
 * Image prototype
 * @type {Object}
 * @ignore
 */
Image.prototype = {

  constructor: Image,

  /**
   * Create a readable stream of this image
   * @param {Object} [options]
   * @returns {UDIF.ReadStream}
   */
  createReadStream( options ) {
    return new UDIF.ReadStream( this, options )
  },

  /**
   * Create a sparse readable stream of this image
   * @param {Object} [options]
   * @returns {UDIF.SparseReadStream}
   */
  createSparseReadStream( options ) {
    return new UDIF.SparseReadStream( this, options )
  },

  /**
   * Calculate the uncompressed size of the contained resource
   * @return {Number} size in bytes
   */
  getUncompressedSize() {
    if( !this.resourceFork.blkx ) return 0
    return this.resourceFork.blkx.reduce(( size, resource ) => {
      return resource.map.blocks.reduce(( size, block ) => {
        return size + ( block.sectorCount * UDIF.SECTOR_SIZE )
      }, size )
    }, 0 )
  },

  readFooter: function( callback ) {

    var length = UDIF.Footer.size
    var buffer = Buffer.allocUnsafe( length )

    this.fs.fstat( this.fd, ( error, stats ) => {

      if( error ) {
        return callback.call( this, error )
      }

      var position = stats.size - UDIF.Footer.size

      this.fs.read( this.fd, buffer, 0, length, position, ( error, bytesRead, buffer ) => {
        if( error ) {
          return callback.call( this, error )
        }

        if( bytesRead !== length ) {
          error = new Error( `Bytes read mismatch, expected ${length}, got ${bytesRead}` )
          return void callback.call( this, error )
        }

        try {
          this.footer = UDIF.Footer.parse( buffer )
        } catch( error ) {
          return callback.call( this, error )
        }

        callback.call( this, null, this.footer )

      })
    })

  },

  readPropertyList: function( callback ) {

    if( this.footer == null ) {
      return callback.call( this, new Error( 'Must read footer before property list' ) )
    }

    var length = this.footer.xmlLength
    var position = this.footer.xmlOffset
    var buffer = Buffer.allocUnsafe( length )

    this.fs.read( this.fd, buffer, 0, length, position, ( error, bytesRead, buffer ) => {

      if( error ) {
        return void callback.call( this, error )
      }

      if( bytesRead !== length ) {
        error = new Error( `Bytes read mismatch, expected ${length}, got ${bytesRead}` )
        return void callback.call( this, error )
      }

      var data = null

      try {
        data = plist.parse( buffer.toString() )
      } catch( error ) {
        return void callback.call( this, error )
      }

      this.resourceFork = data['resource-fork']

      try {
        if( this.resourceFork.blkx )
          this.resourceFork.blkx = Image.parseBlkx( this.resourceFork.blkx )
        if( this.resourceFork.nsiz )
          this.resourceFork.nsiz = Image.parseNsiz( this.resourceFork.nsiz )
        if( this.resourceFork.cSum )
          this.resourceFork.cSum = Image.parseCsum( this.resourceFork.cSum )
        if( this.resourceFork.plst )
          this.resourceFork.plst = Image.parsePlst( this.resourceFork.plst )
        if( this.resourceFork.size )
          this.resourceFork.size = Image.parseSize( this.resourceFork.size )
      } catch( error ) {
        return void callback.call( this, error )
      }

      callback.call( this, null, this.resourceFork )

    })

  },

  open: function( callback ) {

    if( this.fd != null ) {
      return callback.call( this, null, this.fd )
    }

    var tasks = [
      ( next ) => {
        this.fs.open( this.path, 'r', ( error, fd ) => {
          this.fd = fd
          next( error )
        })
      },
      ( next ) => this.readFooter( next ),
      ( next ) => this.readPropertyList( next ),
    ]

    var run = ( error ) => {
      if( error ) return callback.call( this, error )
      var task = tasks.shift()
      task ? task( run ) : callback.call( this )
    }

    run()

    return this

  },

  close: function( callback ) {

    if( this.fd == null ) {
      return callback.call( this )
    }

    var self = this

    this.fs.close( this.fd, function( error ) {
      callback.call( self, error )
    })

    this.fd = null

    return this

  },

}

// Exports
module.exports = Image
