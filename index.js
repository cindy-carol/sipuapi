const express = require('express')
const userRouter = require(./users)
const app = express()
const port = 3000

app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

app.route('/book')
  .get((req, res) => {
    res.send('Get a random book')
  })
  .post((req, res) => {
    res.send('Add a book')
  })
  .put((req, res) => {
    res.send('Update the book')
  })

app.put('/user/:id', (req, res) => {
  const id = request.params
  response.send(id)
})

app.delete('/user', (req, res) => {
  res.send('Got a DELETE request at /user')
})

app.use(userRouter)

app.listen(port, () => {
  console.log(`Testing Routing`)
})
