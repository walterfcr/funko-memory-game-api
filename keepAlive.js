import mongoose from "mongoose"
import dotenv from "dotenv"

dotenv.config()

const uri = process.env.MONGODB_URI

const connectDB = async () => {
  try {
    await mongoose.connect(uri, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    })
    console.log("✅ MongoDB connected for keep-alive ping")
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err)
  }
}

// Ping function
const pingDB = async () => {
  try {
    await mongoose.connection.db.command({ ping: 1 })
    console.log("🏓 Pinged MongoDB at", new Date().toLocaleTimeString())
  } catch (err) {
    console.error("❌ Ping failed:", err)
  }
}

const start = async () => {
  await connectDB()

  // Ping every 5 minutes (300000 ms)
  setInterval(pingDB, 300000)
}

start()
