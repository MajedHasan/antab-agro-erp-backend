import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISalesReturnItem {
  productId: Types.ObjectId;
  qty: number;
  reason?: string;
}

export interface ISalesReturn extends Document {
  returnNo: string;

  orderId: Types.ObjectId;
  customerId: Types.ObjectId;

  items: ISalesReturnItem[];

  status:
    | "PENDING"
    | "A.M_CONFIRMED"
    | "R.M_CONFIRMED"
    | "N.S.M_CONFIRMED"
    | "AC_PENDING"
    | "WAREHOUSE_RECEIVED"
    | "COMPLETED"
    | "REJECTED"
    | "CANCELLED";

  approvalLogs: {
    role: "M.O" | "A.M" | "R.M" | "N.S.M" | "A.C" | "WAREHOUSE";
    userId: Types.ObjectId;
    status: "APPROVED" | "REJECTED" | "PENDING";
    remarks?: string;
    actionDate?: Date;
  }[];

  accountsDecision?: "APPROVED" | "NEGOTIATED" | "REJECTED";

  warehouseReceived: boolean;

  createdBy: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const SalesReturnSchema = new Schema<ISalesReturn>(
  {
    returnNo: { type: String, required: true, unique: true },

    orderId: {
      type: Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: true,
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
        },
        qty: Number,
        reason: String,
      },
    ],

    status: {
      type: String,
      enum: [
        "PENDING",
        "A.M_CONFIRMED",
        "R.M_CONFIRMED",
        "N.S.M_CONFIRMED",
        "AC_PENDING",
        "WAREHOUSE_RECEIVED",
        "COMPLETED",
        "REJECTED",
        "CANCELLED",
      ],
      default: "PENDING",
    },

    approvalLogs: { type: Array, default: [] },

    accountsDecision: {
      type: String,
      enum: ["APPROVED", "NEGOTIATED", "REJECTED"],
    },

    warehouseReceived: { type: Boolean, default: false },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

export default mongoose.models.SalesReturn ||
  mongoose.model<ISalesReturn>("SalesReturn", SalesReturnSchema);
