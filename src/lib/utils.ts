/**
 * Wrapper for router handlers to pass the errors correctly to the express framework
 * Extracted from the following techincal article
 * https://strongloop.com/strongblog/async-error-handling-expressjs-es7-promises-generators/
 * @param Promise
 * @returns {function(...[*]): *}
 */
const wrap = (fn) => (...args) => fn(...args).catch(args[2])

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export default {
  wrap,
  sleep
}
