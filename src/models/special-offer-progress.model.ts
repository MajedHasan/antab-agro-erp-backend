import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISpecialOfferProgressCondition {
  nodeId: Types.ObjectId; // link to rule leaf node
  fulfilledQty?: number;
  fulfilledAmount?: number;
  isFulfilled: boolean;
}

export interface ISpecialOfferProgress extends Document {
  offerId: Types.ObjectId;
  dealerId: Types.ObjectId;

  salesOrderIds: Types.ObjectId[];
  invoiceIds: Types.ObjectId[];

  conditionsProgress: ISpecialOfferProgressCondition[];

  totalTimesWon?: number;
  rewardIssued?: boolean;
  rewardQuantity?: number;

  createdAt: Date;
  updatedAt?: Date;
}

const SpecialOfferProgressConditionSchema =
  new Schema<ISpecialOfferProgressCondition>(
    {
      nodeId: { type: Schema.Types.ObjectId, required: true },
      fulfilledQty: { type: Number, default: 0 },
      fulfilledAmount: { type: Number, default: 0 },
      isFulfilled: { type: Boolean, default: false },
    },
    { _id: false },
  );

const SpecialOfferProgressSchema = new Schema<ISpecialOfferProgress>(
  {
    offerId: {
      type: Schema.Types.ObjectId,
      ref: "SpecialOffer",
      required: true,
    },
    dealerId: { type: Schema.Types.ObjectId, ref: "Dealer", required: true },

    salesOrderIds: [{ type: Schema.Types.ObjectId, ref: "SalesOrder" }],
    invoiceIds: [{ type: Schema.Types.ObjectId, ref: "SalesInvoice" }],

    conditionsProgress: {
      type: [SpecialOfferProgressConditionSchema],
      default: [],
    },

    totalTimesWon: { type: Number, default: 0 },
    rewardIssued: { type: Boolean, default: false },
    rewardQuantity: { type: Number },
  },
  { timestamps: true },
);

export default mongoose.models.SpecialOfferProgress ||
  mongoose.model<ISpecialOfferProgress>(
    "SpecialOfferProgress",
    SpecialOfferProgressSchema,
  );
