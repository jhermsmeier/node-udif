var Stream = require( 'stream' )
var inherit = require( 'bloodline' )

/**
 * ZerofillStream
 * @constructor
 * @param {Object} [options]
 * @param {Number} [options.highWaterMark=65536]
 * @param {Number} [options.fill=0]
 * @param {Number} [options.length=Infinity]
 * @param {Number} [options.blockSize=1]
 * @returns {ZerofillStream}
 */
function ZerofillStream( options ) {

  if( !(this instanceof ZerofillStream) ) {
    return new ZerofillStream( options )
  }

  options = options || {}
  options.highWaterMark = options.highWaterMark || ( 64 * 1024 )

  Stream.Readable.call( this, options )

  this.blockSize = options.blockSize || 1
  this.fill = options.fill || 0
  this.length = options.length || Infinity

  this.highWaterMark = options.highWaterMark
  this.bytesWritten = 0

  if( this.blockSize <= 0 ) {
    throw new Error( 'Block size must be greater than zero' )
  }

  if( !Number.isInteger( this.blockSize ) ) {
    throw new Error( 'Block size must be a positive integer' )
  }

  if( this.length < 0 || ( +this.length !== this.length ) || Number.isNaN( this.length ) ) {
    throw new Error( 'Length must be a positive integer' )
  }

  if( this.length !== Infinity && !Number.isInteger( this.length ) ) {
    throw new Error( 'Length must be a positive integer' )
  }

}

/**
 * ZerofillStream prototype
 * @ignore
 */
ZerofillStream.prototype = {

  constructor: ZerofillStream,

  _read() {

    var length = this.length - this.bytesWritten

    if( length <= 0 ) {
      return void this.push( null )
    }

    length = Math.min( length, this.highWaterMark )
    length = this.blockSize * Math.ceil( length / this.blockSize )
    length = Math.max( length, this.blockSize )

    var buffer = Buffer.alloc( length, this.fill )

    this.bytesWritten += length
    this.push( buffer )

  }

}

// Inherit from ReadableStream
inherit( ZerofillStream, Stream.Readable )

// Exports
module.exports = ZerofillStream
