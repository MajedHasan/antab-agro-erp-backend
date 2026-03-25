import mongoose, { Schema, Document, Types } from "mongoose";

export type RewardStatus = "PENDING" | "ISSUED" | "REDEEMED";

export interface ISpecialOfferReward extends Document {
  offerId: Types.ObjectId;
  dealerId: Types.ObjectId;
  progressId: Types.ObjectId; // link to progress
  rewardType: "PRODUCT" | "POINTS" | "OTHER";
  rewardQuantity: number;

  issuedAt?: Date;
  redeemedAt?: Date;
  status: RewardStatus;

  createdBy?: Types.ObjectId;
  createdAt: Date;
}

const SpecialOfferRewardSchema = new Schema<ISpecialOfferReward>(
  {
    offerId: {
      type: Schema.Types.ObjectId,
      ref: "SpecialOffer",
      required: true,
    },
    dealerId: { type: Schema.Types.ObjectId, ref: "Dealer", required: true },
    progressId: {
      type: Schema.Types.ObjectId,
      ref: "SpecialOfferProgress",
      required: true,
    },

    rewardType: {
      type: String,
      enum: ["PRODUCT", "POINTS", "OTHER"],
      required: true,
    },
    rewardQuantity: { type: Number, required: true },

    status: {
      type: String,
      enum: ["PENDING", "ISSUED", "REDEEMED"],
      default: "PENDING",
    },
    issuedAt: { type: Date },
    redeemedAt: { type: Date },

    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default mongoose.models.SpecialOfferReward ||
  mongoose.model<ISpecialOfferReward>(
    "SpecialOfferReward",
    SpecialOfferRewardSchema,
  );
