import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import connectDB from "./config/database.js"
import gameRoutes from "./routes/gameRoutes.js"
import mongoose from "mongoose"

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3002

// Connect to MongoDB
connectDB()

// Middleware
app.use(cors({
  origin: ["https://your-frontend-domain.vercel.app"], // your actual frontend URL here
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

app.use(express.json()) // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })) // Parse URL-encoded bodies

// Basic logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// Routes
app.use("/api", gameRoutes)

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "🎮 Funko Memory Game MongoDB API is running!",
    database: "MongoDB Connected",
    version: "2.0.0",
    endpoints: [
      "GET /api/categories - Get all game categories",
      "GET /api/difficulties - Get all difficulty levels",
      "GET /api/scores - Get all scores from MongoDB",
      "POST /api/scores - Submit a new score to MongoDB",
    ],
    timestamp: new Date().toISOString(),
  })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err)
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong!",
  })
})

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🔄 Shutting down gracefully...")
  await mongoose.connection.close()
  console.log("✅ MongoDB connection closed")
  process.exit(0)
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Funko Memory Game MongoDB API running on http://localhost:${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/`)
  console.log(`🏆 Scores: http://localhost:${PORT}/api/scores`)
})

export default app