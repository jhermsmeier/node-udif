'use strict'

var fs = require( 'fs' )
var UDIF = require( './udif' )

class SparseReadStream extends UDIF.ReadStream {

  /**
   * UDIF Image SparseReadStream
   * @constructor
   * @memberOf UDIF
   * @param {UDIF.Image|String} image
   * @param {Object} [options]
   * @returns {SparseReadStream}
   */
  constructor( image, options ) {

    options = options || {}
    options.objectMode = true

    super( image, options )

    this._blockBuffer = Buffer.allocUnsafe( 2 * 1024 * 1024 )

  }

  _read( n ) {

    if( this.destroyed ) return

    if( !this.opened ) {
      return void this.once( 'open', () => this._read() )
    }

    var blkx = this.image.resourceFork.blkx
    var entry = blkx[ this._entry ]

    if( entry == null ) {
      return void this.push( null )
    }

    var block = entry.map.blocks[ this._block ]
    if( block == null ) {
      this._entry++
      this._block = 0
      return this._read()
    }

    // Don't read comments or block map terminators
    if( block.type === UDIF.BLOCK.COMMENT || block.type === UDIF.BLOCK.TERMINATOR ) {
      this._block++
      return this._read()
    }

    // Ignore zerofill & free, since this is a sparse stream
    if( block.type === UDIF.BLOCK.ZEROFILL || block.type === UDIF.BLOCK.FREE ) {
      this._block++
      return this._read()
    }

    var size = block.sectorCount * UDIF.SECTOR_SIZE
    var position = this.image.footer.dataForkOffset + block.compressedOffset
    var length = block.compressedLength
    var offset = 0

    this.image.fs.read( this.image.fd, this._blockBuffer, offset, length, position, ( error, bytesRead ) => {

      this._block++

      if( error != null ) {
        return void this.emit( 'error', error )
      }

      this.bytesRead += bytesRead

      if( bytesRead !== length ) {
        error = new Error( `Bytes read mismatch, expected ${length}, got ${bytesRead}` )
        return void this.emit( 'error', error )
      }

      var chunkPosition = ( entry.map.sectorNumber * UDIF.SECTOR_SIZE ) +
        ( block.sectorNumber * UDIF.SECTOR_SIZE )

      if( block.type !== UDIF.BLOCK.RAW ) {
        UDIF.decompressBlock( block.type, this._blockBuffer, length, ( error, buffer ) => {
          if( error != null ) {
            return void this.emit( 'error', error )
          }
          this.bytesWritten += buffer.length
          this.push({ buffer: buffer, position: chunkPosition })
        })
      } else {
        this.bytesWritten += length
        var buffer
        try {
          buffer = Buffer.allocUnsafe( length )
        } catch( error ) {
          return void this.destroy( error )
        }
        this._blockBuffer.copy( buffer )
        this.push({ buffer: buffer, position: chunkPosition })
      }

    })

  }

}

module.exports = SparseReadStream
