'use strict'

exports.asyncForEach = async function(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}

exports.wrapAsync = function(fn) {
  return function(req, res, next) {
    fn(req, res, next).catch(next)
  }
}
