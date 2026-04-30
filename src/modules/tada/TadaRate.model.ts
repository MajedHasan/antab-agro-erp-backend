import mongoose, { Schema, Document } from "mongoose";

export interface ITadaRate extends Document {
  rateType: "global" | "employee" | "territory" | "designation";
  takaPerKm: number;
  defaultDA: number;
  defaultNH: number;
  applicableTo: any;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  deletedAt?: Date;
}

const schema = new Schema<ITadaRate>(
  {
    rateType: {
      type: String,
      enum: ["global", "employee", "territory", "designation"],
      default: "global",
    },
    takaPerKm: { type: Number, required: true },
    defaultDA: { type: Number, default: 0 },
    defaultNH: { type: Number, default: 0 },
    applicableTo: { type: Schema.Types.Mixed, default: null },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedAt: Date,
  },
  { timestamps: true },
);

schema.index({ rateType: 1, isActive: 1, effectiveFrom: -1 });
schema.index({ applicableTo: 1, rateType: 1 });

export default mongoose.model<ITadaRate>("TadaRate", schema);
