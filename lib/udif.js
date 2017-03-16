// Apple's Universal Disk Image Format (UDIF)
var UDIF = module.exports

/**
 * Checksum types
 * @enum {Number}
 */
UDIF.CHECKSUM_TYPE = {
  NONE: 0x00000000,
  CRC32: 0x00000002,
  // There are more (MD5, etc.), but
  // I haven't found out their values, yet
}

/**
 * Mish Data BLKX types
 * @enum {Number}
 */
UDIF.BLOCK_TYPE = {
  ZEROFILL: 0x00000000,
  RAW: 0x00000001, // UDRW (UDIF read/write) / UDRO (UDIF read-only)
  // NOTE: Since "Apple_Free" regions are marked with this,
  // and some region's intermittent blocks have it, this is probably "UNALLOCATED"
  FREE: 0x00000002, // Free / Ignored / Unallocated
  UDCO: 0x80000004, // UDCO (UDIF ADC-compressed)
  UDZO: 0x80000005, // UDZO (UDIF zlib-compressed)
  UDBZ: 0x80000006, // UDBZ (UDIF bzip2-compressed)
  COMMENT: 0x7FFFFFFE,
  TERMINATOR: 0xFFFFFFFF,
}

/** @constructor Koly block */
UDIF.Footer = require( './footer' )

/** @constructor Mish data */
UDIF.BlockMap = require( './blockmap' )

/** @constructor Disk image */
UDIF.Image = require( './dmg' )
