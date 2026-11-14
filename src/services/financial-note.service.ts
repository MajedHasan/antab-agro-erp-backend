// src/services/financial-note.service.ts
import { createCrudService } from "./crud.service";
import { FinancialNote } from "../models/financial-note.model";
import { Account } from "../models/account.model";
import { getBalancesForPeriod } from "./ledger.service";
import { Types } from "mongoose";

const base = createCrudService(FinancialNote, {
  softDeleteField: "deletedAt",
  searchFields: ["noteNo", "title", "summary", "sections.body", "versions.content"],
});

/* ============================================================
   ROLLUP RESOLVER
   ────────────────────────────────────────────────────────────
   Given an array of selected account IDs, produce a set of
   "resolved" accounts where:
     • if a parent is selected, ALL descendants are included
     • descendants of a selected parent are removed (no double count)
     • each surviving selection carries snapshotBalance = sum of
       its own balance + all descendant balances
   ============================================================ */

type RawAccount = {
  _id: any;
  code: string;
  name: string;
  parent?: any;
  balance?: number;
  openingBalance?: number;
  closingBalance?: number;
};

async function loadAllAccounts(): Promise<RawAccount[]> {
  return Account.find({ deletedAt: { $exists: false } })
    .select("_id code name parent balance openingBalance closingBalance")
    .lean() as any;
}

function buildChildrenMap(accounts: RawAccount[]): Map<string, RawAccount[]> {
  const map = new Map<string, RawAccount[]>();
  for (const a of accounts) {
    const parentId = a.parent ? String(a.parent) : null;
    if (!parentId) continue;
    if (!map.has(parentId)) map.set(parentId, []);
    map.get(parentId)!.push(a);
  }
  return map;
}

function collectDescendants(
  accountId: string,
  childrenMap: Map<string, RawAccount[]>,
  accountsById: Map<string, RawAccount>,
): RawAccount[] {
  const out: RawAccount[] = [];
  const walk = (id: string) => {
    const children = childrenMap.get(id) || [];
    for (const c of children) {
      out.push(c);
      walk(String(c._id));
    }
  };
  walk(accountId);
  return out;
}

