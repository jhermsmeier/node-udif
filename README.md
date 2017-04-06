# Apple Universal Disk Image Format (UDIF/DMG)
[![npm](https://img.shields.io/npm/v/udif.svg?style=flat-square)](https://npmjs.com/package/udif)
[![npm license](https://img.shields.io/npm/l/udif.svg?style=flat-square)](https://npmjs.com/package/udif)
[![npm downloads](https://img.shields.io/npm/dm/udif.svg?style=flat-square)](https://npmjs.com/package/udif)
[![build status](https://img.shields.io/travis/jhermsmeier/node-udif.svg?style=flat-square)](https://travis-ci.org/jhermsmeier/node-udif)

## Install via [npm](https://npmjs.com)

```sh
$ npm install --save udif
```

## Usage

```js
var UDIF = require( 'udif' )
```

### Opening a .dmg image

```js
var dmg = new UDIF.Image( 'path/to/image.dmg' )

dmg.open( function( error ) {
  // ...
})
```

### Closing the image

```js
dmg.close( function( error ) {
  // ...
})
```

### Determining the uncompressed size

Note that the image has to be opened to determine the uncompressed size,
as this is read from the resource fork.

```js
UDIF.getUncompressedSize( 'path/to/image.dmg', function( error, size ) {
  console.log( size, 'bytes' )
  // > 629145600 bytes
})
```

```js
var dmg = new UDIF.Image( 'path/to/image.dmg' )

dmg.open( function( error ) {
  console.log( dmg.getUncompressedSize(), 'bytes' )
  // > 629145600 bytes
})
```

### Creating a readable stream

```js
var readableStream = UDIF.createReadStream( 'path/to/image.dmg' )
```

Or, if you already have an instance of `UDIF.Image`:

```js
var readableStream = dmg.createReadStream()
```

### Extracting the raw disk image

Extracting the uncompressed, raw disk image from a `.dmg` file becomes as easy as the following:

```js
UDIF.createReadStream( 'path/to/image.dmg' )
  .pipe( fs.createWriteStream( '/path/to/destination.img' ) )
```

### Inspecting the UDIF footer

The footer (aka the "Koly Block") contains pointers to the XML metadata,
data fork & resource fork as well as checksums.

```js
// Once the dmg has been opened:
dmg.open( function( error ) {
  console.log( dmg.footer )
})
```

```js
KolyBlock {
  signature: 1802464377,
  version: 4,
  headerSize: 512,
  flags: 1,
  runningDataForkOffset: 0,
  dataForkOffset: 0,
  dataForkLength: 58423161,
  resourceForkOffset: 0,
  resourceForkLength: 0,
  segmentNumber: 1,
  segmentCount: 1,
  segmentId: <Buffer 57 7e fa dc 18 96 46 36 89 93 6d e6 59 6e 36 1c>,
  dataChecksumType: 2,
  dataChecksumSize: 32,
  dataChecksum: '57751645',
  xmlOffset: 58423161,
  xmlLength: 18424,
  reserved1: <Buffer 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ... >,
  checksumType: 2,
  checksumSize: 32,
  checksum: '29dc317d',
  imageVariant: 1,
  sectorCount: 1228800,
  reserved2: 0,
  reserved3: 0,
  reserved4: 0,
}
```

### Inspecting the XML Metadata

The XML data is a [Property List](https://en.wikipedia.org/wiki/Property_list), (or plist) which contains a block map under `resource-fork.blkx`.

```js
dmg.open( function( error ) {
  console.log( dmg.resources )
})
```

```js
[{
  id: -1,
  attributes: 80,
  name: 'Protective Master Boot Record (MBR : 0)',
  coreFoundationName: 'Protective Master Boot Record (MBR : 0)',
  map: BlockMap {
    signature: 1835627368,
    version: 1,
    sectorNumber: 0,
    sectorCount: 1,
    dataOffset: 0,
    buffersNeeded: 2056,
    blockDescriptorCount: 0,
    // reserved fields omitted for brevity
    checksumType: 2,
    checksumSize: 32,
    checksum: 'baa01cf3',
    blockCount: 2,
    blocks: [
      Block {
        type: 2147483653,
        description: 'UDZO (UDIF zlib-compressed)',
        comment: '',
        sectorNumber: 0,
        sectorCount: 1,
        compressedOffset: 0,
        compressedLength: 30
      },
      Block {
        type: 4294967295,
        description: 'TERMINATOR',
        comment: '',
        sectorNumber: 1,
        sectorCount: 0,
        compressedOffset: 30,
        compressedLength: 0
      }
    ]
  }
}, {
  id: 0,
  attributes: 80,
  name: 'GPT Header (Primary GPT Header : 1)',
  coreFoundationName: 'GPT Header (Primary GPT Header : 1)',
  map: BlockMap {
    signature: 1835627368,
    version: 1,
    sectorNumber: 1,
    sectorCount: 1,
    dataOffset: 0,
    buffersNeeded: 2056,
    blockDescriptorCount: 1,
    // reserved fields omitted for brevity
    checksumType: 2,
    checksumSize: 32,
    checksum: '954e054b',
    blockCount: 2,
    blocks: [
      Block {
        type: 2147483653,
        description: 'UDZO (UDIF zlib-compressed)',
        comment: '',
        sectorNumber: 0,
        sectorCount: 1,
        compressedOffset: 30,
        compressedLength: 75
      },
      Block {
        type: 4294967295,
        description: 'TERMINATOR',
        comment: '',
        sectorNumber: 1,
        sectorCount: 0,
        compressedOffset: 105,
        compressedLength: 0
      }
    ]
  }
},
// ... more omitted for brevity ...
{
  id: 6,
  attributes: 80,
  name: 'GPT Header (Backup GPT Header : 7)',
  coreFoundationName: 'GPT Header (Backup GPT Header : 7)',
  map: BlockMap {
    signature: 1835627368,
    version: 1,
    sectorNumber: 1228799,
    sectorCount: 1,
    dataOffset: 0,
    buffersNeeded: 2056,
    blockDescriptorCount: 7,
    // reserved fields omitted for brevity
    checksumType: 2,
    checksumSize: 32,
    checksum: 'beda967a',
    blockCount: 2,
    blocks: [
      Block {
        type: 2147483653,
        description: 'UDZO (UDIF zlib-compressed)',
        comment: '',
        sectorNumber: 0,
        sectorCount: 1,
        compressedOffset: 58423085,
        compressedLength: 76
      },
      Block {
        type: 4294967295,
        description: 'TERMINATOR',
        comment: '',
        sectorNumber: 1,
        sectorCount: 0,
        compressedOffset: 58423161,
        compressedLength: 0
      }
    ]
  }
}]
```
