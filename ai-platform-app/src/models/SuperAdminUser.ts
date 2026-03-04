import mongoose, { HydratedDocument, Model, Schema } from "mongoose";

export interface SuperAdminUser {
  email: string;
  passwordHash: string;
  role: "superadmin";
  createdAt: Date;
}

export type SuperAdminUserDocument = HydratedDocument<SuperAdminUser>;

const SuperAdminUserSchema = new Schema<SuperAdminUser>({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: "superadmin", enum: ["superadmin"] },
  createdAt: { type: Date, default: Date.now },
});

SuperAdminUserSchema.index({ email: 1 });

export const SuperAdminUser =
  (mongoose.models.SuperAdminUser as Model<SuperAdminUser>) ||
  mongoose.model<SuperAdminUser>("SuperAdminUser", SuperAdminUserSchema);
