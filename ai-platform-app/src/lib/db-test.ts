import { connectToDatabase } from "@/lib/mongoose";

export async function pingDb(): Promise<boolean> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("MongoDB connection is not ready.");
    }

    await db.admin().ping();
    return true;
  } catch (error) {
    console.error("MongoDB ping failed:", error);
    throw error;
  }
}
