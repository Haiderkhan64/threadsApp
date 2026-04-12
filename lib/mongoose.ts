import mongoose from "mongoose";

let isConnected = false;

export const ConnectedToDB = async () => {
  mongoose.set("strictQuery", true);

  if (!process.env.MONGODB_URL) {
    throw new Error("MONGODB_URL is not defined in environment variables");
  }

  if (isConnected) {
    console.log("Already Connected");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URL);
    isConnected = true;
    console.log("Connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error; // ← re-throw so callers know the connection failed
  }
};