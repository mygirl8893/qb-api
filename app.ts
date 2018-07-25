import * as express from 'express'
import * as pretty from 'express-prettify'
import * as cors from 'cors'
import * as bodyParser from 'body-parser'

import * as swaggerUi from 'swagger-ui-express'
import *  as swaggerJSDoc from 'swagger-jsdoc'
import * as morgan from 'morgan'

import Config from './src/config'

import networkRouter from './src/network/router'
import transactionsRouter from './src/transactions/router'
import tokensRouter from './src/tokens/router'
import usersRouter from './src/users/router'
import log from './src/logging'

const app = express(),
  swaggerSpec = swaggerJSDoc(Config.getSwaggerConfig())

app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(pretty({ query: 'pretty' }))


class WinstonStream {
  write(message: string) {
    log.info(message)
  }
}

const winstonStream = new WinstonStream()

app.use(morgan("combined", { "stream": winstonStream }))

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

app.use((err, req, res, next) => {
  if (err) {
    log.error(`Request failed with error ${err}`)
    return res
      .status(err.status || 400)
      .json({ message: err.message})
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

export default app
