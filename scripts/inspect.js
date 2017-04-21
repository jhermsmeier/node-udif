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

var image = new UDIF.Image( filename )

image.open(( error ) => {
  if( error ) throw error
  console.log( inspect( image ) )
  image.close(( error ) => {
    if( error ) throw error
    var start = Date.now()
  })
})
