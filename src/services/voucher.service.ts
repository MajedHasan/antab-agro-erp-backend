// src/services/voucher.service.ts
import { createCrudService } from "./crud.service";
import { Voucher } from "../models/voucher.model";
import { VoucherLine } from "../models/voucher-line.model";
import { FilterQuery } from "mongoose";
import { Types } from "mongoose";
import { salesInvoiceService } from "./sales-invoice.service";
import salesInvoiceModel from "../models/sales-invoice.model";

/* ===========================
   Helpers
   =========================== */
function validateBalanced(lines: any[]) {
  const dr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const cr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  if (Math.abs(dr - cr) > 0.005) {
    throw new Error("Voucher is not balanced");
  }
}

/* ===========================
   Default populate (used locally)
   - keep this list in sync with your models
   =========================== */
const DEFAULT_POPULATE = [
  { path: "createdBy", select: "name email" },
  { path: "updatedBy", select: "name email" },
  { path: "approvedBy", select: "name email" },
  { path: "rejectedBy", select: "name email" },
  { path: "submittedBy", select: "name email" },
  // optional related refs (if present on model)
  { path: "source", select: "name code" }, // 👈 FIX
  { path: "mode" },
  { path: "invoiceId" },
  { path: "bankVaId", populate: { path: "accountId", select: "name code" } },
];

/* ===========================
   Base CRUD
   =========================== */
const base = createCrudService(Voucher, {
  defaultSort: "-date",
});

/* ===========================
   Voucher Service
   =========================== */
