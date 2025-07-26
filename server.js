import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import connectDB from "./config/database.js"
import gameRoutes from "./routes/gameRoutes.js"
import authRoutes from "./routes/authRoutes.js" // Import the new auth routes
import mongoose from "mongoose"

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3002

// Connect to MongoDB
connectDB()

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000", // Common React dev server port
      "http://localhost:5173", // Common Vite dev server port
      "https://memory-game-react-cyan.vercel.app", // Your specific Vercel production URL
      "https://*.vercel.app", // Allow all Vercel preview deployments
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Ensure OPTIONS is allowed for preflight requests
    credentials: true,
  }),
)

app.use(express.json({ limit: "10mb" })) // Parse JSON request bodies with a limit
app.use(express.urlencoded({ extended: true, limit: "10mb" })) // Parse URL-encoded bodies with a limit

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("X-XSS-Protection", "1; mode=block")
  next()
})

// Request logging (only in development)
if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
    next()
  })
}

// Routes
app.use("/api", gameRoutes)
app.use("/api/auth", authRoutes) // Use the new authentication routes - THIS IS CRUCIAL

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "🎮 Funko Memory Game MongoDB API is running!",
    database: "MongoDB Connected",
    version: "2.0.0",
    environment: process.env.NODE_ENV || "development",
    endpoints: [
      "GET /api/categories - Get all game categories",
      "GET /api/difficulties - Get all difficulty levels",
      "GET /api/scores - Get all scores from MongoDB",
      "POST /api/scores - Submit a new score to MongoDB",
      "POST /api/auth/register - Register a new user", // New endpoint
      "POST /api/auth/login - Login a user", // New endpoint
      "GET /api/auth/me - Get authenticated user profile (protected)", // New endpoint
    ],
    timestamp: new Date().toISOString(),
  })
})

// 404 handler - This catches requests that don't match any above routes
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

process.on("SIGTERM", async () => {
  console.log("\n🔄 Received SIGTERM, shutting down gracefully...")
  await mongoose.connection.close()
  console.log("✅ MongoDB connection closed")
  process.exit(0)
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Funko Memory Game MongoDB API running on port ${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`)
  if (process.env.NODE_ENV === "development") {
    console.log(`📊 Health check: http://localhost:${PORT}/`)
    console.log(`🏆 Scores: http://localhost:${PORT}/api/scores`)
  }
})

export default app
