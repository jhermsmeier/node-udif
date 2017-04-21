var fs = require( 'fs' )
var Stream = require( 'stream' )
var zlib = require( 'zlib' )
var bunzip = require( 'seek-bzip' )
var adc = require( 'apple-data-compression' )
var inherit = require( 'bloodline' )
var UDIF = require( './udif' )

/**
 * UDIF Image ReadStream
 * @constructor
 * @memberOf UDIF
 * @param {UDIF.Image|String} image
 * @param {Object} [options]
 * @returns {ReadStream}
 */
function ReadStream( image, options ) {

  if( !(this instanceof ReadStream) ) {
    return new ReadStream( image, options )
  }

  Stream.Readable.call( this, options )

  this.bytesRead = 0
  this.bytesWritten = 0
  this.destroyed = false

  this.image = !(image instanceof UDIF.Image) ?
    new UDIF.Image( image ) : image

  // Index of current resource block map being handled
  this._blockMap = 0
  // Index of current map block being handled
  this._block = 0

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
        try { callback( null, bunzip.decode( buffer ) ) }
        catch( error ) { callback( error ) }
        break
      case UDIF.BLOCK.UDCO:
        try { callback( null, adc.decompress( buffer ) ) }
        catch( error ) { callback( error ) }
        break
      default:
        callback( new Error( 'Unknown compression method for type "' + type.toString(16) + '"' ) )
        break
    }
  },

  // TODO: It probably makes more sense to implement a BlockDevice API
  // in UDIF.Image and use that from here, but for now this is the PoC
  _readBlock( map, block, callback ) {

    // Don't read comments or block map terminators
    if( block.type === UDIF.BLOCK.COMMENT || block.type === UDIF.BLOCK.TERMINATOR ) {
      return void callback()
    }

    // // A block's sector number is relative to it's map's sector number,
    // // so we have to calculate the offset in bytes by adding the two,
    // // plus the data fork's offset:
    // var position = this.image.footer.dataForkOffset +
    //   ( block.sectorNumber * UDIF.SECTOR_SIZE ) +
    //   ( map.sectorNumber * UDIF.SECTOR_SIZE )

    // var isCompressed = block.type === UDIF.BLOCK.UDCO ||
    //   block.type === UDIF.BLOCK.UDZO ||
    //   block.type === UDIF.BLOCK.UDBZ

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

  _readNextBlock() {

    var resource = this.image.resourceFork.blkx[ this._blockMap ]

    // End once there are no resources left to read
    if( resource == null ) {
      return void this.push( null )
    }

    var block = resource.map.blocks[ this._block++ ]

    if( block != null ) {
      this._readBlock( resource.map, block, ( error, buffer ) => {
        if( error ) {
          this.destroy()
          this.emit( 'error', error )
        } else if( buffer != null ) {
          this.bytesWritten += buffer.length
          this.push( buffer )
        }
      })
    }

    // If we've read all blocks in a resource, advance to the next
    if( this._block >= resource.map.blockCount ) {
      this._blockMap++
      this._block = 0
      return this._readNextBlock()
    }

  },

  _read() {
    if( this.image.fd ) this._readNextBlock()
    else this.image.open(( error ) => {
      if( error ) {
        return void this.emit( 'error', error )
      }
      this._readNextBlock()
    })
  },

  close( callback ) {
    this.push( null )
    this.image.close(( error ) => {
      this.emit( 'close', error )
      if( callback ) {
        callback.call( this, error )
      }
    })
  },

  destroy() {
    if( !this.destroyed ) {
      this.destroyed = true
      this.close()
      this.emit( 'destroy' )
    }
  },

}

inherit( ReadStream, Stream.Readable )
// Exports
module.exports = ReadStream
