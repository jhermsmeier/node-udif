var { context, test } = require( '@jhermsmeier/control' )
var assert = require( 'assert' )
var fs = require( 'fs' )
var path = require( 'path' )
var stream = require( 'stream' )
var UDIF = require( '..' )
var images = require( './data' )

const DATADIR = path.join( __dirname, 'data' )

context( 'UDIF.getUncompressedSize()', function() {
  images.forEach( function( data ) {
    test( data.filename, function( done ) {
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

      test( 'new UDIF.Image()', function() {
        image = new UDIF.Image( filename )
      })

      test( 'image.open()', function( done ) {
        image.open( done )
      })

      test( 'image.footer.dataForkLength', function() {
        assert.equal( image.footer.dataForkLength, data.dataForkLength )
      })

      test( 'image.getUncompressedSize()', function() {
        assert.equal( image.getUncompressedSize(), data.uncompressedSize )
      })

      test( 'image.verifyData()', function( done ) {
        image.verifyData( function( error, verified ) {
          if( !error ) {
            assert.strictEqual( verified, true )
          }
          done()
        })
      })

      test( 'image.close()', function( done ) {
        image.close( done )
      })

    })
  })
})
context( 'UDIF.ReadStream', function() {
  images.forEach( function( data ) {
    context( data.filename, function() {

      test( 'read & decompress image', function( done ) {

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

      test( 'stream an already opened image', function( done ) {

        var image = new UDIF.Image( path.join( DATADIR, data.filename ) )
        var bytesRead = 0

        image.open( function(error, fd) {

          if( error ) {
            return done( error )
          }

          image.createReadStream()
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

      })

      test( 'can close while reading', function( done ) {

        UDIF.createReadStream( path.join( DATADIR, data.filename ) )
          .on( 'error', done )
          .on( 'data', function( chunk ) {
            this.close()
          })
          .on( 'close', function() {
            done()
          })

      })

      test( 'can destroy while reading', function( done ) {

        UDIF.createReadStream( path.join( DATADIR, data.filename ) )
          .on( 'error', done )
          .on( 'data', function( chunk ) {
            this.destroy()
          })
          .on( 'close', done )

      })

    })
  })

  context( 'Compression Methods', function() {

    var expected = fs.readFileSync( path.join( DATADIR, 'decompressed.img' ) )
    var sources = [
      'compression-adc.dmg',
      'compression-bz2.dmg',
      // NOTE: LZFSE not yet supported
      // 'compression-lzfse.dmg',
      'compression-raw.dmg',
      'compression-zlib.dmg',
    ].map( f => path.join( DATADIR, f ) )

    context( 'source image equality', function() {

      sources.forEach(( filename ) => {

        var testName = path.basename( filename, '.dmg' )
          .replace( 'compression-', '' )
          .toUpperCase()

        test( testName, function( done ) {

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

context( 'UDIF.SparseReadStream', function() {

  images.forEach( function( data ) {
    context( data.filename, function() {

      test( 'read & decompress image', function( done ) {

        var bytesRead = 0

        UDIF.createSparseReadStream( path.join( DATADIR, data.filename ) )
          .on( 'error', done )
          .on( 'data', function( block ) {
            bytesRead += block.buffer.length
            block = null
          })
          .on( 'end', function() {
            assert.equal( bytesRead, data.mappedSize )
            done()
          })

      })

      test( 'stream an already opened image', function( done ) {

        var image = new UDIF.Image( path.join( DATADIR, data.filename ) )
        var bytesRead = 0

        image.open( function(error, fd) {

          if( error ) {
            return done( error )
          }

          image.createSparseReadStream()
            .on( 'error', done )
            .on( 'data', function( block ) {
              bytesRead += block.buffer.length
              block = null
            })
            .on( 'end', function() {
              assert.equal( bytesRead, data.mappedSize )
              done()
            })

        })

      })

      test( 'can close while reading', function( done ) {

        UDIF.createSparseReadStream( path.join( DATADIR, data.filename ) )
          .on( 'error', done )
          .on( 'data', function( block ) {
            this.close()
          })
          .on( 'close', function() {
            done()
          })

      })

      test( 'can destroy while reading', function( done ) {

        UDIF.createSparseReadStream( path.join( DATADIR, data.filename ) )
          .on( 'error', done )
          .on( 'data', function( block ) {
            this.destroy()
          })
          .on( 'close', done )

      })

    })
  })

  context( 'Compression Methods', function() {

    var expected = fs.readFileSync( path.join( DATADIR, 'decompressed.img' ) )
    var sources = [
      'compression-adc.dmg',
      'compression-bz2.dmg',
      // NOTE: LZFSE not yet supported
      // 'compression-lzfse.dmg',
      'compression-raw.dmg',
      'compression-zlib.dmg',
    ].map( f => path.join( DATADIR, f ) )

    context( 'source image equality', function() {

      sources.forEach(( filename ) => {

        var testName = path.basename( filename, '.dmg' )
          .replace( 'compression-', '' )
          .toUpperCase()

        test( testName, function( done ) {

          UDIF.getUncompressedSize( filename, ( error, size ) => {
            if( error ) return done( error )
            var actual = Buffer.alloc( size )
            var chunkCount = 0
            var readStream = UDIF.createSparseReadStream( filename )
              .on( 'error', done )
              // NOTE: This can catch & bubble up read/push after EOD errors,
              // which have previously gone unnoticed
              .pipe( new stream.PassThrough({ objectMode: true }) )
              .on( 'data', ( chunk ) => {
                chunk.buffer.copy( actual, chunk.position )
                chunkCount++
              })
              .once( 'end', () => {
                // assert.equal( chunkCount, 0 )
                assert.ok( expected.equals( actual ), 'Buffer equality' )
                assert.equal( expected.length, size )
                done()
              })
          })

        })

      })

    })

  })

})
