/* eslint-disable no-console */
import express from 'express'
import pretty from 'express-prettify'
import cors from 'cors'
import bodyParser from 'body-parser'
// import * as logger from 'morgan'

import swaggerUi from 'swagger-ui-express'
import swaggerJSDoc from 'swagger-jsdoc'

import Config from './src/config'

import networkRouter from './src/network/router'
import transactionsRouter from './src/transactions/router'
import tokensRouter from './src/tokens/router'
import usersRouter from './src/users/router'

const app = express(),
      port = process.env.PORT || Config.getPort(),
      swaggerSpec = swaggerJSDoc(Config.getSwaggerConfig())

// app.use(Config.getEnv() === 'development' ? logger('dev') : logger('combined'));
app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(pretty({ query: 'pretty' }))

app.use('/net', networkRouter)
app.use('/transactions', transactionsRouter)
app.use('/tokens', tokensRouter)
app.use('/users', usersRouter)
app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  )
  res.header(
    'Access-Control-Allow-Methods',
    'GET,PUT,PATCH,POST,DELETE,OPTIONS'
  )
  res.header(
    'Access-Control-Allow-Headers',
    'X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )
  res.header('Access-Control-Allow-Credentials', true)
  res.removeHeader('X-Powered-By')
  next()
})

/* eslint-disable-next-line consistent-return */
app.use((err, req, res, next) => {
  if (err) {
    return res
      .status(err.status || 400)
      .json({ message: err.message, code: err.code || err.status || 400 })
  }

  res.setHeader('Content-Type', 'application/json')
  res.header('Access-Control-Allow-Origin', '*')
  res.header(
    'Access-Control-Allow-Methods',
    'GET,PUT,PATCH,POST,DELETE,OPTIONS'
  )
  res.header(
    'Access-Control-Allow-Headers',
    'X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )
  res.header('Access-Control-Allow-Credentials', true)
  next()
})

app.use((req, res, next) => {
  res.removeHeader('X-Powered-By')
  res.removeHeader('Access-Control-Allow-Headers')
  next()
})

app.listen(port)

console.log(
  `Running API in ${  Config.getEnv()  }mode. Listening on port: ${  port}`
)
