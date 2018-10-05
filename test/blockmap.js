var assert = require( 'assert' )
var UDIF = require( '..' )

context( 'UDIF.BlockMap', function() {

  var data = Buffer.from( `
    bWlzaAAAAAEAAAAAAAZSqAAAAAAAAAAgAAAAAAAAAAAAAAgIAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAgHni
    qNgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
    AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACgAAABQAAAAAAAAAAAAAAAAAAA
    AAAAAAgAAAAAATVXv8AAAAAAAAAdP////8AAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAE1V9zAAAAAAAAAAA=
  `, 'base64' )

  specify( '.parse()', function() {

    var blockMap = UDIF.BlockMap.parse( data )

    assert.deepEqual( blockMap, {
      "blockCount": 2,
      "blockDescriptorCount": 5,
      "blocks": [
        {
          "comment": "",
          "compressedLength": 116,
          "compressedOffset": 81092351,
          "description": "UDZO (zlib-compressed)",
          "sectorCount": 32,
          "sectorNumber": 0,
          "type": 2147483653
        },
        {
          "comment": "",
          "compressedLength": 0,
          "compressedOffset": 81092467,
          "description": "TERMINATOR",
          "sectorCount": 0,
          "sectorNumber": 32,
          "type": 4294967295
        }
      ],
      "buffersNeeded": 2056,
      "checksum": {
        "bits": 32,
        "type": 2,
        "value": "1e78aa36"
      },
      "dataOffset": 0,
      "reserved1": 0,
      "reserved2": 0,
      "reserved3": 0,
      "reserved4": 0,
      "reserved5": 0,
      "reserved6": 0,
      "sectorCount": 32,
      "sectorNumber": 414376,
      "signature": 1835627368,
      "version": 1
    })

  })

  specify( '.write()', function() {
    var blockMap = UDIF.BlockMap.parse( data )
    var actual = blockMap.write()
    assert.deepEqual( actual, data )
  })

})
