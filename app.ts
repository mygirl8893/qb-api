import * as bodyParser from 'body-parser'
import * as cors from 'cors'
import * as express from 'express'
import * as pretty from 'express-prettify'

import * as httpContext from 'express-http-context'
import * as HttpStatus from 'http-status-codes'
import * as morgan from 'morgan'
import * as swaggerJSDoc from 'swagger-jsdoc'
import * as swaggerUi from 'swagger-ui-express'
import * as uuid from 'uuid'

import Config from './src/config'

import addressesRouter from './src/addresses/router'
import appRouter from './src/app/router'
import networkRouter from './src/network/router'
import pricesRouter from './src/prices/router'
import tokensRouter from './src/tokens/router'
import transactionsRouter from './src/transactions/router'
import usersRouter from './src/users/router'

import log from './src/logging'

const app = express()
const swaggerSpec = swaggerJSDoc(Config.getSwaggerConfig())

app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(pretty({ query: 'pretty' }))

app.use(httpContext.middleware)
// Run the context for each request. Assign a unique identifier to each request
app.use((req, res, next) => {
  httpContext.set('reqId', uuid.v1())
  next()
})

class WinstonStream {
  public write(message: string) {
    log.info(message)
  }
}
const winstonStream = new WinstonStream()
app.use(morgan('combined', { stream: winstonStream }))

app.use('/net', networkRouter)
app.use('/transactions', transactionsRouter)
app.use('/tokens', tokensRouter)
app.use('/users', usersRouter)
app.use('/prices', pricesRouter)
app.use('/addresses', addressesRouter)
app.use('/app', appRouter)
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
  if (res.headersSent) {
    return next(err)
  }

  if (err) {
    log.error(`Request failed with error ${err.stack}`)
    return res
      .status(err.status || HttpStatus.INTERNAL_SERVER_ERROR)
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
