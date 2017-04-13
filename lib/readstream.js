var fs = require( 'fs' )
var Stream = require( 'stream' )
var zlib = require( 'zlib' )
var bunzip = require( 'seek-bzip' )
var adc = require( 'apple-data-compression' )
var inherit = require( 'bloodline' )
var crc32 = require( 'cyclic-32' )
var UDIF = require( './udif' )

/**
 * UDIF Image ReadStream
 * @constructor
 * @memberOf UDIF
 * @param {UDIF.Image|String} image
 * @param {Object} [options]
 * @param {Boolean} [options.verify=true]
 * @returns {ReadStream}
 */
function ReadStream( image, options ) {

  if( !(this instanceof ReadStream) ) {
    return new ReadStream( image, options )
  }

  Stream.Readable.call( this, options )

  /** @type {Number} Bytes read */
  this.bytesRead = 0
  /** @type {Number} Bytes written */
  this.bytesWritten = 0

  this.opened = false
  this.closed = false
  /** @type {Boolean} Whether the stream has been destroyed */
  this.destroyed = false

  /** @type {Boolean} Whether to verify checksums */
  this.verify = options.verify == null ?
    true : options.verify

  /** @type {UDIF.Image} */
  this.image = !(image instanceof UDIF.Image) ?
    new UDIF.Image( image ) : image

  this._entry = 0
  this._block = 0

  if( this.image.fd == null ) {
    this.open()
  }

  this.on( 'end', () => {
    if( this.autoClose ) {
      this.destroy()
    }
  })

  this._masterHash = null
  this._blockHash = null

}

/**
 * ReadStream prototype
 * @ignore
 */
ReadStream.prototype = {

  constructor: ReadStream,

  _decompress( type, buffer, callback ) {
    switch( type ) {
      case UDIF.BLOCK.UDZO:
        zlib.unzip( buffer, callback )
        break
      case UDIF.BLOCK.UDBZ:
        try {
          callback( null, bunzip.decode( buffer ) )
        } catch( error ) {
          callback( error )
        }
        break
      case UDIF.BLOCK.UDCO:
        try {
          callback( null, adc.decompress( buffer ) )
        } catch( error ) {
          callback( error )
        }
        break
      default:
        callback( new Error( 'Unknown compression method for type "' + type.toString(16) + '"' ) )
        break
    }
  },

  _readBlock( map, block, callback ) {

    // Don't read comments or block map terminators
    if( block.type === UDIF.BLOCK.COMMENT || block.type === UDIF.BLOCK.TERMINATOR ) {
      return void callback()
    }

    // If the block's marked as zerofill or unallocated,
    // just allocate a zerofilled buffer of that size and return it
    if( block.type === UDIF.BLOCK.ZEROFILL || block.type === UDIF.BLOCK.FREE ) {
      var size = block.sectorCount * UDIF.SECTOR_SIZE
      return void callback( null, Buffer.alloc( size, 0 ) )
    }

    var position = this.image.footer.dataForkOffset + block.compressedOffset
    var length = block.compressedLength
    var buffer = Buffer.alloc( length, 0 )
    var offset = 0

    fs.read( this.image.fd, buffer, offset, length, position, ( error, bytesRead ) => {

      if( error != null ) return callback( error )

      this.bytesRead += bytesRead

      if( bytesRead !== length ) {
        return callback( new Error( `Bytes read mismatch, expected ${size}, got ${bytesRead}` ) )
      }

      if( block.type !== UDIF.BLOCK.RAW ) {
        return this._decompress( block.type, buffer, callback )
      }

      callback( error, buffer )

    })

  },

  _readNextRange() {

    var blkx = this.image.resourceFork.blkx
    var entry = blkx[ this._entry ]

    if( entry == null ) {
      return this.push( null )
    }

    var block = entry.map.blocks[ this._block++ ]
    if( block == null ) {
      this._entry++
      this._block = 0
      return this._readNextRange()
    }

    this._readBlock( entry.map, block, ( error, buffer ) => {

      if( error ) {
        this.destroy()
        this.emit( 'error', error )
        return
      }

      if( buffer != null ) {
        this.bytesWritten += buffer.length
        this.push( buffer )
      } else {
        this._readNextRange()
      }

    })

  },

  _read() {

    if( this.destroyed ) return;

    if( this.opened ) {
      this._readNextRange()
    } else {
      this.once( 'open', () => {
        this._read()
      })
    }

  },

  open() {

    this.image.open(( error, fd ) => {
      if( error ) {
        if( this.autoClose ) {
          this.destroy()
        }
        this.emit( 'error', error )
      } else {
        this.opened = true
        this.emit( 'open' )
      }
    })

    return this

  },

  close( callback ) {

    if( callback ) {
      this.once( 'close', callback )
    }

    if( this.closed || this.image.fd == null ) {
      if( this.image.fd == null ) {
        this.once( 'open', () => this.close() )
        return
      }
      return process.nextTick( () => this.emit( 'close' ) )
    }

    this.closed = true
    this.opened = false

    this.image.close(( error ) => {
      if( error ) this.emit( 'error', error )
      else this.emit( 'close' )
    })

  },

  destroy() {
    if( this.destroyed ) return
    this.destroyed = true
    this.close()
  },

}

inherit( ReadStream, Stream.Readable )

module.exports = ReadStream
