// models/Solution.ts

import mongoose, { Document, Schema } from "mongoose";

export interface ISolution extends Document {
  name: string;
  status: "active" | "inactive";
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const solutionSchema = new Schema<ISolution>(
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

export default mongoose.models.Solution ||
  mongoose.model<ISolution>("Solution", solutionSchema);