export const voucherService = {
  ...base,

  /* =======================================================
     CREATE (Always Pending) — validates balanced lines
     Accepts optional metadata: source, mode, invoiceId, bankVaId, etc.
  ======================================================= */
  async create(payload: any) {
    const lines = payload.lines || [];
    validateBalanced(lines);

    return base.withTransaction(async (session) => {
      const doc: any = {
        voucherNo: payload.voucherNo,
        date: payload.date || new Date(),
        type: payload.type,
        reference: payload.reference,
        narration: payload.narration,
        status: "Pending", // always pending at creation
        createdBy: payload.createdBy
          ? new Types.ObjectId(payload.createdBy)
          : undefined,
        submittedBy: payload.createdBy
          ? new Types.ObjectId(payload.createdBy)
          : undefined,
        submittedAt: new Date(),
        // optional metadata fields — include if provided
        ...(payload.source
          ? {
              source: new Types.ObjectId(payload.source),
              sourceModel: payload.sourceModel, // 👈 REQUIRED
            }
          : {}),
        ...(payload.mode ? { mode: payload.mode } : {}),
        ...(payload.invoiceId ? { invoiceId: payload.invoiceId } : {}),
        ...(payload.bankVaId ? { bankVaId: payload.bankVaId } : {}),
      };

      const voucherDocs = await (base.model as any).create([doc], { session });
      const voucher = voucherDocs[0];

      const now = new Date();
      const linesToInsert = lines.map((l: any) => ({
        voucherId: voucher._id,
        accountId: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        narration: l.narration || "",
        createdAt: now,
        updatedAt: now,
      }));

      const insertedLines = await VoucherLine.insertMany(linesToInsert, {
        session,
      });

      const vobj: any = voucher.toObject();
      vobj.lines = insertedLines;

      return vobj;
    });
  },

  /* =======================================================
     UPDATE (Allowed only if voucher is not Approved)
     - You can update Pending or Rejected vouchers
  ======================================================= */
  async update(id: string, payload: any) {
    return base.withTransaction(async (session) => {
      const voucher = await base.model.findById(id).session(session);
      if (!voucher) throw new Error("Voucher not found");

      if (voucher.status === "Approved") {
        throw new Error("Approved vouchers cannot be modified");
      }

      // apply basic fields (keep metadata)
      voucher.date = payload.date ?? voucher.date;
      voucher.type = payload.type ?? voucher.type;
      voucher.reference = payload.reference ?? voucher.reference;
      voucher.narration = payload.narration ?? voucher.narration;
      voucher.updatedBy = payload.updatedBy
        ? new Types.ObjectId(payload.updatedBy)
        : voucher.updatedBy;

      // optional metadata fields
      if (payload.source !== undefined) {
        voucher.source = new Types.ObjectId(payload.source);
        voucher.sourceModel = payload.sourceModel; // 👈 REQUIRED
      }
      if (payload.mode !== undefined) voucher.mode = payload.mode;
      if (payload.invoiceId !== undefined)
        voucher.invoiceId = payload.invoiceId;
      if (payload.bankVaId !== undefined) voucher.bankVaId = payload.bankVaId;

      await voucher.save({ session });

      if (payload.lines) {
        validateBalanced(payload.lines);

        await VoucherLine.deleteMany({ voucherId: id }).session(session);

        const now = new Date();
        const linesToInsert = payload.lines.map((l: any) => ({
          voucherId: id,
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          narration: l.narration || "",
          createdAt: now,
          updatedAt: now,
        }));

        await VoucherLine.insertMany(linesToInsert, { session });
      }

      return voucher;
    });
  },

  /* =======================================================
     DELETE (Only if Not Approved)
  ======================================================= */
  async remove(id: string) {
    return base.withTransaction(async (session) => {
      const voucher = await base.model.findById(id).session(session);
      if (!voucher) return null;

      if (voucher.status === "Approved") {
        throw new Error("Approved vouchers cannot be deleted");
      }

      await VoucherLine.deleteMany({ voucherId: id }).session(session);
      await voucher.deleteOne({ session });

      return voucher;
    });
  },

  /* =======================================================
     GET BY ID (with lines)
  ======================================================= */
  async getById(id: string) {
    const v = await base.model
      .findById(id)
      .populate(DEFAULT_POPULATE as any)
      .lean();
    if (!v) return null;

    const lines = await VoucherLine.find({ voucherId: id })
      .populate("accountId")
      .lean();

    return { ...v, lines };
  },

  /* =======================================================
     LIST (paginated) — returns vouchers with their lines
     Note: Uses DEFAULT_POPULATE for related refs
  ======================================================= */
  async list({
    filter = {},
    page = 1,
    limit = 15,
    sort = "-date",
    q,
  }: {
    filter?: FilterQuery<any>;
    page?: number;
    limit?: number;
    sort?: string;
    q?: string;
  } = {}) {
    const query: any = { ...filter };

    if (q?.trim()) {
      const rx = new RegExp(
        q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      query.$or = [{ voucherNo: rx }, { reference: rx }, { narration: rx }];
    }

    const skip = (page - 1) * limit;

    // find vouchers (populate key refs)
    const [vouchers, total] = await Promise.all([
      base.model
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate(DEFAULT_POPULATE as any)
        .lean(),
      base.model.countDocuments(query),
    ]);

    if (!vouchers.length) return { data: [], total, page, limit };

    const voucherIds = vouchers.map((v: any) => v._id);

    const lines = await VoucherLine.find({
      voucherId: { $in: voucherIds },
    })
      .populate("accountId")
      .lean();

    const grouped: Record<string, any[]> = {};
    for (const ln of lines) {
      const key = String(ln.voucherId);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(ln);
    }

    return {
      data: vouchers.map((v: any) => ({
        ...v,
        lines: grouped[String(v._id)] || [],
      })),
      total,
      page,
      limit,
    };
  },

  /* =======================================================
     WORKFLOW
     - approve: Pending -> Approved (and apply invoice payment if invoiceId present)
     - reject: Pending -> Rejected
  ======================================================= */

  /* Pending -> Approved */
  async approve(id: string, userId: string) {
    return base.withTransaction(async (session) => {
      // ✅ 1. Find voucher first
      const voucher = await base.model
        .findOne({ _id: id, status: "Pending" })
        .populate("mode")
        .session(session);

      if (!voucher) {
        throw new Error("Voucher not found or not in Pending state");
      }

      // ✅ 2. Get voucher lines
      const lines = await VoucherLine.find({ voucherId: id }).session(session);

      const totalCredit = lines.reduce(
        (sum, l) => sum + Number(l.credit || 0),
        0,
      );

      // ✅ 3. Update invoice FIRST (if linked)
      if (voucher.invoiceId && totalCredit > 0) {
        const invoice = await salesInvoiceModel
          .findById(voucher.invoiceId)
          .session(session);

        if (!invoice) {
          throw new Error("Linked invoice not found");
        }

        console.log("Payment Mode: ", voucher.mode);

        const modeValue =
          typeof voucher.mode === "object" && voucher.mode
            ? String((voucher.mode as any).name).toUpperCase()
            : typeof voucher.mode === "string"
              ? voucher.mode.toUpperCase()
              : "UNKNOWN"; // 👈 guarantee value

        invoice.payments.push({
          amount: totalCredit,
          voucherId: voucher._id,
          paidAt: new Date(),
          method: modeValue,
          reference: voucher.reference || undefined,
          receivedBy: userId ? new Types.ObjectId(userId) : undefined,
        });

        invoice.paidAmount += totalCredit;
        invoice.balanceAmount = invoice.grandTotal - invoice.paidAmount;

        if (invoice.balanceAmount <= 0) {
          invoice.paymentStatus = "PAID";
          invoice.balanceAmount = 0;
        } else {
          invoice.paymentStatus = "PARTIAL";
        }

        await invoice.save({ session });
      }

      // ✅ 4. NOW approve the voucher AFTER invoice success
      voucher.status = "Approved";
      voucher.approvedBy = userId ? new Types.ObjectId(userId) : undefined;
      voucher.approvedAt = new Date();

      await voucher.save({ session });

      return voucher;
    });
  },

  /* Pending -> Rejected */
  async reject(id: string, userId: string, reason: string) {
    if (!reason) {
      throw new Error("Rejection reason is required");
    }

    return (base.model as any).findOneAndUpdate(
      { _id: id, status: "Pending" },
      {
        status: "Rejected",
        rejectionReason: reason,
        rejectedBy: userId ? new Types.ObjectId(userId) : undefined,
        rejectedAt: new Date(),
      },
      { new: true },
    );
  },
};
