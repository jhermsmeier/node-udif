var UDIF = require( './udif' )
var uint64 = require( './uint64' )

/**
 * UDIF Footer (aka Koly Block)
 * @constructor
 * @memberOf UDIF
 * @return {Footer}
 */
function Footer() {

  if( !(this instanceof Footer) )
    return new Footer()

  this.signature = Footer.signature
  this.version = 0
  this.headerSize = 0
  this.flags = 0
  this.runningDataForkOffset = 0
  this.dataForkOffset = 0
  this.dataForkLength = 0
  this.resourceForkOffset = 0
  this.resourceForkLength = 0
  this.segmentNumber = 0
  this.segmentCount = 0
  this.segmentId = Buffer.alloc( 16 )
  this.dataChecksum = new UDIF.Checksum()
  this.xmlOffset = 0
  this.xmlLength = 0
  this.reserved1 = Buffer.alloc( 120 )
  this.checksum = new UDIF.Checksum()
  this.imageVariant = 0
  this.sectorCount = 0
  this.reserved2 = 0
  this.reserved3 = 0
  this.reserved4 = 0

  this.segmentId.fill( 0 )
  this.reserved1.fill( 0 )

}

/**
 * Koly block structure size in bytes
 * @type {Number}
 */
Footer.size = 512

/**
 * Magic 32-bit value; 'koly' in ASCII
 * @type {Number}
 */
Footer.signature = 0x6B6F6C79

/**
 * UDIF Version (latest known == 4)
 * @type {Number}
 */
Footer.version = 0x00000004

/**
 * Parse a Koly block from a buffer
 * @param {Buffer} buffer
 * @param {Number} [offset=0]
 * @returns {Footer}
 */
Footer.parse = function( buffer, offset ) {
  return new Footer().parse( buffer, offset )
}

/**
 * Footer prototype
 * @type {Object}
 * @ignore
 */
Footer.prototype = {

  constructor: Footer,

  /**
   * Parse a Koly block from a buffer
   * @param {Buffer} buffer
   * @param {Number} [offset=0]
   * @returns {Footer}
   */
  parse( buffer, offset ) {

    offset = offset || 0

    this.signature = buffer.readUInt32BE( offset + 0 )

    if( this.signature !== Footer.signature ) {
      var expected = Footer.signature.toString(16)
      var actual = this.signature.toString(16)
      throw new Error( `Invalid footer signature: Expected 0x${expected}, saw 0x${actual}` )
    }

    this.version = buffer.readUInt32BE( offset + 4 )
    this.headerSize = buffer.readUInt32BE( offset + 8 )
    this.flags = buffer.readUInt32BE( offset + 12 )
    this.runningDataForkOffset = uint64.readBE( buffer, offset + 16, 8 )
    this.dataForkOffset = uint64.readBE( buffer, offset + 24, 8 )
    this.dataForkLength = uint64.readBE( buffer, offset + 32, 8 )
    this.resourceForkOffset = uint64.readBE( buffer, offset + 40, 8 )
    this.resourceForkLength = uint64.readBE( buffer, offset + 48, 8 )
    this.segmentNumber = buffer.readUInt32BE( offset + 56 )
    this.segmentCount = buffer.readUInt32BE( offset + 60 )

    buffer.copy( this.segmentId, 0, offset + 64, offset + 64 + 16 )

    this.dataChecksum.parse( buffer, offset + 80 )

    this.xmlOffset = uint64.readBE( buffer, offset + 216, 8 )
    this.xmlLength = uint64.readBE( buffer, offset + 224, 8 )

    buffer.copy( this.reserved1, 0, offset + 232, offset + 232 + 120 )

    this.checksum.parse( buffer, offset + 352 )

    this.imageVariant = buffer.readUInt32BE( offset + 488 )
    this.sectorCount = uint64.readBE( buffer, offset + 492, 8 )

    this.reserved2 = buffer.readUInt32BE( offset + 500 )
    this.reserved3 = buffer.readUInt32BE( offset + 504 )
    this.reserved4 = buffer.readUInt32BE( offset + 508 )

    return this

  },

  /**
   * Write the Koly block to a buffer
   * @param {Buffer} [buffer]
   * @param {Number} [offset=0]
   * @returns {Buffer}
   */
  write( buffer, offset ) {

    offset = offset || 0
    buffer = buffer || Buffer.alloc( Footer.size + offset )

    buffer.writeUInt32BE( this.signature, offset + 0 )

    buffer.writeUInt32BE( this.version, offset + 4 )
    buffer.writeUInt32BE( this.headerSize, offset + 8 )
    buffer.writeUInt32BE( this.flags, offset + 12 )
    uint64.writeBE( this.runningDataForkOffset, buffer, offset + 16, 8 )
    uint64.writeBE( this.dataForkOffset, buffer, offset + 24, 8 )
    uint64.writeBE( this.dataForkLength, buffer, offset + 32, 8 )
    uint64.writeBE( this.resourceForkOffset, buffer, offset + 40, 8 )
    uint64.writeBE( this.resourceForkLength, buffer, offset + 48, 8 )
    buffer.writeUInt32BE( this.segmentNumber, offset + 56 )

    this.segmentId.copy( buffer, offset + 64, 0, 16 )
    this.dataChecksum.write( buffer, offset + 80 )

    uint64.writeBE( this.xmlOffset, buffer, offset + 216, 8 )
    uint64.writeBE( this.xmlLength, buffer, offset + 224, 8 )

    this.reserved1.copy( buffer, offset + 232, 0, 120 )
    this.checksum.write( buffer, offset + 352 )

    buffer.writeUInt32BE( this.imageVariant, offset + 488 )
    uint64.writeBE( this.sectorCount, buffer, offset + 492, 8 )

    buffer.writeUInt32BE( this.reserved2, offset + 500 )
    buffer.writeUInt32BE( this.reserved3, offset + 504 )
    buffer.writeUInt32BE( this.reserved4, offset + 508 )

    return buffer

  },

}

// Exports
module.exports = Footer
