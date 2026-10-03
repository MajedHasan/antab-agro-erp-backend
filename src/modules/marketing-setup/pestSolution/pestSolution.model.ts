// models/PestSolution.ts

import mongoose, { Document, Schema } from "mongoose";

export interface IPestSolution extends Document {
  pestTypeId: mongoose.Types.ObjectId;
  solutionId: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const pestSolutionSchema = new Schema<IPestSolution>(
  {
    pestTypeId: {
      type: Schema.Types.ObjectId,
      ref: "PestType",
      required: true,
      index: true,
    },

    solutionId: {
      type: Schema.Types.ObjectId,
      ref: "Solution",
      required: true,
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

pestSolutionSchema.index(
  { pestTypeId: 1, solutionId: 1 },
  { unique: true }
);

export default mongoose.models.PestSolution ||
  mongoose.model<IPestSolution>("PestSolution", pestSolutionSchema);