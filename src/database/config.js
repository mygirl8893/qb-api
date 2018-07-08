const Config = {
  production: {
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOSTNAME,
    connectionLimit: process.env.DB_CONNECTION_LIMIT,
    debug: false
  },
  development: {
    user: 'root',
    password: 'a12345678$X',
    database: 'qiibee',
    host: 'localhost',
    connectionLimit: 3,
    debug: true
  }
}

export default Config
