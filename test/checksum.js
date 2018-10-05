var assert = require( 'assert' )
var UDIF = require( '..' )

context( 'UDIF.Checksum', function() {

  specify( '.parse()', function() {
    var buffer = Buffer.from( 'AAAAAgAAACC6rgcBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', 'base64' )
    var checksum = UDIF.Checksum.parse( buffer )
    assert.deepEqual( checksum, {
      type: 2,
      bits: 32,
      value: 'baae0701',
    })
  })

  specify( '.write()', function() {
    var expected = Buffer.from( 'AAAAAgAAACC6rgcBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', 'base64' )
    var checksum = UDIF.Checksum.parse( expected )
    var actual = checksum.write()
    assert.deepEqual( actual, expected )
  })

})
