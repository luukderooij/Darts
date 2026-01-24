const stringifyPackage = require('stringify-package')
const detectIndent = require('detect-indent')
const detectNewline = require('detect-newline')

module.exports.readVersion = function (contents) {
  // Finds the line: __version__ = "1.0.0" and extracts the number
  return contents.match(/__version__\s*=\s*"(.+?)"/)[1]
}

module.exports.writeVersion = function (contents, version) {
  // Replaces the old number with the new one
  return contents.replace(
    /(__version__\s*=\s*")(.+?)(")/,
    `$1${version}$3`
  )
}