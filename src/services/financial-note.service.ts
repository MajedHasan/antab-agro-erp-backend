// src/services/financial-note.service.ts
import { createCrudService } from "./crud.service";
import { FinancialNote } from "../models/financial-note.model";
import { Account } from "../models/account.model";
import { getBalancesForPeriod } from "./ledger.service";
import { Types } from "mongoose";

const base = createCrudService(FinancialNote, {
  softDeleteField: "deletedAt",
  searchFields: ["noteNo", "title", "summary", "versions.content"],
});

/* -------- helpers -------- */

/** Generate a unique note number */
async function generateNoteNo(): Promise<string> {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const prefix = `FN-${yyyy}${mm}${dd}`;

  const count = await FinancialNote.countDocuments({
    noteNo: new RegExp(`^${prefix}-\\d{4}$`),
  });

  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

/** Fetch current balances for an array of account IDs using the ledger */
async function getCurrentBalances(accountIds: string[]) {
  if (!accountIds.length) return [];
  const now = new Date();
  const balanceMap = await getBalancesForPeriod(new Date(0), now);
  return accountIds.map(id => ({
    account: new Types.ObjectId(id),
    snapshotBalance: balanceMap.get(id)?.closing ?? 0,
  }));
}

/** Validate and normalise related account input */
function parseRelatedAccounts(input: any[]) {
  if (!input?.length) return [];
  return input.map(item => ({
    accountId: item.accountId || item.account,
  }));
}

export const financialNoteService = {
  ...base,

  /** Override list to allow filtering by statement and year */
  async list(params: any = {}) {
    const { page = 1, limit = 15, statement, year, q, ...rest } = params;
    const filter: any = {};
    if (statement) filter.statement = statement;
    if (year) filter.year = Number(year);
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { noteNo: regex },
        { title: regex },
        { summary: regex },
        { "versions.content": regex },
      ];
    }
    return base.list({ ...rest, page, limit, filter });
  },

  /** Create a new note – version 1 is created here */
  async create(payload: any) {
    const { content, author, relatedAccounts, ...rest } = payload;
    if (!content) throw new Error("Initial content is required");

    // Auto-generate noteNo if not provided
    const noteNo = payload.noteNo || (await generateNoteNo());

    // Resolve account IDs to proper references
    const accountIds = parseRelatedAccounts(relatedAccounts);
    const snapshots = await getCurrentBalances(accountIds.map(a => a.accountId));

    const versions = [{
      versionNo: 1,
      content,
      author: author || "System",
      createdAt: new Date(),
    }];

    return base.create({
      ...rest,
      noteNo,
      versions,
      relatedAccounts: snapshots,
      isDraft: payload.isDraft ?? true,
    });
  },

  /** Update a note (add a new version) */
  async update(id: string, payload: any) {
    const existing = await FinancialNote.findById(id);
    if (!existing) throw new Error("Note not found");

    const { content, author, relatedAccounts, ...rest } = payload;
    if (content) {
      const nextVersionNo = existing.versions.length > 0
        ? existing.versions[0].versionNo + 1
        : 1;
      existing.versions.unshift({
        versionNo: nextVersionNo,
        content,
        author: author || "System",
        createdAt: new Date(),
      });
    }

    if (relatedAccounts) {
      const accountIds = parseRelatedAccounts(relatedAccounts);
      existing.relatedAccounts = await getCurrentBalances(accountIds.map(a => a.accountId));
    }

    Object.assign(existing, rest);
    await existing.save();
    return existing;
  },

  /** Get a note with current live balances for all linked accounts */
  async getNoteWithCurrentBalances(id: string) {
    const note = await FinancialNote.findById(id).lean();
    if (!note) throw new Error("Note not found");

    const accountIds = (note.relatedAccounts || []).map((ra: any) => ra.account.toString());
    const now = new Date();
    const balanceMap = await getBalancesForPeriod(new Date(0), now);

    // Merge snapshot and current
    const mergedAccounts = (note.relatedAccounts || []).map((ra: any) => {
      const currentBalance = balanceMap.get(String(ra.account))?.closing ?? ra.snapshotBalance;
      return { ...ra, currentBalance };
    });

    // Optionally attach account names/codes for display
    const accounts = await Account.find({ _id: { $in: accountIds } }).lean();
    const accountMap = new Map(accounts.map(a => [String(a._id), a]));
    const enrichedAccounts = mergedAccounts.map(ra => {
      const acc = accountMap.get(String(ra.account));
      return { ...ra, name: acc?.name, code: acc?.code };
    });

    return { ...note, relatedAccounts: enrichedAccounts };
  },

  /** Finalise a note – capture fresh snapshots for all linked accounts */
  async finalise(id: string) {
    const note = await FinancialNote.findById(id);
    if (!note) throw new Error("Note not found");

    const accountIds = (note.relatedAccounts || []).map((ra: any) => ra.account.toString());
    note.relatedAccounts = await getCurrentBalances(accountIds);
    note.isDraft = false;
    await note.save();
    return note;
  },
};