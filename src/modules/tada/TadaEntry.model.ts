import mongoose, { Schema, Document } from "mongoose";
import { validateEntryDate } from "./tada.helper";

export interface ITadaEntry extends Document {
  employeeId: mongoose.Types.ObjectId;
  tadaMonthlySheetId: mongoose.Types.ObjectId;
  entryDate: Date;
  month: number;
  year: number;
  visitedPlaces: string[];
  meterReadingStart: number;
  meterReadingEnd: number;
  totalTravelKm: number;
  takaPerKm: number;
  totalFuelCost: number;
  maintenance: number;
  conveyance: number;
  da: number;
  nh: number;
  totalDailyExpense: number;
  remarks: string;
  submittedAt?: Date;
  isEdited: boolean;
  editedBy?: mongoose.Types.ObjectId;
  editedAt?: Date;
  deletedAt?: Date;
}

const schema = new Schema<ITadaEntry>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tadaMonthlySheetId: {
      type: Schema.Types.ObjectId,
      ref: "TadaMonthlySheet",
      required: true,
    },
    entryDate: { type: Date, required: true },
    month: Number,
    year: Number,
    visitedPlaces: { type: [String], default: [] },
    meterReadingStart: { type: Number, required: true, min: 0 },
    meterReadingEnd: { type: Number, required: true, min: 0 },
    totalTravelKm: Number,
    takaPerKm: Number,
    totalFuelCost: Number,
    maintenance: { type: Number, default: 0 },
    conveyance: { type: Number, default: 0 },
    da: { type: Number, default: 0 },
    nh: { type: Number, default: 0 },
    totalDailyExpense: Number,
    remarks: { type: String, default: "" },
    submittedAt: Date,
    isEdited: { type: Boolean, default: false },
    editedBy: { type: Schema.Types.ObjectId, ref: "User" },
    editedAt: Date,
    deletedAt: Date,
  },
  { timestamps: true },
);

// UNIQUE
schema.index({ employeeId: 1, entryDate: 1 }, { unique: true });

// PRE SAVE HOOK
schema.pre("save", function (next) {
  const doc = this as ITadaEntry;

  const date = new Date(doc.entryDate);

  // 1. Extract month/year
  doc.month = date.getMonth() + 1;
  doc.year = date.getFullYear();

  // 2. Validate date
  validateEntryDate(date);

  // 3. Validate meter
  if (doc.meterReadingEnd < doc.meterReadingStart) {
    return next(new Error("End meter must be >= start meter"));
  }

  // 4. Calculate KM
  doc.totalTravelKm = doc.meterReadingEnd - doc.meterReadingStart;

  // 5. Fuel cost
  doc.totalFuelCost = doc.totalTravelKm * doc.takaPerKm;

  // 6. Total expense
  doc.totalDailyExpense =
    doc.totalFuelCost + doc.maintenance + doc.conveyance + doc.da + doc.nh;

  next();
});

export default mongoose.model<ITadaEntry>("TadaEntry", schema);
