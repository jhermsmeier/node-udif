var fs = require( 'fs' )
var path = require( 'path' )
var util = require( 'util' )
var UDIF = require( '..' )

var argv = process.argv.slice(2)
var filename = argv[0]

function inspect( value ) {
  return util.inspect( value, {
    depth: null, colors: process.stdout.isTTY,
  })
}

var stats = fs.statSync( filename )
var fd = fs.openSync( filename, 'r' )
var buffer = Buffer.alloc( UDIF.Footer.SIZE )
var offset = 0
var position = stats.size - 512

fs.readSync( fd, buffer, offset, buffer.length, position )

var footer = UDIF.Footer.parse( buffer )

// console.error( inspect( footer ) )

var xmlBuffer = Buffer.alloc( footer.xmlLength )

fs.readSync( fd, xmlBuffer, offset, xmlBuffer.length, footer.xmlOffset )

process.stdout.write( xmlBuffer )

fs.closeSync( fd )
