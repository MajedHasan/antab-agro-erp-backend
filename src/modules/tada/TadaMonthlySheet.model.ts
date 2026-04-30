import mongoose, { Schema, Document } from "mongoose";

export interface ITadaMonthlySheet extends Document {
  employeeId: mongoose.Types.ObjectId;
  employeeName: string;
  designation: string;
  mobileNo: string;
  territory: string;
  area: string;
  month: number;
  year: number;
  status: "open" | "submitted" | "checked" | "approved" | "rejected";

  totalTravelKmMonth: number;
  totalFuelCostMonth: number;
  totalMaintenanceMonth: number;
  totalConveyanceMonth: number;
  totalDAMonth: number;
  totalNHMonth: number;
  totalDailyExpensesMonth: number;
  workingDaysCount: number;

  entertainmentFood: number;
  motorcycleRent: number;
  photocopy: number;
  stationary: number;
  others: number;

  grandTotalExpense: number;
  grandTotalInWords: string;

  deletedAt?: Date;
}

const schema = new Schema<ITadaMonthlySheet>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    employeeName: String,
    designation: String,
    mobileNo: String,
    territory: String,
    area: String,
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    status: {
      type: String,
      enum: ["open", "submitted", "checked", "approved", "rejected"],
      default: "open",
    },

    totalTravelKmMonth: { type: Number, default: 0 },
    totalFuelCostMonth: { type: Number, default: 0 },
    totalMaintenanceMonth: { type: Number, default: 0 },
    totalConveyanceMonth: { type: Number, default: 0 },
    totalDAMonth: { type: Number, default: 0 },
    totalNHMonth: { type: Number, default: 0 },
    totalDailyExpensesMonth: { type: Number, default: 0 },
    workingDaysCount: { type: Number, default: 0 },

    entertainmentFood: { type: Number, default: 0 },
    motorcycleRent: { type: Number, default: 0 },
    photocopy: { type: Number, default: 0 },
    stationary: { type: Number, default: 0 },
    others: { type: Number, default: 0 },

    grandTotalExpense: { type: Number, default: 0 },
    grandTotalInWords: String,

    deletedAt: Date,
  },
  { timestamps: true },
);

schema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model<ITadaMonthlySheet>("TadaMonthlySheet", schema);
