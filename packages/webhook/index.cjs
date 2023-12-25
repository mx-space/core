const express = require('express')
const { createHandler, BusinessEvents } = require('./dist/index.cjs')
const app = express()

app.use(express.json())

const handler = createHandler({ secret: 'test' })
app.post('/webhook', (req, res) => {
  handler(req, res)
})
handler.emitter.on(BusinessEvents.POST_UPDATE, (event) => {
  console.log(event)
})

app.listen('13333')
