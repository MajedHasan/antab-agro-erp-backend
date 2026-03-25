import { createCrudService } from "./crud.service";
import { FinancialNote } from "../models/financial-note.model";
import { Account } from "../models/account.model";

export const financialNoteService = createCrudService(FinancialNote, {
  softDeleteField: "deletedAt",
  searchFields: ["noteNo", "title", "summary", "versions.content"],

  async beforeCreate(data) {
    const relatedAccounts = await snapshotAccounts(data.relatedAccounts);

    data.versions = [
      {
        versionNo: 1,
        content: data.content,
        author: data.author || "System",
      },
    ];

    data.relatedAccounts = relatedAccounts;
    delete data.content;

    return data;
  },

  async beforeUpdate(data, existing) {
    const nextVersionNo = existing.versions[0].versionNo + 1;

    existing.versions.unshift({
      versionNo: nextVersionNo,
      content: data.content,
      author: data.author || "System",
    });

    if (data.relatedAccounts) {
      existing.relatedAccounts = await snapshotAccounts(data.relatedAccounts);
    }

    delete data.content;
    return existing;
  },
});

/* -------- helpers -------- */

async function snapshotAccounts(items: any[]) {
  if (!items?.length) return [];

  const accounts = await Account.find({
    _id: { $in: items.map((i) => i.accountId) },
  });

  return accounts.map((a) => ({
    account: a._id,
    snapshotBalance: a.balance,
  }));
}
