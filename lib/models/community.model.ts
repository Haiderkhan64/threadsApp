import mongoose from "mongoose";

const communitySchema = new mongoose.Schema(
  {
    // Human-readable unique handle, e.g. "reactjs"
    username: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    image: { type: String, default: "" },
    bio: { type: String, default: "" },

    // The user who created the community — they are always a member
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // All member ObjectIds (includes the creator)
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // All threads posted in this community
    threads: [{ type: mongoose.Schema.Types.ObjectId, ref: "Thread" }],
  },
  { timestamps: true }
);

// Fast lookup by slug
communitySchema.index({ username: 1 });
// Fast member-check queries
communitySchema.index({ members: 1 });

const Community =
  mongoose.models.Community ||
  mongoose.model("Community", communitySchema);

export default Community;