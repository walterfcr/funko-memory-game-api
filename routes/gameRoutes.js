import express from "express"
import Score from "../models/Score.js"
import { protect } from "../middleware/authMiddleware.js"

const router = express.Router()

// Cache for static data (in production, use Redis)
let categoriesCache = null
let difficultiesCache = null

// Game categories and difficulties
const gameCategories = [
  { id: "heroes", name: "Heroes", description: "Superhero Funko Pops" },
  { id: "movies", name: "Movies", description: "Movie character Funko Pops" },
  { id: "musicians", name: "Musicians", description: "Music artist Funko Pops" },
  { id: "videogames", name: "Video Games", description: "Video game character Funko Pops" },
]

const gameDifficulties = [
  { id: "easy", name: "Easy", description: "Perfect for beginners" },
  { id: "medium", name: "Medium", description: "Good challenge" },
  { id: "hard", name: "Hard", description: "For experts" },
]

// GET /api/categories - Get all categories (cached)
router.get("/categories", (req, res) => {
  try {
    if (!categoriesCache) {
      categoriesCache = {
        success: true,
        data: gameCategories,
        count: gameCategories.length,
        message: "Game categories retrieved successfully",
        cached: true,
      }
    }

    res.set("Cache-Control", "public, max-age=3600") // Cache for 1 hour
    res.json(categoriesCache)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch categories",
    })
  }
})

// GET /api/difficulties - Get all difficulties (cached)
router.get("/difficulties", (req, res) => {
  try {
    if (!difficultiesCache) {
      difficultiesCache = {
        success: true,
        data: gameDifficulties,
        count: gameDifficulties.length,
        message: "Difficulty levels retrieved successfully",
        cached: true,
      }
    }

    res.set("Cache-Control", "public, max-age=3600") // Cache for 1 hour
    res.json(difficultiesCache)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch difficulties",
    })
  }
})

