import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = 3030

app.use(express.static(path.join(__dirname, 'open-url-localhost')))

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`)
})