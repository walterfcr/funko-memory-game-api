import mongoose from "mongoose"

const scoreSchema = new mongoose.Schema(
  {
    playerName: {
      type: String,
      required: true,
      trim: true,
      maxLength: 50,
    },
    category: {
      type: String,
      required: true,
      enum: ["heroes", "movies", "musicians", "videogames"],
    },
    difficulty: {
      type: String,
      required: true,
      enum: ["easy", "medium", "hard"],
    },
    time: {
      type: Number,
      required: true,
      min: 1,
    },
    moves: {
      type: Number,
      required: true,
      min: 1,
    },
    score: {
      type: Number,
      default: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  },
)

// Index for faster queries
scoreSchema.index({ category: 1, difficulty: 1, time: 1 })
scoreSchema.index({ playerName: 1, createdAt: -1 })

const Score = mongoose.model("Score", scoreSchema)

export default Score