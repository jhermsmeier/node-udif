var fs = require( 'fs' )
var path = require( 'path' )
var util = require( 'util' )
var UDIF = require( '..' )

var argv = process.argv.slice(2)
var filename = argv[0]

function mb( bytes ) {
  return `${( bytes / 1024 / 1024 ).toFixed(1)} MB`
}

function inspect( value ) {
  return util.inspect( value, {
    depth: null, colors: process.stdout.isTTY,
  })
}

var image = new UDIF.Image( filename )
var ESC = '\u001b['
var CURSOR_UP = ESC + '2A'
var CURSOR_LEFT = ESC + '1000D'
var ERASE_LINE = ESC + '2K'
var ERASELINE = CURSOR_UP + CURSOR_LEFT + ERASE_LINE

image.open(( error ) => {
  if( error ) throw error
  console.log( inspect( image ) )
  process.stdout.write( '\n\n' )
  console.log( '  compressed size:', mb(image.footer.dataForkLength) )
  console.log( 'uncompressed size:', mb(image.getUncompressedSize()) )
  process.stdout.write( '\n' )
  image.close(( error ) => {
    if( error ) throw error
    var start = Date.now()
    var first = true
    UDIF.createSparseReadStream( filename )
      .on( 'end', function() {
        process.stdout.write( `Done.\n` )
      })
      .on( 'readable', function() {
        while( this.read() ) continue
        var time = ( Date.now() - start ) / 1000
        if( first ) {
          process.stdout.write( '\n\n' )
          first = false
        }
        process.stdout.write( ERASELINE )
        process.stdout.write( `Bytes read: ${mb(this.bytesRead)} (${mb((this.bytesRead/time)|0)}/s)\n` )
        process.stdout.write( `Bytes written: ${mb(this.bytesWritten)} (${mb((this.bytesWritten/time)|0)}/s)\n` )
      })
  })
})