/** Sum of an account's own balance + every descendant's balance. */
function computeRollupBalance(
  accountId: string,
  accountsById: Map<string, RawAccount>,
  childrenMap: Map<string, RawAccount[]>,
  liveBalances: Map<string, number>,
): number {
  const self = accountsById.get(accountId);
  if (!self) return 0;
  const own =
    liveBalances.get(accountId) ??
    Number(self.closingBalance ?? self.balance ?? 0);
  const descendants = collectDescendants(accountId, childrenMap, accountsById);
  let total = own;
  for (const d of descendants) {
    const b =
      liveBalances.get(String(d._id)) ??
      Number(d.closingBalance ?? d.balance ?? 0);
    total += b;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Given raw selected account IDs, produce the RESOLVED array used for the
 * note. Behavior:
 *   1. If both a parent and one of its children are selected → keep parent,
 *      drop child (the child is already rolled up).
 *   2. For each surviving account, compute its rolled-up balance and
 *      capture the leaf breakdown as `rolledUpLeaves` so the user can see
 *      which leaf accounts contributed.
 */
async function resolveAccountsWithRollup(
  selectedIds: string[],
): Promise<
  Array<{
    account: Types.ObjectId;
    accountCode: string;
    accountName: string;
    isParentRollup: boolean;
    rolledUpLeaves: Array<{
      account: Types.ObjectId;
      code: string;
      name: string;
      snapshotBalance: number;
    }>;
    snapshotBalance: number;
  }>
> {
  const cleanIds = Array.from(
    new Set(selectedIds.filter((id) => Types.ObjectId.isValid(id))),
  );
  if (!cleanIds.length) return [];

  const allAccounts = await loadAllAccounts();
  const accountsById = new Map(allAccounts.map((a) => [String(a._id), a]));
  const childrenMap = buildChildrenMap(allAccounts);

  // pull live closing balances from the ledger
  let liveBalances = new Map<string, number>();
  try {
    const now = new Date();
    const balanceMap = await getBalancesForPeriod(new Date(0), now);
    for (const [id, v] of balanceMap.entries()) {
      liveBalances.set(String(id), Number((v as any)?.closing ?? 0));
    }
  } catch {
    liveBalances = new Map();
  }

  // Step 1 — drop IDs that are descendants of another selected ID
  const descendantOfSelected = new Set<string>();
  for (const id of cleanIds) {
    const descendants = collectDescendants(id, childrenMap, accountsById);
    for (const d of descendants) descendantOfSelected.add(String(d._id));
  }
  const survivingIds = cleanIds.filter((id) => !descendantOfSelected.has(id));

  // Step 2 — for each survivor, compute rolled-up balance + leaf breakdown
  return survivingIds.map((id) => {
    const acc = accountsById.get(id);
    if (!acc) {
      return {
        account: new Types.ObjectId(id),
        accountCode: "",
        accountName: "(missing)",
        isParentRollup: false,
        rolledUpLeaves: [],
        snapshotBalance: 0,
      };
    }

    const hasChildren = (childrenMap.get(id) || []).length > 0;
    const descendants = collectDescendants(id, childrenMap, accountsById);
    const rolledUpLeaves = descendants.map((d) => ({
      account: d._id as Types.ObjectId,
      code: d.code,
      name: d.name,
      snapshotBalance: round2(
        liveBalances.get(String(d._id)) ??
          Number(d.closingBalance ?? d.balance ?? 0),
      ),
    }));

    return {
      account: acc._id as Types.ObjectId,
      accountCode: acc.code,
      accountName: acc.name,
      isParentRollup: hasChildren,
      rolledUpLeaves,
      snapshotBalance: computeRollupBalance(
        id,
        accountsById,
        childrenMap,
        liveBalances,
      ),
    };
  });
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/* ---------- note number helpers ---------- */
async function nextDisplayOrder(year: number, statement: string) {
  const last = await FinancialNote.findOne({
    year,
    statement,
    deletedAt: { $exists: false },
  })
    .sort({ displayOrder: -1 })
    .select("displayOrder")
    .lean();
  return (last?.displayOrder ?? 0) + 1;
}

async function renumberGroup(year: number, statement: string) {
  const notes = await FinancialNote.find({
    year,
    statement,
    deletedAt: { $exists: false },
  })
    .sort({ displayOrder: 1, createdAt: 1 })
    .select("_id")
    .lean();

  for (let i = 0; i < notes.length; i++) {
    const expected = i + 1;
    await FinancialNote.updateOne(
      { _id: notes[i]._id, displayOrder: { $ne: expected } },
      { $set: { displayOrder: expected, noteNo: `Note ${expected}` } },
    );
  }
}

function parseIds(input: any[]): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((i) => String(i?.accountId ?? i?.account ?? ""))
    .filter((id) => Types.ObjectId.isValid(id));
}

/* ============================================================
   SERVICE
   ============================================================ */
export const financialNoteService = {
  ...base,

  async list(params: any = {}) {
    const {
      page = 1,
      limit = 15,
      statement,
      year,
      noteType,
      status,
      q,
      sort = "year:desc,statement:asc,displayOrder:asc",
      ...rest
    } = params;

    const filter: any = {};
    if (statement) filter.statement = statement;
    if (year) filter.year = Number(year);
    if (noteType) filter.noteType = noteType;
    if (status === "draft") filter.isDraft = true;
    if (status === "final") filter.isDraft = false;

    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { noteNo: rx },
        { title: rx },
        { summary: rx },
        { "sections.body": rx },
        { "versions.content": rx },
      ];
    }

    return base.list({ ...rest, page, limit, filter, sort });
  },

  async getNextNoteNumber(year: number, statement: string) {
    const order = await nextDisplayOrder(year, statement);
    return { displayOrder: order, noteNo: `Note ${order}` };
  },

  async create(payload: any) {
    if (!payload.title) throw new Error("Title is required");
    if (!payload.year) throw new Error("Year is required");
    if (!payload.statement) throw new Error("Statement is required");

    const displayOrder =
      payload.displayOrder ??
      (await nextDisplayOrder(payload.year, payload.statement));

    // 🔑 THE FIX — resolve with rollup, not raw IDs
    const accountIds = parseIds(payload.relatedAccounts || []);
    const resolvedAccounts = await resolveAccountsWithRollup(accountIds);

    const initialSections = Array.isArray(payload.sections)
      ? payload.sections
      : [];

    const initialContent = payload.content || "";
    const summary = payload.summary || "";

    const created = await base.create({
      noteNo: `Note ${displayOrder}`,
      displayOrder,
      title: payload.title,
      statement: payload.statement,
      noteType: payload.noteType || "TABULAR",
      year: Number(payload.year),
      summary,
      statementRef: payload.statementRef || undefined,
      relatedAccounts: resolvedAccounts,
      sections: initialSections,
      versions: [
        {
          versionNo: 1,
          content: initialContent,
          sections: initialSections,
          summary,
          author: payload.author || "System",
          createdAt: new Date(),
          kind: "CREATED",
        },
      ],
      isDraft: payload.isDraft ?? true,
      templateKey: payload.templateKey || undefined,
      parentNoteId: payload.parentNoteId || null,
    });

    await renumberGroup(Number(payload.year), payload.statement);
    return created;
  },

  async update(id: string, payload: any) {
    const existing = await FinancialNote.findById(id);
    if (!existing) throw new Error("Note not found");

    if (!existing.isDraft && !payload.forceFinalised) {
      throw new Error(
        "Finalised notes are locked. Reopen first or pass forceFinalised: true.",
      );
    }

    const mutable = [
      "title",
      "statement",
      "noteType",
      "year",
      "summary",
      "statementRef",
      "templateKey",
      "parentNoteId",
    ] as const;
    for (const f of mutable) {
      if (payload[f] !== undefined) (existing as any)[f] = payload[f];
    }

    let newSections = existing.sections as any[];

    if (payload.sections !== undefined) {
      newSections = payload.sections;
      existing.sections = newSections as any;
    }

    // 🔑 re-resolve accounts with rollup if provided
    if (payload.relatedAccounts !== undefined) {
      const accountIds = parseIds(payload.relatedAccounts);
      existing.relatedAccounts = (await resolveAccountsWithRollup(
        accountIds,
      )) as any;
    }

    // push new version
    const nextVersionNo = (existing.versions[0]?.versionNo || 0) + 1;
    const changedContent =
      payload.content !== undefined && payload.content !== existing.versions[0]?.content;

    if (changedContent || payload.sections !== undefined || payload.summary !== undefined) {
      existing.versions.unshift({
        versionNo: nextVersionNo,
        content: payload.content ?? existing.versions[0]?.content ?? "",
        sections: newSections,
        summary: payload.summary ?? existing.versions[0]?.summary ?? "",
        author: payload.author || "System",
        createdAt: new Date(),
        kind: "UPDATED",
      } as any);
    }

    await existing.save();
    return existing;
  },

  async getNoteWithCurrentBalances(id: string) {
    const note = await FinancialNote.findById(id).lean();
    if (!note) throw new Error("Note not found");

    const related = ((note as any).relatedAccounts || []) as any[];

    // re-resolve with rollup so live balances reflect current state
    const refreshed = await resolveAccountsWithRollup(
      related.map((ra) => String(ra.account)),
    );

    // merge currentBalance into each related row
    let balanceMap = new Map<string, number>();
    try {
      const now = new Date();
      const bm = await getBalancesForPeriod(new Date(0), now);
      for (const [k, v] of bm.entries()) {
        balanceMap.set(String(k), Number((v as any)?.closing ?? 0));
      }
    } catch {}

    const enriched = refreshed.map((r) => ({
      ...r,
      currentBalance: r.snapshotBalance, // for now; refresh via ledger if needed
      // also enrich leaves with currentBalance
      rolledUpLeaves: r.rolledUpLeaves.map((leaf) => ({
        ...leaf,
        currentBalance:
          balanceMap.get(String(leaf.account)) ?? leaf.snapshotBalance,
      })),
    }));

    return { ...(note as any), relatedAccounts: enriched };
  },

  async finalise(id: string, finalisedBy?: string) {
    const note = await FinancialNote.findById(id);
    if (!note) throw new Error("Note not found");

    // Re-snapshot every linked account (fresh rollup)
    const accountIds = (note.relatedAccounts || []).map((ra: any) =>
      String(ra.account),
    );
    note.relatedAccounts = (await resolveAccountsWithRollup(accountIds)) as any;

    note.isDraft = false;
    note.finalisedAt = new Date();
    note.finalisedBy = finalisedBy || "System";
    (note as any).versions.unshift({
      versionNo: (note.versions[0]?.versionNo || 0) + 1,
      content: note.versions[0]?.content || "",
      sections: note.versions[0]?.sections || [],
      summary: "Finalised",
      author: finalisedBy || "System",
      createdAt: new Date(),
      kind: "FINALISED",
    } as any);

    await note.save();
    return note;
  },

  async reopen(id: string, reopenedBy?: string) {
    const note = await FinancialNote.findById(id);
    if (!note) throw new Error("Note not found");
    if (note.isDraft) return note;

    note.isDraft = true;
    note.finalisedAt = undefined as any;
    note.finalisedBy = undefined as any;
    (note as any).versions.unshift({
      versionNo: (note.versions[0]?.versionNo || 0) + 1,
      content: note.versions[0]?.content || "",
      sections: note.versions[0]?.sections || [],
      summary: "Reopened",
      author: reopenedBy || "System",
      createdAt: new Date(),
      kind: "UPDATED",
    } as any);

    await note.save();
    return note;
  },

  async move(id: string, direction: "up" | "down") {
    const note = await FinancialNote.findById(id);
    if (!note) throw new Error("Note not found");

    const group = await FinancialNote.find({
      year: note.year,
      statement: note.statement,
      deletedAt: { $exists: false },
    })
      .sort({ displayOrder: 1, createdAt: 1 })
      .select("_id displayOrder")
      .lean();

    const idx = group.findIndex((g) => String(g._id) === String(note._id));
    if (idx === -1) throw new Error("Not in its group");

    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= group.length) return note;

    const a = group[idx];
    const b = group[swapWith];
    const aOrder = a.displayOrder;
    const bOrder = b.displayOrder;

    await FinancialNote.updateOne({ _id: a._id }, { $set: { displayOrder: -1 } });
    await FinancialNote.updateOne(
      { _id: b._id },
      { $set: { displayOrder: aOrder, noteNo: `Note ${aOrder}` } },
    );
    await FinancialNote.updateOne(
      { _id: a._id },
      { $set: { displayOrder: bOrder, noteNo: `Note ${bOrder}` } },
    );

    await renumberGroup(note.year, note.statement);
    return FinancialNote.findById(id);
  },

  async remove(id: string) {
    const note = await FinancialNote.findById(id);
    if (!note) throw new Error("Note not found");
    if (!note.isDraft) throw new Error("Reopen before deleting");

    const { year, statement } = note;
    await base.remove(id, { hard: false });
    await renumberGroup(year, statement);
    return note;
  },
};