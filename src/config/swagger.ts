const SwaggerConfig = {
  swaggerDefinition: {
    swagger: '2.0',
    info: {
      title: 'qiibee API',
      version: '1.0.0',
      description: 'qiibee API specification',
      contact: {
        name: 'qiibee',
        url: 'https://qiibee.com',
        email: 'tech@qiibee.com'
      }
    },
    host: 'api.qiibee.com',
    basePath: '/',
    tags: [
      {
        name: 'Transactions'
      },
      {
        name: 'Tokens'
      },
      {
        name: 'Users'
      },
      {
        name: 'Network'
      }
    ],
    schemes: ['https'],
    consumes: ['application/json'],
    produces: ['application/json']
  },
  apis: [
    './src/network/router.js',
    './src/tokens/router.js',
    './src/transactions/router.js',
    './src/users/router.js'
  ]
}

export default SwaggerConfig
