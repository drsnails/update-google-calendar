import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

let port = 3030
fs.readFile('credentials.json', (err, content) => {
    if (err) {
        console.error('Error loading credentials file:', err)
    } else {
        const credentials = JSON.parse(content)
        port = credentials.installed.port || port
    }

    app.use(express.static(path.join(__dirname, 'open-url-localhost')))

    app.listen(port, () => {
        console.log(`Server is running at http://localhost:${port}`)
    })
})