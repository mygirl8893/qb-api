import app from './app'
import Config from './src/config'
import log from './src/logging'

const port = process.env.PORT || Config.getPort()

app.listen(port)

log.info(`Running API in ${Config.getEnv()} mode. Listening on port: ${port}`)
