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

  /** @type {Number} Signature */
  this.signature = Footer.SIGNATURE
  /** @type {Number} Version number */
  this.version = 0
  /** @type {Number} Size of this structure in bytes */
  this.headerSize = 0
  /** @type {Number} Flags */
  this.flags = 0
  /** @type {Number} Running data fork offset (?) */
  this.runningDataForkOffset = 0
  /** @type {Number} Data fork offset */
  this.dataForkOffset = 0
  /** @type {Number} Data fork length in bytes */
  this.dataForkLength = 0
  /** @type {Number} Resource fork offset */
  this.resourceForkOffset = 0
  /** @type {Number} Resource fork length in bytes */
  this.resourceForkLength = 0
  /** @type {Number} Segment number */
  this.segmentNumber = 0
  /** @type {Number} Segment count */
  this.segmentCount = 0
  /** @type {Buffer} Segment ID */
  this.segmentId = Buffer.alloc( 16 )
  /** @type {UDIF.Checksum} Data checksum */
  this.dataChecksum = new UDIF.Checksum()
  /** @type {Number} XML data offset */
  this.xmlOffset = 0
  /** @type {Number} XML data length in bytes */
  this.xmlLength = 0
  /** @type {Buffer} Reserved 1 */
  this.reserved1 = Buffer.alloc( 120 )
  /** @type {UDIF.Checksum} Checksum */
  this.checksum = new UDIF.Checksum()
  /** @type {Number} Image variant */
  this.imageVariant = 0
  /** @type {Number} Sector count */
  this.sectorCount = 0
  /** @type {Number} Reseved 2 */
  this.reserved2 = 0
  /** @type {Number} Reseved 3 */
  this.reserved3 = 0
  /** @type {Number} Reseved 4 */
  this.reserved4 = 0

  this.segmentId.fill(0)
  this.reserved1.fill(0)

}

/**
 * Koly block structure size in bytes
 * @type {Number}
 */
Footer.SIZE = 512

/**
 * Magic 32-bit value; 'koly' in ASCII
 * @type {Number}
 */
Footer.SIGNATURE = 0x6B6F6C79

/**
 * UDIF Version (latest known == 4)
 * @type {Number}
 */
Footer.VERSION = 0x00000004

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

    if( this.signature !== Footer.SIGNATURE ) {
      var expected = Footer.SIGNATURE.toString(16)
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
   * Write a Koly block to a buffer
   * @param {Buffer} [buffer]
   * @param {Number} [offset=0]
   * @returns {Buffer}
   */
  write( buffer, offset ) {

    offset = offset || 0
    buffer = buffer || Buffer.alloc( Footer.SIZE + offset )

    buffer.writeUInt32BE( this.signature, offset + 0 )
    buffer.writeUInt32BE( this.version, offset + 4 )
    buffer.writeUInt32BE( this.headerSize, offset + 8 )
    buffer.writeUInt32BE( this.flags, offset + 12 )
    uint64.writeBE( buffer, this.runningDataForkOffset, offset + 16, 8 )
    uint64.writeBE( buffer, this.dataForkOffset, offset + 24, 8 )
    uint64.writeBE( buffer, this.dataForkLength, offset + 32, 8 )
    uint64.writeBE( buffer, this.resourceForkOffset, offset + 40, 8 )
    uint64.writeBE( buffer, this.resourceForkLength, offset + 48, 8 )
    buffer.writeUInt32BE( this.segmentNumber, offset + 56 )
    buffer.writeUInt32BE( this.segmentCount, offset + 60 )

    buffer.write( this.segmentId, offset + 64, 16 )

    this.dataChecksum.write( buffer, offset + 80 )

    uint64.writeBE( buffer, this.xmlOffset, offset + 216, 8 )
    uint64.writeBE( buffer, this.xmlLength, offset + 224, 8 )

    buffer.write( this.reserved1, offset + 232, 120 )

    this.checksum.write( buffer, offset + 352 )

    buffer.writeUInt32BE( this.imageVariant, offset + 488 )
    uint64.writeBE( buffer, this.sectorCount, offset + 492, 8 )

    buffer.writeUInt32BE( this.reserved2, offset + 500 )
    buffer.writeUInt32BE( this.reserved3, offset + 504 )
    buffer.writeUInt32BE( this.reserved4, offset + 508 )

    return buffer

  }

}

// Exports
module.exports = Footer
