import mongoose, { Schema, Document, Types } from "mongoose";

export type PromotionStatus =
  | "Draft"
  | "Scheduled"
  | "Active"
  | "Paused"
  | "Expired"
  | "Cancelled";

export type PromotionType =
  | "BUY_X_GET_Y"
  | "PERCENT_DISCOUNT"
  | "FLAT_DISCOUNT"
  | "QTY_DISCOUNT";

export interface IPromotionRule {
  productId: Types.ObjectId;

  // Buy X Get Y
  buyQty?: number;
  getQty?: number;

  // Optional future support
  discountPercent?: number;
  discountAmount?: number;

  maxBonusQty?: number; // limit bonus per invoice
}

export interface IPromotion extends Document {
  name: string;
  description?: string;

  promotionType: PromotionType;

  rules: IPromotionRule[];

  // Optional filters
  customerIds?: Types.ObjectId[];
  customerGroupIds?: Types.ObjectId[];

  warehouseIds?: Types.ObjectId[];

  startDate?: Date;
  endDate?: Date;

  priority?: number;

  status: PromotionStatus;

  isActive: boolean;

  usageLimit?: number; // total usage limit
  usageCount?: number; // how many times used

  createdBy?: Types.ObjectId;
}

const PromotionRuleSchema = new Schema<IPromotionRule>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    buyQty: { type: Number, min: 1 },
    getQty: { type: Number, min: 1 },

    discountPercent: { type: Number },
    discountAmount: { type: Number },

    maxBonusQty: { type: Number },
  },
  { _id: false },
);

const PromotionSchema = new Schema<IPromotion>(
  {
    name: { type: String, required: true, index: true },
    description: { type: String },

    promotionType: {
      type: String,
      enum: [
        "BUY_X_GET_Y",
        "PERCENT_DISCOUNT",
        "FLAT_DISCOUNT",
        "QTY_DISCOUNT",
      ],
      required: true,
    },

    rules: {
      type: [PromotionRuleSchema],
      required: true,
    },

    customerIds: [{ type: Schema.Types.ObjectId, ref: "Customer" }],

    customerGroupIds: [{ type: Schema.Types.ObjectId, ref: "CustomerGroup" }],

    warehouseIds: [{ type: Schema.Types.ObjectId, ref: "WarehouseOrFactory" }],

    startDate: { type: Date },
    endDate: { type: Date },

    priority: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["Draft", "Scheduled", "Active", "Paused", "Expired", "Cancelled"],
      default: "Draft",
    },

    isActive: { type: Boolean, default: false },

    usageLimit: { type: Number },
    usageCount: { type: Number, default: 0 },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

// Helpful indexes
PromotionSchema.index({
  status: 1,
  isActive: 1,
  startDate: 1,
  endDate: 1,
  "rules.productId": 1,
});

PromotionSchema.pre("validate", function (next) {
  if (this.promotionType === "BUY_X_GET_Y") {
    for (const rule of this.rules) {
      if (!rule.buyQty || !rule.getQty) {
        return next(new Error("BUY_X_GET_Y requires buyQty and getQty"));
      }
    }
  }
  next();
});

PromotionSchema.pre("save", function (next) {
  if (this.usageLimit && this.usageCount && this.usageCount > this.usageLimit) {
    return next(new Error("Usage count exceeded limit"));
  }
  next();
});

PromotionSchema.pre("save", function (next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    return next(new Error("End date cannot be before start date"));
  }
  next();
});

PromotionSchema.pre("save", function (next) {
  if (this.status === "Active") {
    this.isActive = true;
  }
  next();
});

export default mongoose.models.Promotion ||
  mongoose.model("Promotion", PromotionSchema);
