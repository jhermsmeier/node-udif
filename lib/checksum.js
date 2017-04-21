var UDIF = require( './udif' )

/**
 * UDIF Checksum Structure
 * @constructor
 * @memberOf UDIF
 * @returns {Checksum}
 */
function Checksum() {

  if( !(this instanceof Checksum) ) {
    return new Checksum()
  }

  /** @type {Number} Checksum type (uint32) */
  this.type = UDIF.CHECKSUM_TYPE.NONE
  /** @type {Number} Checksum size in bits (uint32) */
  this.bits = 0x00000000
  /** @type {String} Checksum as hex string */
  this.value = ''

}

/**
 * Checksum struct size in bytes
 * @todo verify correctness of this value
 * @type {Number}
 */
Checksum.size = 128

/**
 * Parse a UDIF checksum struct from a buffer
 * @param {Buffer} buffer
 * @param {Number} [offset]
 * @returns {Checksum}
 */
Checksum.parse = function( buffer, offset ) {
  return new Checksum().parse( buffer, offset )
}

/**
 * Checksum prototype
 * @ignore
 */
Checksum.prototype = {

  constructor: Checksum,

  /**
   * Parse a UDIF checksum struct from a buffer
   * @param {Buffer} buffer
   * @param {Number} [offset]
   * @returns {Checksum}
   */
  parse( buffer, offset ) {

    offset = offset || 0

    this.type = buffer.readUInt32BE( offset + 0 )
    this.bits = buffer.readUInt32BE( offset + 4 )
    this.value = buffer.toString( 'hex', offset + 8, offset + 8 + this.bits / 8 )

    return this

  },

}

// Exports
module.exports = Checksum
