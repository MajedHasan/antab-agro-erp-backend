// models/CropPestType.ts

import mongoose, { Document, Schema } from "mongoose";

export interface ICropPestType extends Document {
  cropId: mongoose.Types.ObjectId;
  pestTypeId: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const cropPestTypeSchema = new Schema<ICropPestType>(
  {
    cropId: {
      type: Schema.Types.ObjectId,
      ref: "Crop",
      required: true,
      index: true,
    },

    pestTypeId: {
      type: Schema.Types.ObjectId,
      ref: "PestType",
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

cropPestTypeSchema.index(
  { cropId: 1, pestTypeId: 1 },
  { unique: true }
);

export default mongoose.models.CropPestType ||
  mongoose.model<ICropPestType>("CropPestType", cropPestTypeSchema);