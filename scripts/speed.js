var fs = require( 'fs' )
var path = require( 'path' )
var util = require( 'util' )
var UDIF = require( '..' )

var argv = process.argv.slice(2)
var filename = argv[0]

function bytes( value, precision = 2 ) {
  // Avoid negative values
  value = Math.abs( value )
  // Determine the order of magnitude
  var order = Math.round( Math.log2( value ) / 10 )
  // Bound the order and guard against NaN
  order = Math.max( 0, Math.min( order, bytes.units.length - 1 ) ) || 0
  // Factor the value
  value = value / Math.pow( 1024, order )
  // Format
  return `${value.toFixed(precision)} ${bytes.units[order]}`
}

bytes.units = 'B,KB,MB,GB,TB,PB,EB,ZB,YB'.split(',')

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
  console.log( '  compressed size:', bytes(image.footer.dataForkLength) )
  console.log( 'uncompressed size:', bytes(image.getUncompressedSize()) )
  process.stdout.write( '\n' )
  image.close(( error ) => {
    if( error ) throw error
    var start = Date.now()
    var first = true
    UDIF.createReadStream( filename )
      .on( 'data', function() {
        var time = ( Date.now() - start ) / 1000
        if( first ) {
          process.stdout.write( '\n\n' )
          first = false
        }
        process.stdout.write( ERASELINE )
        process.stdout.write( `Bytes read: ${bytes(this.bytesRead)} (${bytes((this.bytesRead/time)|0)}/s)\n` )
        process.stdout.write( `Bytes written: ${bytes(this.bytesWritten)} (${bytes((this.bytesWritten/time)|0)}/s)\n` )
      })
      .on( 'end', function() {
        process.stdout.write( `Done.\n` )
      })
      .on( 'readable', function() {
        while( this.read() ) continue
      })
  })
})
