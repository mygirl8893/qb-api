import * as winston from 'winston'

const logger = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: `${__dirname}/app.log`,
      handleExceptions: true
    })
  ],
  exitOnError: false
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
    level: 'debug',
    handleExceptions: true
  }))
} else {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
    level: 'info',
    handleExceptions: true
  }))
}

export default logger
