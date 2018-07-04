const Config = {
  production: {
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOSTNAME,
    connectionLimit: 10,
    debug: false
  },
  development: {
    user: 'root',
    password: 'a12345678$X',
    database: 'qiibee',
    host: 'localhost',
    connectionLimit: 2,
    debug: true
  }
}

export default Config
