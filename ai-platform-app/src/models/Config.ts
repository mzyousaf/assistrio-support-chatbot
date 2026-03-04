import mongoose, { HydratedDocument, Model, Schema } from "mongoose";

export interface Config {
  key: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type ConfigDocument = HydratedDocument<Config>;

const ConfigSchema = new Schema<Config>({
  key: { type: String, required: true, unique: true },
  data: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const Config =
  (mongoose.models.Config as Model<Config>) ||
  mongoose.model<Config>("Config", ConfigSchema);
