import express from "express"
import User from "../models/User.js"
import jwt from "jsonwebtoken"
import { protect } from "../middleware/authMiddleware.js"

const router = express.Router()

// NEW: Log all requests hitting this router
router.use((req, res, next) => {
  console.log(`[AuthRoutes] Request received: ${req.method} ${req.path}`)
  next()
})

// Helper function to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1h", // Token expires in 1 hour
  })
}

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
router.post("/register", async (req, res) => {
  console.log("[AuthRoutes] Handling /register POST request") // NEW: Specific log for register
  const { username, email, password } = req.body

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: "Please enter all fields" })
  }

  // Check if user exists
  const userExists = await User.findOne({ $or: [{ email }, { username }] })
  if (userExists) {
    return res.status(400).json({ success: false, error: "User with that email or username already exists" })
  }

  try {
    const user = await User.create({
      username,
      email,
      password,
    })

    if (user) {
      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          _id: user._id,
          username: user.username,
          email: user.email,
          token: generateToken(user._id),
        },
      })
    } else {
      res.status(400).json({ success: false, error: "Invalid user data" })
    }
  } catch (error) {
    console.error("Error during user registration:", error)
    res.status(500).json({ success: false, error: "Server error during registration" })
  }
})

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
router.post("/login", async (req, res) => {
  console.log("[AuthRoutes] Handling /login POST request") // NEW: Specific log for login
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Please enter all fields" })
  }

  try {
    // Check for user email
    const user = await User.findOne({ email })

    if (user && (await user.matchPassword(password))) {
      // Update lastLogin timestamp
      user.lastLogin = new Date()
      await user.save()

      res.json({
        success: true,
        message: "Logged in successfully",
        data: {
          _id: user._id,
          username: user.username,
          email: user.email,
          token: generateToken(user._id),
        },
      })
    } else {
      res.status(401).json({ success: false, error: "Invalid credentials" })
    }
  } catch (error) {
    console.error("Error during user login:", error)
    res.status(500).json({ success: false, error: "Server error during login" })
  }
})

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
router.get("/me", protect, async (req, res) => {
  console.log("[AuthRoutes] Handling /me GET request") // NEW: Specific log for profile
  // req.user is set by the protect middleware
  res.json({
    success: true,
    message: "User profile retrieved",
    data: {
      _id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      joinDate: req.user.joinDate,
      lastLogin: req.user.lastLogin,
    },
  })
})

export default router
