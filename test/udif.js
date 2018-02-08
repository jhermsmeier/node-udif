var assert = require( 'assert' )
var fs = require( 'fs' )
var path = require( 'path' )
var stream = require( 'stream' )
var UDIF = require( '..' )
var images = require( './data' )

const DATADIR = path.join( __dirname, 'data' )

context( 'UDIF.getUncompressedSize()', function() {
  images.forEach( function( data ) {
    specify( data.filename, function( done ) {
      UDIF.getUncompressedSize( path.join( DATADIR, data.filename ), function( error, size ) {
        assert.ifError( error )
        assert.equal( size, data.uncompressedSize )
        done()
      })
    })
  })
})

context( 'UDIF.Image', function() {
  images.forEach( function( data ) {
    context( data.filename, function() {

      var filename = path.join( DATADIR, data.filename )
      var image = null

      specify( 'new UDIF.Image()', function() {
        image = new UDIF.Image( filename )
      })

      specify( 'image.open()', function( done ) {
        image.open( done )
      })

      specify( 'image.footer.dataForkLength', function() {
        assert.equal( image.footer.dataForkLength, data.dataForkLength )
      })

      specify( 'image.getUncompressedSize()', function() {
        assert.equal( image.getUncompressedSize(), data.uncompressedSize )
      })

      specify( 'image.close()', function( done ) {
        image.close( done )
      })

    })
  })
})

context( 'UDIF.ReadStream', function() {
  images.forEach( function( data ) {
    context( data.filename, function() {

      specify( 'read & decompress image', function( done ) {

        var bytesRead = 0

        UDIF.createReadStream( path.join( DATADIR, data.filename ) )
          .on( 'error', done )
          .on( 'data', function( chunk ) {
            bytesRead += chunk.length
            chunk = null
          })
          .on( 'end', function() {
            assert.equal( bytesRead, data.uncompressedSize )
            done()
          })

      })

      specify( 'can close while reading', function( done ) {

        UDIF.createReadStream( path.join( DATADIR, data.filename ) )
          .on( 'error', done )
          .on( 'data', function( chunk ) {
            this.close()
          })
          .on( 'close', function() {
            done()
          })

      })

      specify( 'can destroy while reading', function( done ) {

        UDIF.createReadStream( path.join( DATADIR, data.filename ) )
          .on( 'error', done )
          .on( 'data', function( chunk ) {
            this.destroy()
          })
          .on( 'close', function() {
            done()
          })

      })

    })
  })

  context( 'Compression Methods', function() {

    var expected = fs.readFileSync( path.join( __dirname, 'data', 'decompressed.img' ) )
    var sources = [
      'compression-adc.dmg',
      'compression-bz2.dmg',
      // NOTE: LZFSE not yet supported
      // 'compression-lzfse.dmg',
      'compression-raw.dmg',
      'compression-zlib.dmg',
    ].map( f => path.join( __dirname, 'data', f ) )

    context( 'source image equality', function() {

      sources.forEach(( filename ) => {

        var testName = path.basename( filename, '.dmg' )
          .replace( 'compression-', '' )
          .toUpperCase()

        specify( testName, function( done ) {

          UDIF.getUncompressedSize( filename, ( error, size ) => {
            if( error ) return done( error )
            var actual = Buffer.allocUnsafe( size )
            var offset = 0
            var readStream = UDIF.createReadStream( filename )
              .on( 'error', done )
              // NOTE: This can catch & bubble up read/push after EOD errors,
              // which have previously gone unnoticed
              .pipe( new stream.PassThrough() )
              .on( 'data', ( chunk ) => {
                chunk.copy( actual, offset )
                offset += chunk.length
              })
              .once( 'end', () => {
                assert.ok( expected.equals( actual ) )
                assert.equal( expected.length, size )
                done()
              })
          })

        })

      })

    })

  })

})
