import  winston from 'winston'

const logger = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: `${__dirname}/app.log`,
      handleExceptions: true,
      timestamp: true
    })
  ],
  exitOnError: false
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
    level: 'debug',
    timestamp: true,
    handleExceptions: true
  }))
}

module.exports = logger
