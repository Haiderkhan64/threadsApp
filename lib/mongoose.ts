import mongoose from "mongoose";

let isConnected = false;

export const ConnectedToDB = async () => {
  mongoose.set("strictQuery", true);
  if (!process.env.MONGODB_URL) return console.log("MONGODB_URL are not found");
  if (isConnected) return console.log("Already Connected");

  try {
    await mongoose.connect(process.env.MONGODB_URL);
    isConnected = true;
    console.log("Connected successfully");
  } catch (error) {
    console.log("Error: ", error);
  }
};
