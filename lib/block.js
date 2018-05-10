var UDIF = require( './udif' )
var uint64 = require( './uint64' )

/**
 * Mish Blkx Block Descriptor
 * @constructor
 * @memberOf DMG.Mish
 * @return {Block}
 */
function Block() {

  if( !(this instanceof Block) )
    return new Block()

  /** @type {Number} Entry / compression type */
  this.type = 0x00000000
  /** @type {String} Entry type name */
  this.description = 'UNKNOWN'
  /** @type {String} Comment ('+beg'|'+end' if type == COMMENT) */
  this.comment = ''
  /** @type {Number} Start sector of this chunk */
  this.sectorNumber = 0x0000000000000000
  /** @type {Number} Number of sectors in this chunk */
  this.sectorCount = 0x0000000000000000
  /** @type {Number} Start of chunk in data fork */
  this.compressedOffset = 0x0000000000000000
  /** @type {Number} Chunk's bytelength in data fork */
  this.compressedLength = 0x0000000000000000

}

/**
 * Get a human readable block type
 * @param {Number} type
 * @returns {String}
 */
Block.getDescription = function( type ) {
  switch( type ) {
    case UDIF.BLOCK.ZEROFILL: return 'ZEROFILL'; break
    case UDIF.BLOCK.RAW: return 'UDRW (raw)'; break
    case UDIF.BLOCK.FREE: return 'FREE (unallocated)'; break
    case UDIF.BLOCK.UDCO: return 'UDCO (adc-compressed)'; break
    case UDIF.BLOCK.UDZO: return 'UDZO (zlib-compressed)'; break
    case UDIF.BLOCK.UDBZ: return 'UDBZ (bzip2-compressed)'; break
    case UDIF.BLOCK.COMMENT: return 'COMMENT'; break
    case UDIF.BLOCK.TERMINATOR: return 'TERMINATOR'; break
    default: return 'UNKNOWN'; break
  }
}

/**
 * Parse Mish Block data from a buffer
 * @param {Buffer} buffer
 * @param {Number} [offset=0]
 * @returns {Block}
 */
Block.parse = function( buffer, offset ) {
  return new Block().parse( buffer, offset )
}

/**
 * Block prototype
 * @type {Object}
 * @ignore
 */
Block.prototype = {

  constructor: Block,

  /**
   * Parse Mish Block data from a buffer
   * @param {Buffer} buffer
   * @param {Number} [offset=0]
   * @returns {Block}
   */
  parse: function( buffer, offset ) {

    offset = offset || 0

    this.type = buffer.readUInt32BE( offset + 0 )
    this.description = Block.getDescription( this.type )
    this.comment = buffer.toString( 'ascii', offset + 4, offset + 8 ).replace( /\u0000/g, '' )
    this.sectorNumber = uint64.readBE( buffer, offset + 8, 8 )
    this.sectorCount = uint64.readBE( buffer, offset + 16, 8 )
    this.compressedOffset = uint64.readBE( buffer, offset + 24, 8 )
    this.compressedLength = uint64.readBE( buffer, offset + 32, 8 )

    return this

  },

}

// Exports
module.exports = Block
