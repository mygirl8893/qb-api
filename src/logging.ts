import * as winston from 'winston'
import * as httpContext from 'express-http-context'

const requestIdFormat = winston.format((info, opts) => {
  const reqId = httpContext.get('reqId')
  info.reqId = reqId
  return info
})

const logger = winston.createLogger({
  format: winston.format.combine(winston.format.simple(), winston.format.timestamp(), requestIdFormat()),
  transports: [
    new winston.transports.File({
      filename: `${__dirname}/app.log`,
      handleExceptions: true,
      level: 'info',
    }),
  ],
  exitOnError: false
})

if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(winston.format.simple(), winston.format.timestamp()),
    level: 'debug',
    handleExceptions: true
  }))
} else {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(winston.format.simple(), winston.format.timestamp()),
    level: 'info',
    handleExceptions: true
  }))
}

export default logger
