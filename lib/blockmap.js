var UDIF = require( './udif' )
var uint64 = require( './uint64' )

/**
 * BlockMap (BLKX) data (aka Mish Data)
 * @constructor
 * @memberOf UDIF
 * @return {BlockMap}
 */
function BlockMap() {

  if( !(this instanceof BlockMap) )
    return new BlockMap()

  /** @type {Number} Signature */
  this.signature = 0x00000000
  /** @type {Number} Version number */
  this.version = 0x00000000
  /** @type {Number} LBA of starting sector */
  this.sectorNumber = 0x0000000000000000
  /** @type {Number} Number of sectors in this block range */
  this.sectorCount = 0x0000000000000000
  /** @type {Number} Offset of data (within what?) */
  this.dataOffset = 0x0000000000000000
  /** @type {Number} Buffers needed (?) */
  this.buffersNeeded = 0x00000000
  /** @type {Number} Block descriptor number */
  this.blockDescriptorCount = 0x00000000
  /** @type {Number} Reserved 1 */
  this.reserved1 = 0x00000000
  /** @type {Number} Reserved 2 */
  this.reserved2 = 0x00000000
  /** @type {Number} Reserved 3 */
  this.reserved3 = 0x00000000
  /** @type {Number} Reserved 4 */
  this.reserved4 = 0x00000000
  /** @type {Number} Reserved 5 */
  this.reserved5 = 0x00000000
  /** @type {Number} Reserved 6 */
  this.reserved6 = 0x00000000
  /** @type {UDIF.Checksum} Checksum descriptor */
  this.checksum = new UDIF.Checksum()
  /** @type {Number} Number of blocks in map */
  this.blockCount = 0x00000000
  /** @type {Array<UDIF.BlockMap.Block>} List of mapped blocks */
  this.blocks = []

}

/**
 * Size of BlockMap structure in bytes (without Block entries)
 * @type {Number}
 * @constant
 */
BlockMap.SIZE = 204

/**
 * BlockMap data signature
 * @type {Number}
 * @constant
 */
BlockMap.SIGNATURE = 0x6D697368

/**
 * BLKX Version (latest known == 1)
 * @type {Number}
 * @constant
 */
BlockMap.VERSION = 0x00000001

BlockMap.Block = require( './block' )

/**
 * Parse BlockMap data from a buffer
 * @param {Buffer} buffer
 * @param {Number} [offset=0]
 * @returns {BlockMap}
 */
BlockMap.parse = function( buffer, offset ) {
  return new BlockMap().parse( buffer, offset )
}

/**
 * BlockMap prototype
 * @type {Object}
 * @ignore
 */
BlockMap.prototype = {

  constructor: BlockMap,

  /**
   * Parse BlockMap data from a buffer
   * @param {Buffer} buffer
   * @param {Number} [offset=0]
   * @returns {BlockMap}
   */
  parse( buffer, offset ) {

    offset = offset || 0

    this.signature = buffer.readUInt32BE( offset + 0 )

    if( this.signature !== BlockMap.SIGNATURE ) {
      var expected = BlockMap.SIGNATURE.toString(16)
      var actual = this.signature.toString(16)
      throw new Error( `Invalid block map signature: Expected 0x${expected}, saw 0x${actual}` )
    }

    this.version = buffer.readUInt32BE( offset + 4 )
    this.sectorNumber = uint64.readBE( buffer, offset + 8, 8 )
    this.sectorCount = uint64.readBE( buffer, offset + 16, 8 )
    this.dataOffset = uint64.readBE( buffer, offset + 24, 8 )
    this.buffersNeeded = buffer.readUInt32BE( offset + 32 )
    this.blockDescriptorCount = buffer.readUInt32BE( offset + 36 )
    this.reserved1 = buffer.readUInt32BE( offset + 40 )
    this.reserved2 = buffer.readUInt32BE( offset + 44 )
    this.reserved3 = buffer.readUInt32BE( offset + 48 )
    this.reserved4 = buffer.readUInt32BE( offset + 52 )
    this.reserved5 = buffer.readUInt32BE( offset + 56 )
    this.reserved6 = buffer.readUInt32BE( offset + 60 )
    this.checksum.parse( buffer, offset + 64 )
    this.blockCount = buffer.readUInt32BE( offset + 200 )
    this.blocks = []

    for( var i = 0; i < this.blockCount; i++ ) {
      this.blocks.push(
        BlockMap.Block.parse( buffer, BlockMap.SIZE + ( i * BlockMap.Block.SIZE ) + offset )
      )
    }

    return this

  },

  /**
   * Write BlockMap data to a buffer
   * @param {Buffer} [buffer]
   * @param {Number} [offset=0]
   * @returns {Buffer}
   */
  write( buffer, offset ) {

    var length = BlockMap.SIZE + ( this.blocks.length * BlockMap.Block.SIZE )

    offset = offset || 0
    buffer = buffer || Buffer.alloc( length + offset )

    // Update block count
    this.blockCount = this.blocks.length

    buffer.writeUInt32BE( this.signature, offset + 0 )
    buffer.writeUInt32BE( this.version, offset + 4 )
    uint64.writeBE( buffer, this.sectorNumber, offset + 8, 8 )
    uint64.writeBE( buffer, this.sectorCount, offset + 16, 8 )
    uint64.writeBE( buffer, this.dataOffset, offset + 24, 8 )
    buffer.writeUInt32BE( this.buffersNeeded, offset + 32 )
    buffer.writeUInt32BE( this.blockDescriptorCount, offset + 36 )
    buffer.writeUInt32BE( this.reserved1, offset + 40 )
    buffer.writeUInt32BE( this.reserved2, offset + 44 )
    buffer.writeUInt32BE( this.reserved3, offset + 48 )
    buffer.writeUInt32BE( this.reserved4, offset + 52 )
    buffer.writeUInt32BE( this.reserved5, offset + 56 )
    buffer.writeUInt32BE( this.reserved6, offset + 60 )
    this.checksum.write( buffer, offset + 64 )
    buffer.writeUInt32BE( this.blockCount, offset + 200 )

    for( var i = 0; i < this.blockCount; i++ ) {
      this.blocks[i].write( buffer, BlockMap.SIZE + ( i * BlockMap.Block.SIZE ) + offset )
    }

    return buffer

  },

}

// Exports
module.exports = BlockMap
