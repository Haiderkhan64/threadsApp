import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  id: { type: String, require: true, unique: true },
  username: { type: String, require: true, unique: true },
  name: { type: String, require: true },
  image: String,
  bio: String,
  threads: [{ type: mongoose.Schema.Types.ObjectId, ref: "Thread" }],
  communities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Community" }],
  onboarded: { type: Boolean, default: false },
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
