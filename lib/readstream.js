'use strict'

var fs = require( 'fs' )
var Stream = require( 'readable-stream' )
var UDIF = require( './udif' )

class ReadStream extends Stream.Readable {

  /**
   * UDIF Image ReadStream
   * @constructor
   * @memberOf UDIF
   * @param {UDIF.Image|String} image
   * @param {Object} [options]
   * @returns {ReadStream}
   */
  constructor( image, options ) {

    super( options )

    this.bytesRead = 0
    this.bytesWritten = 0

    this.opened = false
    this.closed = false
    this.destroyed = false

    this.image = !(image instanceof UDIF.Image) ?
      new UDIF.Image( image, options ) : image

    this._entry = 0
    this._block = 0
    this._toRead = null

    this.on( 'end', () => {
      if( this.autoClose ) {
        this.destroy()
      }
    })

    this.open()

  }

  _read( n ) {

    if( this.destroyed ) return

    if( !this.opened ) {
      this.once( 'open', () => this._read() )
      return
    }

    var blkx = this.image.resourceFork.blkx
    var entry = blkx[ this._entry ]

    if( entry == null ) {
      return this.push( null )
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

    var size = block.sectorCount * UDIF.SECTOR_SIZE

    // Zerofill
    if( block.type === UDIF.BLOCK.ZEROFILL || block.type === UDIF.BLOCK.FREE ) {
      if( this._toRead == null ) {
        this._toRead = size
      } else if( this._toRead === 0 ) {
        this._block++
        this._toRead = null
        return this._read()
      }
      size = Math.min( this._toRead, this._readableState.highWaterMark )
      this._toRead -= size
      this.bytesWritten += size
      process.nextTick(() => {
        this.push( Buffer.alloc( size, 0 ) )
      })
      return
    }

    var position = this.image.footer.dataForkOffset + block.compressedOffset
    var length = block.compressedLength
    var buffer = Buffer.allocUnsafe( length )
    var offset = 0

    this.image.fs.read( this.image.fd, buffer, offset, length, position, ( error, bytesRead ) => {

      this._block++

      if( error != null ) {
        this.emit( 'error', error )
        return
      }

      this.bytesRead += bytesRead

      if( bytesRead !== length ) {
        error = new Error( `Bytes read mismatch, expected ${size}, got ${bytesRead}` )
        return this.emit( 'error', error )
      }

      if( block.type !== UDIF.BLOCK.RAW ) {
        UDIF.decompressBlock( block.type, buffer, ( error, buffer ) => {
          if( error != null ) {
            this.emit( 'error', error )
            return
          }
          this.bytesWritten += buffer.length
          this.push( buffer )
        })
      } else {
        this.bytesWritten += size
        return this.push( buffer )
      }

    })

  }

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

  }

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

  }

  _destroy( error, done ) {
    this.close(( closeError ) => {
      done( error || closeError )
    })
  }

}

module.exports = ReadStream
