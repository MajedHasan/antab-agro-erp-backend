// models/PestType.ts

import mongoose, { Document, Schema } from "mongoose";

export interface IPestType extends Document {
  name: string;
  status: "active" | "inactive";
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const pestTypeSchema = new Schema<IPestType>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.PestType ||
  mongoose.model<IPestType>("PestType", pestTypeSchema);