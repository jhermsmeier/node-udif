var UDIF = require( './udif' )

/**
 * UDIF Footer (aka Koly Block)
 * @constructor
 * @memberOf UDIF
 * @return {KolyBlock}
 */
function KolyBlock() {

  if( !(this instanceof KolyBlock) )
    return new KolyBlock()

  this.signature = KolyBlock.signature
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
  this.segmentId = new Buffer( 16 )
  this.dataChecksumType = 0
  this.dataChecksumSize = 0
  this.dataChecksum = ''
  this.xmlOffset = 0
  this.xmlLength = 0
  this.reserved1 = new Buffer( 120 )
  this.checksumType = 0
  this.checksumSize = 0
  this.checksum = ''
  this.imageVariant = 0
  this.sectorCount = 0
  this.reserved2 = 0
  this.reserved3 = 0
  this.reserved4 = 0

  this.segmentId.fill(0)
  this.reserved1.fill(0)

}

/**
 * Koly block structure size in bytes
 * @type {Number}
 */
KolyBlock.size = 512

/**
 * Magic 32-bit value; 'koly' in ASCII
 * @type {Number}
 */
KolyBlock.signature = 0x6B6F6C79

/**
 * UDIF Version (latest known == 4)
 * @type {Number}
 */
KolyBlock.version = 0x00000004

/**
 * Parse a Koly block from a buffer
 * @param {Buffer} buffer
 * @param {Number} [offset=0]
 * @returns {KolyBlock}
 */
KolyBlock.parse = function( buffer, offset ) {
  return new KolyBlock().parse( buffer, offset )
}

/**
 * KolyBlock prototype
 * @type {Object}
 * @ignore
 */
KolyBlock.prototype = {

  constructor: KolyBlock,

  /**
   * Parse a Koly block from a buffer
   * @param {Buffer} buffer
   * @param {Number} [offset=0]
   * @returns {KolyBlock}
   */
  parse: function( buffer, offset ) {

    offset = offset || 0

    this.signature = buffer.readUInt32BE( offset + 0 )

    if( this.signature !== KolyBlock.signature ) {
      var expected = KolyBlock.signature.toString(16)
      var actual = this.signature.toString(16)
      throw new Error( `Invalid footer signature: Expected 0x${expected}, saw 0x${actual}` )
    }

    this.version = buffer.readUInt32BE( offset + 4 )
    this.headerSize = buffer.readUInt32BE( offset + 8 )
    this.flags = buffer.readUInt32BE( offset + 12 )
    this.runningDataForkOffset = buffer.readUIntBE( offset + 16, 8 )
    this.dataForkOffset = buffer.readUIntBE( offset + 24, 8 )
    this.dataForkLength = buffer.readUIntBE( offset + 32, 8 )
    this.resourceForkOffset = buffer.readUIntBE( offset + 40, 8 )
    this.resourceForkLength = buffer.readUIntBE( offset + 48, 8 )
    this.segmentNumber = buffer.readUInt32BE( offset + 56 )
    this.segmentCount = buffer.readUInt32BE( offset + 60 )

    buffer.copy( this.segmentId, 0, offset + 64, offset + 64 + 16 )

    this.dataChecksumType = buffer.readUInt32BE( offset + 80 )
    this.dataChecksumSize = buffer.readUInt32BE( offset + 84 )
    this.dataChecksum = buffer.toString( 'hex', offset + 88, offset + 88 + this.dataChecksumSize / 8 )

    this.xmlOffset = buffer.readUIntBE( offset + 216, 8 )
    this.xmlLength = buffer.readUIntBE( offset + 224, 8 )

    buffer.copy( this.reserved1, 0, offset + 232, offset + 232 + 120 )

    // NOTE: Maybe make new struct (UDIF.Checksum), b/c reuse in Mish Blocks?
    this.checksumType = buffer.readUInt32BE( offset + 352 )
    this.checksumSize = buffer.readUInt32BE( offset + 356 )
    this.checksum = buffer.toString( 'hex', offset + 360, offset + 360 + this.checksumSize / 8 )

    this.imageVariant = buffer.readUInt32BE( offset + 488 )
    this.sectorCount = buffer.readUIntBE( offset + 492, 8 )

    this.reserved2 = buffer.readUInt32BE( offset + 500 )
    this.reserved3 = buffer.readUInt32BE( offset + 504 )
    this.reserved4 = buffer.readUInt32BE( offset + 508 )

    return this

  },

}

// Exports
module.exports = KolyBlock
