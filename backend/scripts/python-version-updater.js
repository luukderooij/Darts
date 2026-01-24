const stringifyPackage = require('stringify-package')
const detectIndent = require('detect-indent')
const detectNewline = require('detect-newline')

module.exports.readVersion = function (contents) {
  // Reads __version__ = "0.0.1"
  return contents.match(/__version__\s*=\s*"(.+?)"/)[1]
}

module.exports.writeVersion = function (contents, version) {
  // Replaces the version number
  return contents.replace(
    /(__version__\s*=\s*")(.+?)(")/,
    `$1${version}$3`
  )
}