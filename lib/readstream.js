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

    this._blockBuffer = Buffer.allocUnsafe( 2 * 1024 * 1024 )

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
      return void process.nextTick(() => {
        this.push( Buffer.alloc( size, 0 ) )
      })
    }

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
        error = new Error( `Bytes read mismatch, expected ${size}, got ${bytesRead}` )
        return void this.emit( 'error', error )
      }

      if( block.type !== UDIF.BLOCK.RAW ) {
        UDIF.decompressBlock( block.type, this._blockBuffer, length, ( error, buffer ) => {
          if( error != null ) {
            return void this.emit( 'error', error )
          }
          this.bytesWritten += buffer.length
          this.push( buffer )
        })
      } else {
        this.bytesWritten += size
        var buffer = Buffer.allocUnsafe( size )
        this._blockBuffer.copy( buffer )
        this.push( buffer )
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
    this.destroy( callback )
  }

  _close( callback ) {

    if( this.closed || this.image.fd == null ) {
      if( this.image.fd == null ) {
        this.once( 'open', () => this.close( callback ) )
        return
      }
      return process.nextTick( () => callback() )
    }

    this.closed = true
    this.opened = false

    this.image.close(( error ) => {
      callback && callback( error )
    })

  }

  _destroy( error, done ) {
    this._close(( closeError ) => {
      done( error || closeError )
    })
  }

}

module.exports = ReadStream
