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
      },
      {
        name: 'Prices'
      }
    ],
    schemes: ['https'],
    consumes: ['application/json'],
    produces: ['application/json']
  },
  apis: [
    './src/network/router.ts',
    './src/tokens/router.ts',
    './src/transactions/router.ts',
    './src/users/router.ts',
    './src/prices/router.ts'
  ]
}

export default SwaggerConfig
