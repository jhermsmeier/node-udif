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

    if( error ) {
      throw error
    }

    var start = Date.now()
    var time = 0

    var readable = UDIF.createSparseReadStream( filename )

    function tick() {
      process.stdout.write( `${ERASELINE}Bytes read: ${mb(readable.bytesRead)} (${mb((readable.bytesRead/time)|0)}/s)
Bytes written: ${mb(readable.bytesWritten)} (${mb((readable.bytesWritten/time)|0)}/s)\n` )
    }

    var timer = setInterval( tick, 250 )

    readable.on( 'end', function() {
      process.stdout.write( `Done.\n` )
      clearInterval( timer )
    }).on( 'readable', function() {
      time = ( Date.now() - start ) / 1000
      while( this.read() ) {
        continue
      }
    })

    process.stdout.write( '\n\n' )
    tick()

  })
})
