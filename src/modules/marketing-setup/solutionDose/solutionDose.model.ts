// models/SolutionDose.ts

import mongoose, { Document, Schema } from "mongoose";

export type DoseUnit = "ml/L" | "g/L";

export interface ISolutionDose extends Document {
  solutionId: mongoose.Types.ObjectId;

  amount: number;
  unit: DoseUnit;

  frequency?: string;
  duration?: string;

  status: "active" | "inactive";

  createdBy?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const solutionDoseSchema = new Schema<ISolutionDose>(
  {
    solutionId: {
      type: Schema.Types.ObjectId,
      ref: "Solution",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      enum: ["ml/L", "g/L"],
      required: true,
    },

    frequency: {
      type: String,
      trim: true,
    },

    duration: {
      type: String,
      trim: true,
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

solutionDoseSchema.index(
  {
    solutionId: 1,
    amount: 1,
    unit: 1,
  },
  {
    unique: true,
  }
);

export default mongoose.models.SolutionDose ||
  mongoose.model<ISolutionDose>("SolutionDose", solutionDoseSchema);