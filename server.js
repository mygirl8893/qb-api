import app from './app'
import Config from './src/config'

const port = process.env.PORT || Config.getPort()

app.listen(port)

console.log(`Running API in ${Config.getEnv()} mode. Listening on port: ${port}`)
