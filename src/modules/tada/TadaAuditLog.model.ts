import mongoose, { Schema, Document } from "mongoose";

export interface ITadaAuditLog extends Document {
  tadaMonthlySheetId: mongoose.Types.ObjectId;
  tadaEntryId?: mongoose.Types.ObjectId;
  actionType: string;
  performedBy: mongoose.Types.ObjectId;
  fromStatus?: string;
  toStatus?: string;
  changesBefore?: any;
  changesAfter?: any;
  comment?: string;
  performedAt: Date;
}

const schema = new Schema<ITadaAuditLog>({
  tadaMonthlySheetId: { type: Schema.Types.ObjectId, ref: "TadaMonthlySheet" },
  tadaEntryId: { type: Schema.Types.ObjectId, ref: "TadaEntry", default: null },
  actionType: {
    type: String,
    enum: [
      "status_change",
      "entry_create",
      "entry_edit",
      "entry_delete",
      "sheet_edit",
      "rate_change",
    ],
  },
  performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  fromStatus: String,
  toStatus: String,
  changesBefore: Schema.Types.Mixed,
  changesAfter: Schema.Types.Mixed,
  comment: String,
  performedAt: { type: Date, default: Date.now },
});

export default mongoose.model<ITadaAuditLog>("TadaAuditLog", schema);
