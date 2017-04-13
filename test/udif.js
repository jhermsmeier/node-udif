var assert = require( 'assert' )
var fs = require( 'fs' )
var path = require( 'path' )
var UDIF = require( '..' )
var images = require( './data' )
var inspect = require( './inspect' )

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
        console.log( inspect( image ) )
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
})
