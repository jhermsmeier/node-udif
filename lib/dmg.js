var fs = require( 'fs' )
var plist = require( 'plist' )

/**
 * Apple Disk Image (DMG)
 * @constructor
 * @return {DMG}
 */
function DMG( path ) {

  if( !(this instanceof DMG) )
    return new DMG( path )

  this.path = path
  this.fd = null

}

/** @constructor Koly block */
DMG.KolyBlock = require( './koly-block' )

/**
 * DMG prototype
 * @type {Object}
 * @ignore
 */
DMG.prototype = {

  constructor: DMG,

  readKolyBlock: function( callback ) {

    var self = this
    var length = DMG.KolyBlock.size
    var buffer = new Buffer( length )

    buffer.fill(0)

    fs.fstat( self.fd, function( error, stats ) {
      if( error ) return callback.call( self, error )
      var position = stats.size - DMG.KolyBlock.size
      fs.read( self.fd, buffer, 0, length, position, function( error, bytesRead, buffer ) {
        if( error ) return callback.call( self, error )
        self.kolyBlock = DMG.KolyBlock.parse( buffer )
        callback.call( self, null, self.kolyBlock )
      })
    })

  },

  readPropertyList: function( callback ) {

    if( this.kolyBlock == null )
      return callback.call( this, new Error( 'Must read koly block first' ) )

    var self = this
    var length = this.kolyBlock.xmlLength
    var position = this.kolyBlock.xmlOffset
    var buffer = new Buffer( length )

    fs.read( self.fd, buffer, 0, length, position, function( error, bytesRead, buffer ) {
      if( error ) return callback.call( self, error )
      self.plist = plist.parse( buffer.toString() )
      callback.call( self, null, self.plist )
    })

  },

  open: function( callback ) {

    var self = this

    fs.open( this.path, 'r', function( error, fd ) {
      self.fd = fd
      callback.call( self, error )
    })

    return this

  },

  close: function( callback ) {

    if( this.fd == null )
      return callback.call( this )

    var self = this

    fs.close( this.fd, function( error ) {
      callback.call( self, error )
    })

    return this

  },

}

// Exports
module.exports = DMG
