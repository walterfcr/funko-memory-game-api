import mongoose from "mongoose"

const scoreSchema = new mongoose.Schema(
  {
    playerName: {
      type: String,
      required: true,
      trim: true,
      maxLength: 50,
      index: true, // Index for faster player queries
    },
    userId: {
      // NEW FIELD
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // References the User model
      required: false, // Make it optional for now, in case you want to keep old scores or allow guest scores
      index: true, // Index for faster user-specific score queries
    },
    category: {
      type: String,
      required: true,
      enum: ["heroes", "movies", "musicians", "videogames"],
      index: true, // Index for category filtering
    },
    difficulty: {
      type: String,
      required: true,
      enum: ["easy", "medium", "hard"],
      index: true, // Index for difficulty filtering
    },
    time: {
      type: Number,
      required: true,
      min: 1,
      index: true, // Index for sorting by time
    },
    moves: {
      type: Number,
      required: true,
      min: 1,
      index: true, // Index for sorting by moves
    },
    score: {
      type: Number,
      default: 0,
      index: true, // Index for sorting by score
    },
    date: {
      type: Date,
      default: Date.now,
      index: true, // Index for date-based queries
    },
  },
  {
    timestamps: true,
    collection: "scores",
  },
)

// Compound indexes for better query performance
scoreSchema.index({ category: 1, difficulty: 1, time: 1 }) // Category + difficulty + time
scoreSchema.index({ playerName: 1, createdAt: -1 }) // Player history
scoreSchema.index({ time: 1, moves: 1 }) // Leaderboard sorting
scoreSchema.index({ createdAt: -1 }) // Recent scores
scoreSchema.index({ category: 1, time: 1 }) // Category leaderboards
scoreSchema.index({ difficulty: 1, time: 1 }) // Difficulty leaderboards
scoreSchema.index({ userId: 1, createdAt: -1 }) // NEW INDEX: For user's personal score history

// TTL index for cleaning up old scores (optional - keeps last 1 year)
// scoreSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 })

const Score = mongoose.model("Score", scoreSchema, "scores")

export default Score
