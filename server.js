const config = require('./config').getConfig
var express = require('express')
var bodyParser = require('body-parser')
var pretty = require('express-prettify')
var swaggerJSDoc = require('swagger-jsdoc')
var cors = require('cors')
var minimist = require('minimist')

const swaggerUi = require('swagger-ui-express')
const path = require('path')
const fs = require('fs')
const app = express(),
  port = process.env.PORT || 80

var swaggerSpec = swaggerJSDoc(config.swagger)

app.use(function(req, res, next) {
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

app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(pretty({ query: 'pretty' }))

var routes = require('./api/routes/routes')

routes(app)

app.use((err, req, res, next) => {
  if (err)
    return res
      .status(err.status || 400)
      .json({ message: err.message, code: err.code || err.status || 400 })

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

app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.listen(port)