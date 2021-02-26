const http = require('http')
const fs = require('fs')

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' })
  fs.createReadStream('index.html').pipe(res)
  fs.createReadStream('style.css').pipe(res)
  fs.createReadStream('script.js').pipe(res)
})

server.listen(process.env.PORT || 3000)
