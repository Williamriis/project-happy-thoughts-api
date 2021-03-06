import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/happyThoughts"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

/*The following line of code is to avoid deprecation warning when using findOneAndUpdate, which I use for the
likes as in contrast to updateOne it also returns the updated object. */
mongoose.set('useFindAndModify', false)

// Defines the port the app will run on. Defaults to 8080, but can be 
// overridden when starting the server. For example:
//
//   PORT=9000 npm start
const port = process.env.PORT || 8080
const app = express()



// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(bodyParser.json())

const Thought = mongoose.model('Thought', {
  message: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 140
  },
  hearts: {
    type: Number,
    default: 0
  },
  createdAt: {
    /*I made this a number instead of a date because type: date would convert the Date.now string into
    a date which was behaving erratically with react moment on my frontend. */
    type: Number

  },
  postedBy: {
    type: String,
    default: 'Anonymous',
    maxlength: 20
  },
  theme: {
    type: String,
    default: ''
  }

})

if (process.env.RESET_DB) {
  const reset = async () => {
    await Thought.deleteMany()

  }
  reset()
}

// Start defining your routes here


app.get('/', async (req, res) => {
  const PAGE_SIZE = 20;
  const page = req.query.page || 1
  const order = req.query.order
  const userTheme = req.query.theme ? { theme: req.query.theme } : {}
  const myOrder = order === 'mostliked' ? { hearts: -1 } : order === 'oldest' ? { createdAt: 1 } : { createdAt: -1 }
  const allThoughts = await Thought.find()
  const thoughts = await Thought.find(userTheme).sort(myOrder).limit(PAGE_SIZE).skip((page * PAGE_SIZE) - PAGE_SIZE)
  res.json({ thoughts: thoughts, length: Math.ceil(allThoughts.length / PAGE_SIZE) })

})

app.post('/', async (req, res) => {
  try {
    const userRegExp = req.body.message.match(/~.*/i)
    const username = userRegExp ? userRegExp.toString().substr(1, 20) : null
    const newThought = await new Thought({
      message: req.body.message.replace(/~(.*)/i, ''),
      postedBy: username || 'Anonymous',
      createdAt: Date.now(),
      theme: req.body.theme || ''
    }).save()
    //I return the whole list of thoughts below because if I only return the new thought and add it to the existing state locally
    //it allows more than the number of thoughts defined in PAGE_SIZE to be displayed simultaneously. 
    const PAGE_SIZE = 20;
    const page = req.query.page || 1
    const order = req.query.order
    const myOrder = order === 'mostliked' ? { hearts: -1 } : order === 'oldest' ? { createdAt: 1 } : { createdAt: -1 }
    const allThoughts = await Thought.find()
    const thoughts = await Thought.find().sort(myOrder).limit(PAGE_SIZE).skip((page * PAGE_SIZE) - PAGE_SIZE)
    res.status(200).json({ thoughts: thoughts, length: Math.ceil(allThoughts.length / PAGE_SIZE) })

  } catch (err) {
    res.status(400).json({
      message: 'Could not save thought', error: err.message
    })
  }
})

app.post('/:thoughtId/like', async (req, res) => {
  try {
    const likedThought = await Thought.findOneAndUpdate({ _id: req.params.thoughtId }, { $inc: { hearts: 1 } }, { new: true })
    res.json(likedThought)

  } catch (err) {
    res.status(400).json({ error: 'Thought not found.' })
  }
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
