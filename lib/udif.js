// Apple's Universal Disk Image Format (UDIF)
var UDIF = module.exports

/**
 * Size of a sector in bytes
 * NOTE: Beware, as this is just a guess based on
 * the sector numbers and their contents in images
 * @const {Number}
 */
UDIF.SECTOR_SIZE = 512

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
UDIF.BLOCK = {
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

/** @constructor Checksum */
UDIF.Checksum = require( './checksum' )

/** @constructor Koly block */
UDIF.Footer = require( './footer' )

/** @constructor Mish data */
UDIF.BlockMap = require( './blockmap' )

/** @constructor Disk image */
UDIF.Image = require( './image' )

/** @constructor Readable stream */
UDIF.ReadStream = require( './readstream' )

/**
 * Create a ReadStream for a given image
 * @param {String|UDIF.Image} image
 * @param {Object} [options]
 * @returns {UDIF.ReadStream}
 */
UDIF.createReadStream = function( image, options ) {
  return new UDIF.ReadStream( image, options )
}

/**
 * Get the uncompressed size of a given image
 * @param {String} filename
 * @param {Function} callback
 * @returns {undefined}
 */
UDIF.getUncompressedSize = function( filename, callback ) {
  var dmg = new UDIF.Image( filename )
  dmg.open( function( error ) {
    if( error ) return void callback( error )
    var size = dmg.getUncompressedSize()
    dmg.close( function( error ) {
      callback( error, size )
    })
  })
}
