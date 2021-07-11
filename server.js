import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express()

app.enable("trust proxy")
app.use(cors())

const port = 3000

app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]', {
  stream: fs.createWriteStream('./access.log', {flags: 'a'})
}));

app.use(express.static(path.join(__dirname, '/')));

app.use('/static', express.static(path.join(__dirname, '/')));
app.use('/page', function (req, res, next) {
  res.send('OK')
});
app.use('/guid', function (req, res, next) {
  res.send('OK')
});
app.use('/filter', function (req, res, next) {
  res.send('OK')
});


app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
