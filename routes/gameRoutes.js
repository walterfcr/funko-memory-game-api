import express from "express"
import Score from "../models/Score.js"

const router = express.Router()

// Game categories and difficulties (keep these for validation)
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

// GET /api/categories - Get all categories
router.get("/categories", (req, res) => {
  try {
    res.json({
      success: true,
      data: gameCategories,
      count: gameCategories.length,
      message: "Game categories retrieved successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch categories",
    })
  }
})

// GET /api/difficulties - Get all difficulties
router.get("/difficulties", (req, res) => {
  try {
    res.json({
      success: true,
      data: gameDifficulties,
      count: gameDifficulties.length,
      message: "Difficulty levels retrieved successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch difficulties",
    })
  }
})

// GET /api/scores - Get all scores from MongoDB
router.get("/scores", async (req, res) => {
  try {
    const { category, difficulty, limit = 50 } = req.query

    // Build filter object
    const filter = {}
    if (category && category !== "all") {
      filter.category = category
    }
    if (difficulty && difficulty !== "all") {
      filter.difficulty = difficulty
    }

    // Get scores from MongoDB
    const scores = await Score.find(filter)
      .sort({ time: 1, moves: 1 }) // Sort by time (fastest first), then moves
      .limit(Number.parseInt(limit))
      .lean() // Returns plain JavaScript objects

    // Format the response to match your existing API
    const formattedScores = scores.map((score) => ({
      id: score._id,
      playerName: score.playerName,
      category: score.category,
      difficulty: score.difficulty,
      time: score.time,
      moves: score.moves,
      date: score.date.toISOString().split("T")[0], // Format as YYYY-MM-DD
    }))

    res.json({
      success: true,
      data: formattedScores,
      count: formattedScores.length,
      message: `Scores retrieved from MongoDB successfully`,
      filters: { category, difficulty, limit },
    })
  } catch (error) {
    console.error("Error fetching scores:", error)
    res.status(500).json({
      success: false,
      error: "Failed to fetch scores from database",
    })
  }
})

// POST /api/scores - Submit a new game score to MongoDB
router.post("/scores", async (req, res) => {
  try {
    const { playerName, category, difficulty, time, moves } = req.body

    console.log("📝 RECEIVED SCORE DATA:", req.body)

    // Basic validation
    if (!playerName || !category || !difficulty || time === undefined || moves === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: playerName, category, difficulty, time, moves",
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

    // Check for recent duplicate (same player, category, difficulty within last 10 seconds)
    const tenSecondsAgo = new Date(Date.now() - 10000)
    const recentDuplicate = await Score.findOne({
      playerName: { $regex: new RegExp(`^${playerName}$`, "i") }, // Case insensitive
      category,
      difficulty,
      createdAt: { $gte: tenSecondsAgo },
      time: { $gte: Number.parseInt(time) - 5, $lte: Number.parseInt(time) + 5 }, // Within 5 seconds
      moves: { $gte: Number.parseInt(moves) - 2, $lte: Number.parseInt(moves) + 2 }, // Within 2 moves
    })

    if (recentDuplicate) {
      console.log("🚫 DUPLICATE DETECTED - Rejecting similar score")
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
      category,
      difficulty,
      time: Number.parseInt(time),
      moves: Number.parseInt(moves),
      score: calculatedScore,
    })

    const savedScore = await newScore.save()

    console.log("✅ SCORE SAVED TO MONGODB:", savedScore._id)

    res.status(201).json({
      success: true,
      data: {
        id: savedScore._id,
        playerName: savedScore.playerName,
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
    })
  }
})

export default router