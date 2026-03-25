import mongoose, { Schema, Document, Types } from "mongoose";

export type RuleNodeType = "RULE" | "GROUP";
export type CombinationLogic = "AND" | "OR";

export interface ISpecialOfferRuleNode {
  type: RuleNodeType; // RULE = leaf, GROUP = internal
  productIds?: Types.ObjectId[]; // only for RULE leaf
  minQty?: number; // optional quantity condition
  minAmount?: number; // optional amount/price condition

  combinationLogic?: CombinationLogic; // only for GROUP
  children?: ISpecialOfferRuleNode[]; // for GROUP nodes
}

export interface ISpecialOfferRule extends Document {
  offerId: Types.ObjectId; // reference to SpecialOffer
  rules: ISpecialOfferRuleNode[];
}

const SpecialOfferRuleNodeSchema = new Schema<ISpecialOfferRuleNode>(
  {
    type: { type: String, enum: ["RULE", "GROUP"], required: true },
    productIds: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    minQty: { type: Number },
    minAmount: { type: Number },

    combinationLogic: { type: String, enum: ["AND", "OR"] },
    children: [{ type: Schema.Types.Mixed }], // recursive for child nodes
  },
  { _id: false },
);

const SpecialOfferRuleSchema = new Schema<ISpecialOfferRule>(
  {
    offerId: {
      type: Schema.Types.ObjectId,
      ref: "SpecialOffer",
      required: true,
    },
    rules: { type: [SpecialOfferRuleNodeSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.models.SpecialOfferRule ||
  mongoose.model<ISpecialOfferRule>("SpecialOfferRule", SpecialOfferRuleSchema);
