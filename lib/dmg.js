var fs = require( 'fs' )
var plist = require( 'plist' )
var UDIF = require( './udif' )

/**
 * Apple Disk Image (DMG)
 * @constructor
 * @return {DMG}
 */
function DMG( path ) {

  if( !(this instanceof DMG) )
    return new DMG( path )

  this.path = path
  this.fd = null
  this.footer = null
  this.resources = []

}

DMG.parseResourceMap = function( resourceFork ) {

  var blocks = resourceFork['blkx']
  var block = null

  // NOTE: What to do with `resourceFork['plst']`!?

  var resources = []

  for( var i = 0; i < blocks.length; i++ ) {
    block = blocks[i]
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

/**
 * DMG prototype
 * @type {Object}
 * @ignore
 */
DMG.prototype = {

  constructor: DMG,

  /**
   * Create a readable stream of this image
   * @param {Object} [options]
   * @returns {UDIF.ReadStream}
   */
  createReadStream( options ) {
    return new UDIF.ReadStream( this, options )
  },

  readFooter: function( callback ) {

    var self = this
    var length = UDIF.Footer.size
    var buffer = new Buffer( length )

    buffer.fill(0)

    fs.fstat( self.fd, function( error, stats ) {
      if( error ) return callback.call( self, error )
      var position = stats.size - UDIF.Footer.size
      fs.read( self.fd, buffer, 0, length, position, function( error, bytesRead, buffer ) {
        if( error ) return callback.call( self, error )
        self.footer = UDIF.Footer.parse( buffer )
        callback.call( self, null, self.footer )
      })
    })

  },

  readPropertyList: function( callback ) {

    if( this.footer == null )
      return callback.call( this, new Error( 'Must read footer first' ) )

    var self = this
    var length = this.footer.xmlLength
    var position = this.footer.xmlOffset
    var buffer = new Buffer( length )

    fs.read( self.fd, buffer, 0, length, position, function( error, bytesRead, buffer ) {
      if( error ) return callback.call( self, error )
      var data = plist.parse( buffer.toString() )
      self.resources = DMG.parseResourceMap( data['resource-fork'] )
      callback.call( self, null, self.resources )
    })

  },

  open: function( callback ) {

    if( this.fd != null ) {
      return callback.call( this, null, this.fd )
    }

    var tasks = [
      ( next ) => {
        fs.open( this.path, 'r', ( error, fd ) => {
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

    fs.close( this.fd, function( error ) {
      callback.call( self, error )
    })

    return this

  },

}

// Exports
module.exports = DMG
