import mongoose, { Schema } from "mongoose";

const ConversionSchema = new Schema({
  products: [
    {
      productId: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantityProduced: {
        type: Number,
        required: true,
      },
    },
  ],

  expectedRawUsed: {
    type: Number,
    required: true,
  },

  actualRawUsed: {
    type: Number,
    required: true,
  },

  variance: {
    type: Number,
    required: true,
  },

  varianceType: {
    type: String,
    enum: ["GAIN", "LOSS", "PERFECT"],
  },

  otherMaterialsUsed: [
    {
      itemType: {
        type: String,
        enum: ["RawMaterial", "PackagingItem"],
      },
      itemId: Schema.Types.ObjectId,
      quantity: Number,
      unit: String,
    },
  ],

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const MaterialWIPSchema = new Schema(
  {
    factoryId: {
      type: Schema.Types.ObjectId,
      ref: "WarehouseOrFactory",
      required: true,
      index: true,
    },

    rawMaterialId: {
      type: Schema.Types.ObjectId,
      ref: "RawMaterial",
      required: true,
      index: true,
    },

    initialQuantity: {
      type: Number,
      required: true,
    },

    remainingQuantity: {
      type: Number,
      required: true,
    },

    unit: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED"],
      default: "ACTIVE",
      index: true,
    },

    conversions: [ConversionSchema],

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    completedAt: Date,
  },
  { timestamps: true },
);

MaterialWIPSchema.index(
  { factoryId: 1, rawMaterialId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "ACTIVE" } },
);

export default mongoose.model("MaterialWIP", MaterialWIPSchema);