// GET /api/scores - Get all scores from MongoDB (with caching)
router.get("/scores", async (req, res) => {
  try {
    const { category, difficulty, limit = 50, page = 1 } = req.query
    const limitNum = Math.min(Number.parseInt(limit), 100) // Max 100 results
    const skip = (Number.parseInt(page) - 1) * limitNum

    // Build filter object
    const filter = {}
    if (category && category !== "all") {
      filter.category = category
    }
    if (difficulty && difficulty !== "all") {
      filter.difficulty = difficulty
    }

    // Get scores from MongoDB with optimized query
    const scores = await Score.find(filter)
      .sort({ time: 1, moves: 1 }) // Use indexed fields for sorting
      .limit(limitNum)
      .skip(skip)
      .lean() // Returns plain JavaScript objects (faster)
      .select("playerName category difficulty time moves date createdAt") // Only select needed fields

    // Get total count for pagination
    const totalCount = await Score.countDocuments(filter)

    // Format the response
    const formattedScores = scores.map((score) => ({
      id: score._id,
      playerName: score.playerName,
      category: score.category,
      difficulty: score.difficulty,
      time: score.time,
      moves: score.moves,
      date: score.date.toISOString().split("T")[0],
    }))

    // Set cache headers
    res.set("Cache-Control", "public, max-age=300") // Cache for 5 minutes

    res.json({
      success: true,
      data: formattedScores,
      count: formattedScores.length,
      totalCount,
      page: Number.parseInt(page),
      totalPages: Math.ceil(totalCount / limitNum),
      message: `Scores retrieved from MongoDB successfully`,
      filters: { category, difficulty, limit: limitNum },
    })
  } catch (error) {
    console.error("Error fetching scores:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch scores from database",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
})

// NEW ROUTE: GET /api/scores/me - Get scores for the authenticated user
router.get("/scores/me", protect, async (req, res) => {
  try {
    const userId = req.user._id // Get userId from the authenticated user
    const { category, difficulty, limit = 50, page = 1 } = req.query
    const limitNum = Math.min(Number.parseInt(limit), 100)
    const skip = (Number.parseInt(page) - 1) * limitNum

    const filter = { userId: userId } // Filter by the authenticated user's ID
    if (category && category !== "all") {
      filter.category = category
    }
    if (difficulty && difficulty !== "all") {
      filter.difficulty = difficulty
    }

    const scores = await Score.find(filter)
      .sort({ time: 1, moves: 1 })
      .limit(limitNum)
      .skip(skip)
      .lean()
      .select("playerName category difficulty time moves date createdAt")

    const totalCount = await Score.countDocuments(filter)

    const formattedScores = scores.map((score) => ({
      id: score._id,
      playerName: score.playerName,
      category: score.category,
      difficulty: score.difficulty,
      time: score.time,
      moves: score.moves,
      date: score.date.toISOString().split("T")[0],
    }))

    res.set("Cache-Control", "private, max-age=60") // Cache for 1 minute (user-specific)

    res.json({
      success: true,
      data: formattedScores,
      count: formattedScores.length,
      totalCount,
      page: Number.parseInt(page),
      totalPages: Math.ceil(totalCount / limitNum),
      message: `User-specific scores retrieved successfully`,
      filters: { category, difficulty, limit: limitNum, userId: userId },
    })
  } catch (error) {
    console.error("Error fetching user scores:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch user scores from database",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
})

// POST /api/scores - Submit a new game score to MongoDB
router.post("/scores", protect, async (req, res) => {
  try {
    const { playerName, category, difficulty, time, moves } = req.body

    // Get userId from the authenticated user (set by 'protect' middleware)
    const userId = req.user._id

    if (process.env.NODE_ENV === "development") {
      console.log("📝 POST /api/scores - RECEIVED SCORE DATA:", req.body)
    }

    // Basic validation
    if (!playerName || !category || !difficulty || time === undefined || moves === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: playerName, category, difficulty, time, moves",
      })
    }

    // Validate ranges
    if (time < 1 || time > 3600) {
      // 1 second to 1 hour
      return res.status(400).json({
        success: false,
        error: "Invalid time value",
      })
    }

    if (moves < 1 || moves > 1000) {
      // Reasonable move limit
      return res.status(400).json({
        success: false,
        error: "Invalid moves value",
      })
    }

    // Validate category exists
    const validCategory = gameCategories.find((cat) => cat.id === category)
    if (!validCategory) {
      return res.status(400).json({
        success: false,
        error: `Invalid category. Valid categories: ${gameCategories.map((c) => c.id).join(", ")}`,
      })
    }

    // Validate difficulty exists
    const validDifficulty = gameDifficulties.find((diff) => diff.id === difficulty)
    if (!validDifficulty) {
      return res.status(400).json({
        success: false,
        error: `Invalid difficulty. Valid difficulties: ${gameDifficulties.map((d) => d.id).join(", ")}`,
      })
    }

    // Check for recent duplicate (optimized query)
    const tenSecondsAgo = new Date(Date.now() - 10000)
    const recentDuplicate = await Score.findOne({
      playerName: { $regex: new RegExp(`^${playerName.trim()}$`, "i") },
      category,
      difficulty,
      createdAt: { $gte: tenSecondsAgo },
      time: { $gte: Number.parseInt(time) - 5, $lte: Number.parseInt(time) + 5 },
      moves: { $gte: Number.parseInt(moves) - 2, $lte: Number.parseInt(moves) + 2 },
    }).lean()

    if (recentDuplicate) {
      if (process.env.NODE_ENV === "development") {
        console.log("🚫 DUPLICATE DETECTED - Rejecting similar score")
      }
      return res.status(409).json({
        success: false,
        error: "Duplicate score detected",
        message: "A very similar score was already submitted recently",
      })
    }

    // Calculate score
    const calculatedScore = Math.max(1000 - (Number.parseInt(time) * 5 + Number.parseInt(moves) * 2), 0)

    // Create new score in MongoDB
    const newScore = new Score({
      playerName: playerName.trim(),
      userId: userId,
      category,
      difficulty,
      time: Number.parseInt(time),
      moves: Number.parseInt(moves),
      score: calculatedScore,
    })

    const savedScore = await newScore.save()

    if (process.env.NODE_ENV === "development") {
      console.log("✅ SCORE SAVED TO MONGODB:", savedScore._id)
    }

    res.status(201).json({
      success: true,
      data: {
        id: savedScore._id,
        playerName: savedScore.playerName,
        userId: savedScore.userId,
        category: savedScore.category,
        difficulty: savedScore.difficulty,
        time: savedScore.time,
        moves: savedScore.moves,
        score: savedScore.score,
        date: savedScore.date.toISOString().split("T")[0],
      },
      message: `Score saved to MongoDB! ${playerName} completed ${category} on ${difficulty} difficulty.`,
    })
  } catch (error) {
    console.error("❌ ERROR SAVING SCORE:", error)
    res.status(500).json({
      success: false,
      error: "Failed to submit score to database",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
})

// GET /api/stats - Get game statistics (cached)
router.get("/stats", async (req, res) => {
  try {
    const stats = await Promise.all([
      Score.countDocuments(),
      Score.distinct("playerName").then((players) => players.length),
      Score.findOne().sort({ time: 1 }).lean(),
      Score.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
    ])

    const [totalGames, totalPlayers, bestScore, categoryStats] = stats

    res.set("Cache-Control", "public, max-age=600") // Cache for 10 minutes

    res.json({
      success: true,
      data: {
        totalGames,
        totalPlayers,
        bestScore: bestScore
          ? {
              playerName: bestScore.playerName,
              time: bestScore.time,
              category: bestScore.category,
              difficulty: bestScore.difficulty,
            }
          : null,
        categoryStats: categoryStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count
          return acc
        }, {}),
      },
      message: "Game statistics retrieved successfully",
    })
  } catch (error) {
    console.error("Error fetching stats:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch game statistics",
    })
  }
})

// DEBUG ROUTE - Only in development
if (process.env.NODE_ENV === "development") {
  router.get("/debug/stats", async (req, res) => {
    try {
      const totalScores = await Score.countDocuments()
      const sampleScores = await Score.find().limit(3).lean()

      res.json({
        success: true,
        stats: {
          totalScores,
          sampleScores,
          databaseName: Score.db.name,
          collectionName: Score.collection.name,
        },
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      })
    }
  })
}

export default router
