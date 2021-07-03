import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import morgan from 'morgan';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express()

app.enable("trust proxy")

const port = 3000

app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]', {
  stream: fs.createWriteStream('./access.log', {flags: 'a'})
}));

app.use(express.static(path.join(__dirname, '/')));

app.use('/static', express.static(path.join(__dirname, '/')));

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
