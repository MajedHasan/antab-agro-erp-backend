import mongoose, { Schema, Document, Types } from "mongoose";
import { ISpecialOfferRule } from "./special-offer-rule.model";

export type RewardType = "PRODUCT" | "POINTS" | "OTHER";

export interface ISpecialOffer extends Document {
  name: string;
  description?: string;

  startDate: Date;
  endDate: Date;
  paymentDueDate: Date;

  targetDealerIds?: Types.ObjectId[];
  targetZoneIds?: Types.ObjectId[];
  targetRegionIds?: Types.ObjectId[];
  targetAreaIds?: Types.ObjectId[];
  targetTerritoryIds?: Types.ObjectId[];

  maxWinners?: number;
  maxTimesPerDealer?: number;

  rewardType: RewardType;
  rewardQuantity?: number;

  isActive: boolean;

  rules?: Types.ObjectId[] | ISpecialOfferRule[]; // 🔥 link rules directly

  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
}

const SpecialOfferSchema = new Schema<ISpecialOffer>(
  {
    name: { type: String, required: true },
    description: { type: String },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    paymentDueDate: { type: Date, required: true },

    targetDealerIds: [{ type: Schema.Types.ObjectId, ref: "Dealer" }],
    targetZoneIds: [{ type: Schema.Types.ObjectId, ref: "Zone" }],
    targetRegionIds: [{ type: Schema.Types.ObjectId, ref: "Region" }],
    targetAreaIds: [{ type: Schema.Types.ObjectId, ref: "Area" }],
    targetTerritoryIds: [{ type: Schema.Types.ObjectId, ref: "Territory" }],

    maxWinners: { type: Number },
    maxTimesPerDealer: { type: Number },

    rewardType: {
      type: String,
      enum: ["PRODUCT", "POINTS", "OTHER"],
      required: true,
    },
    rewardQuantity: { type: Number },

    isActive: { type: Boolean, default: true },

    // 🔥 new: reference to rules
    rules: [{ type: Schema.Types.ObjectId, ref: "SpecialOfferRule" }],

    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default mongoose.models.SpecialOffer ||
  mongoose.model<ISpecialOffer>("SpecialOffer", SpecialOfferSchema);
