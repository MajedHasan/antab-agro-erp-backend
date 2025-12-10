import mongoose, { Document } from "mongoose";

export interface IMedia extends Document {
  originalName: string;
  fileName: string;
  mimeType: string;
  fileType: string;
  size: number;
  module: string;
  folder: string;
  url: string;
  uploadedBy?: mongoose.Types.ObjectId;
  deletedAt?: Date;
}

const mediaSchema = new mongoose.Schema<IMedia>(
  {
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String },
    fileType: { type: String },
    size: { type: Number },

    module: { type: String },
    folder: { type: String },
    url: { type: String, required: true },

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    deletedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.Media ||
  mongoose.model<IMedia>("Media", mediaSchema);
