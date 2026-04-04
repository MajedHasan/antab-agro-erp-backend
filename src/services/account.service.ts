// src/services/account.service.ts
import { createCrudService } from "./crud.service";
import { Account } from "../models/account.model";
import { voucherService } from "./voucher.service";
import { VoucherLine } from "../models/voucher-line.model";
import { Types } from "mongoose";

/**
 * accountService: CRUD service for Account.
 * NOTE: we intentionally do NOT create opening vouchers inside an `afterCreate` hook
 * to avoid duplicate postings. Instead, controllers should call accountService.postOpening(...)
 * when they want to post an opening balance.
 */
export const accountService = createCrudService(Account, {
  softDeleteField: "deletedAt",
  searchFields: ["name", "code", "category"],
  defaultPopulate: [{ path: "parent" }],
});

/* ============================================================
   Override create(...) to support metadata-driven entity accounts
   - If payload.metadata.entityType + entityId exists, create (or
     return existing) an entity account under proper parent (AR/AP/etc).
   - This preserves existing flows (e.g. dealerService.create({ ..., metadata: { entityType:'Dealer', entityId } }))
   ============================================================ */
const originalCreate = (accountService as any).create.bind(accountService);

(accountService as any).create = async function (payload: any, opts: any = {}) {
  // If metadata indicates entity account creation, delegate to createAutoAccountForEntity to ensure correct parent
  try {
    const meta = payload?.metadata;
    if (
      meta &&
      typeof meta.entityType === "string" &&
      meta.entityType &&
      meta.entityId
    ) {
      // sanitize
      const entityType: "Dealer" | "Supplier" | "Product" = String(
        meta.entityType,
      ) as any;
      const entityId = String(meta.entityId);
      const name = payload.name ? String(payload.name).trim() : "";

      // Use createAutoAccountForEntity to ensure hierarchy & idempotency
      const ensured = await (accountService as any).createAutoAccountForEntity({
        entityType,
        entityId,
        name,
        productCategory: meta.productCategory,
      });

      // Apply optional overrides from payload (code, status, currency) if provided
      const updates: any = {};
      if (payload.code && payload.code !== ensured.code)
        updates.code = payload.code;
      if (payload.status && payload.status !== ensured.status)
        updates.status = payload.status;
      if (payload.currency && payload.currency !== ensured.currency)
        updates.currency = payload.currency;
      if (payload.category && payload.category !== ensured.category)
        updates.category = payload.category;

      if (Object.keys(updates).length) {
        const updated = await Account.findByIdAndUpdate(
          ensured._id,
          { $set: updates },
          { new: true },
        )
          .lean()
          .exec();
        return updated;
      }

      // return the ensured account (lean object)
      if ((ensured as any).toObject) return (ensured as any).toObject();
      return ensured;
    }
  } catch (err) {
    // if something goes wrong with entity path, fallback to normal create
    console.error("entity-create fallback:", err);
  }

  // Default behavior
  return originalCreate(payload, opts);
};

/* =========================================================
   Post opening voucher for a given account.
   (kept the same behavior as before)
========================================================= */
(accountService as any).postOpening = async function (
  accountId: string,
  amount: number,
  opts: { offsetAccountId?: string; date?: Date; narration?: string } = {},
) {
  if (!accountId) throw new Error("accountId required for postOpening");
  if (!amount || Math.abs(amount) < 0.0001) return null;

  // 1️⃣ load account
  const account = await Account.findById(accountId).lean();
  if (!account) throw new Error("Account not found for postOpening");

  // 2️⃣ If there's already a Posted Opening voucher line for this account, skip to avoid duplicates
  const existingOpening = await VoucherLine.aggregate([
    { $match: { accountId: new Types.ObjectId(accountId) } },
    {
      $lookup: {
        from: "vouchers",
        localField: "voucherId",
        foreignField: "_id",
        as: "voucher",
      },
    },
    { $unwind: "$voucher" },
    { $match: { "voucher.type": "Opening", "voucher.status": "Approved" } },
    { $limit: 1 },
    { $project: { _id: 1 } },
  ]).exec();

  if (existingOpening && existingOpening.length > 0) {
    // already posted; nothing to do
    return null;
  }

  // 3️⃣ Determine offset account id (use provided override if given)
  let offsetAccountId = opts.offsetAccountId ?? null;

  if (!offsetAccountId) {
    if (account.type === "Asset" || account.type === "Expense") {
      // prefer Liability, else Equity
      const liab = await Account.findOne({
        type: "Liability",
        deletedAt: { $exists: false },
      })
        .lean()
        .exec();
      if (liab) offsetAccountId = String(liab._id);
      else {
        const eq = await Account.findOne({
          type: "Equity",
          deletedAt: { $exists: false },
        })
          .lean()
          .exec();
        if (eq) offsetAccountId = String(eq._id);
      }
    } else {
      // Liability / Equity / Revenue -> debit offset under an Asset
      const asset = await Account.findOne({
        type: "Asset",
        deletedAt: { $exists: false },
      })
        .lean()
        .exec();
      if (asset) offsetAccountId = String(asset._id);
    }
  }

  if (!offsetAccountId) {
    // No logical offset found -> do not post
    console.warn(
      "No suitable offset account found for opening posting; skipping postOpening.",
    );
    return null;
  }

  // 4️⃣ Find offset account
  const offsetAcc = await Account.findById(offsetAccountId).lean();
  if (!offsetAcc) throw new Error("Offset account not found for postOpening");

  // 5️⃣ Find or create Opening Balance sub-head under offsetAcc
  let openingSub = await Account.findOne({
    parent: offsetAccountId,
    name: "Opening Balance",
    deletedAt: { $exists: false },
  })
    .lean()
    .exec();

  if (!openingSub) {
    // Create a direct Account document for the opening sub-head to avoid running the service hook again.
    // Build a reasonably-unique code (trimmed).
    const generatedCode = `${offsetAcc.code}-OB-${Date.now()}`.slice(0, 64);
    const created = await Account.create({
      code: generatedCode,
      name: "Opening Balance",
      parent: offsetAccountId,
      type: offsetAcc.type,
      currency: offsetAcc.currency || "USD",
      status: "Active",
    });
    openingSub = created.toObject ? created.toObject() : created;
  }

  if (!openingSub || !openingSub._id)
    throw new Error("Failed to ensure Opening Balance sub-head");

  // 6️⃣ Prepare voucher lines according to account nature
  const isDebitIncrease =
    account.type === "Asset" || account.type === "Expense";
  const narration = opts.narration || `Opening balance for ${account.name}`;
  const date = opts.date ?? new Date();

  const lines = isDebitIncrease
    ? [
        {
          accountId: String(accountId),
          debit: Number(amount) || 0,
          credit: 0,
          narration,
        },
        {
          accountId: String(openingSub._id),
          debit: 0,
          credit: Number(amount) || 0,
          narration,
        },
      ]
    : [
        {
          accountId: String(openingSub._id),
          debit: Number(amount) || 0,
          credit: 0,
          narration,
        },
        {
          accountId: String(accountId),
          debit: 0,
          credit: Number(amount) || 0,
          narration,
        },
      ];

  // 7️⃣ Create single Opening voucher (Approved -> createVoucher will mark Posted)
  const voucher = await voucherService.create({
    voucherNo: `OPEN-${Date.now()}`,
    date,
    type: "Opening",
    narration,
    status: "Approved",
    lines,
  });

  // 8️⃣ Clear cached account.balance (ledger is authoritative)
  await Account.findByIdAndUpdate(accountId, { $set: { balance: 0 } }).exec();

  return voucher;
};

/* =======================================================
   Ensure account exists helper (idempotent)
   ======================================================= */
async function ensureAccountExists({
  name,
  type,
  parentId = null,
  systemKey,
}: {
  name: string;
  type: string;
  parentId?: string | null;
  systemKey?: string;
}) {
  /* =====================================================
     1) IDENTITY CHECK (SYSTEM KEY - FAST PATH)
  ====================================================== */
  if (systemKey) {
    const byKey = await Account.findOne({
      systemKey,
      deletedAt: { $exists: false },
    }).exec();

    if (byKey) return byKey;
  }

  /* =====================================================
     2) CHECK BY NAME + PARENT (IDEMPOTENT)
  ====================================================== */
  const existing = await Account.findOne({
    name: name.trim(),
    parent: parentId || null,
    deletedAt: { $exists: false },
  }).exec();

  if (existing) return existing;

  /* =====================================================
     3) GENERATE SMART CODE (GENERIC AUTO-SEQUENCE)
        ✅ Works for ANY parent
        ✅ If parent exists → create sequential child code
  ====================================================== */

  let generatedCode: string;

  if (parentId) {
    const parent = await Account.findById(parentId)
      .select("code")
      .lean()
      .exec();

    const parentCode = parent?.code || "P";

    /*
      🔥 Generic Rule:
      If parent has children that follow pattern:
          PARENTCODE-XXXX
      then auto increment last number.
    */

    const regex = new RegExp(`^${parentCode}-(\\d+)$`);

    const lastChild = await Account.find({
      parent: parentId,
      code: regex,
    })
      .sort({ code: -1 })
      .limit(1)
      .lean();

    let nextNumber = 1001; // starting number

    if (lastChild.length) {
      const match = lastChild[0].code?.match(regex);
      if (match?.[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    generatedCode = `${parentCode}-${nextNumber}`;
  } else {
    /* =====================================================
       ROOT LEVEL FALLBACK
    ====================================================== */

    generatedCode = `${name
      .replace(/\s+/g, "-")
      .toUpperCase()
      .slice(0, 8)}-${Date.now()}`;
  }

  /* =====================================================
     4) CREATE ACCOUNT
  ====================================================== */

  const created = await Account.create({
    code: generatedCode,
    name: name.trim(),
    parent: parentId || null,
    type,
    currency: "USD",
    status: "Active",
    ...(systemKey ? { systemKey } : {}),
  });

  return created;
}

/* =======================================================
   Get or create account by path (idempotent)
   - path: array of account names in hierarchical order
   - type: type for the leaf account (Asset/Expense/Liability/Revenue/Equity)
   - session: optional mongoose session for transaction
   ======================================================= */
(accountService as any).getAccountByPath = async function (
  path: string[],
  type: string = "Asset",
  opts: { session?: any; currency?: string } = {},
) {
  if (!Array.isArray(path) || path.length === 0) {
    throw new Error("Path array is required to getAccountByPath");
  }

  const session = opts.session || null;
  const currency = opts.currency || "USD";

  let parentId: string | null = null;
  let account: any = null;

  for (let i = 0; i < path.length; i++) {
    const name = path[i].trim();

    // Case-insensitive search using regex
    account = await Account.findOne({
      parent: parentId,
      deletedAt: { $exists: false },
      name: { $regex: new RegExp(`^${name}$`, "i") }, // i -> ignore case
    })
      .session(session)
      .exec();

    if (!account) {
      // CREATE if not exists
      account = await Account.create(
        [
          {
            name,
            parent: parentId,
            type, // always use passed type
            currency,
            status: "Active",
            code: `${parentId ? parentId.toString().slice(-4) : "ROOT"}-${Date.now()}-${i}`.slice(
              0,
              48,
            ),
          },
        ],
        { session },
      ).then((docs: any) => docs[0]);
    }

    parentId = String(account._id);
  }

  return account;
};

/* =======================================================
   Create (or return existing) auto account for an entity.
   - Dealer => under Accounts Receivable
   - Supplier => under Accounts Payable
   - Product => under Inventory categories
   This function is idempotent via systemKey usage.
   ======================================================= */
(accountService as any).createAutoAccountForEntity = async function (opts: {
  entityType: "Dealer" | "Supplier" | "Product";
  entityId: string;
  name: string;
  productCategory?: "Raw" | "Packaging" | "Finished";
}) {
  if (!opts || !opts.entityType || !opts.entityId || !opts.name)
    throw new Error("entityType, entityId and name are required");

  const entityType = opts.entityType;
  const entityId = String(opts.entityId);
  const name = String(opts.name).trim();
  const productCategory = opts.productCategory;

  // 1) Ensure top-level roots
  const assets = await ensureAccountExists({
    name: "Assets",
    type: "Asset",
    parentId: null,
    systemKey: "coa_root_assets",
  });

  const liabilities = await ensureAccountExists({
    name: "Liabilities",
    type: "Liability",
    parentId: null,
    systemKey: "coa_root_liabilities",
  });

  // 2) Ensure current/working groups
  const currentAssets = await ensureAccountExists({
    name: "Current Assets",
    type: "Asset",
    parentId: String(assets._id),
    systemKey: "coa_current_assets",
  });

  const currentLiabilities = await ensureAccountExists({
    name: "Current Liabilities",
    type: "Liability",
    parentId: String(liabilities._id),
    systemKey: "coa_current_liabilities",
  });

  // 3) Inventory control under Current Assets
  const inventory = await ensureAccountExists({
    name: "Inventory",
    type: "Asset",
    parentId: String(currentAssets._id),
    systemKey: "coa_inventory",
  });

  // 4) Ensure AR / AP controls
  const accountsReceivable = await ensureAccountExists({
    name: "Accounts Receivable",
    type: "Asset",
    parentId: String(currentAssets._id),
    systemKey: "coa_accounts_receivable",
  });

  const accountsPayable = await ensureAccountExists({
    name: "Accounts Payable",
    type: "Liability",
    parentId: String(currentLiabilities._id),
    systemKey: "coa_accounts_payable",
  });

  // 5) Branch by entity type
  let resultAccount: any = null;
  const systemKeyForEntity = `${entityType.toLowerCase()}:${entityId}`;

  if (entityType === "Dealer") {
    // Dealer under Accounts Receivable
    resultAccount = await ensureAccountExists({
      name,
      type: "Asset",
      parentId: String(accountsReceivable._id),
      systemKey: systemKeyForEntity,
    });

    // If name changed, ensure account name matches (keep it updated)
    if (resultAccount.name !== name) {
      resultAccount.name = name;
      await resultAccount.save();
    }
    return resultAccount;
  }

  if (entityType === "Supplier") {
    // Supplier under Accounts Payable
    resultAccount = await ensureAccountExists({
      name,
      type: "Liability",
      parentId: String(accountsPayable._id),
      systemKey: systemKeyForEntity,
    });

    if (resultAccount.name !== name) {
      resultAccount.name = name;
      await resultAccount.save();
    }
    return resultAccount;
  }

  if (entityType === "Product") {
    // ensure Inventory categories
    const rawParent = await ensureAccountExists({
      name: "Raw Materials",
      type: "Asset",
      parentId: String(inventory._id),
      systemKey: "coa_inventory_raw_materials",
    });

    const packagingParent = await ensureAccountExists({
      name: "Packaging Materials",
      type: "Asset",
      parentId: String(inventory._id),
      systemKey: "coa_inventory_packaging_materials",
    });

    const wipParent = await ensureAccountExists({
      name: "Work In Progress",
      type: "Asset",
      parentId: String(inventory._id),
      systemKey: "coa_inventory_wip",
    });

    const finishedParent = await ensureAccountExists({
      name: "Finished Goods",
      type: "Asset",
      parentId: String(inventory._id),
      systemKey: "coa_inventory_finished_goods",
    });

    // choose parent based on productCategory
    let chosenParentId: string | null = null;
    if (productCategory === "Raw") chosenParentId = String(rawParent._id);
    else if (productCategory === "Packaging")
      chosenParentId = String(packagingParent._id);
    else if (productCategory === "Finished")
      chosenParentId = String(finishedParent._id);
    else {
      // fallback: WIP if not specified
      chosenParentId = String(wipParent._id);
    }

    resultAccount = await ensureAccountExists({
      name,
      type: "Asset",
      parentId: chosenParentId,
      systemKey: systemKeyForEntity,
    });

    if (resultAccount.name !== name) {
      resultAccount.name = name;
      await resultAccount.save();
    }

    return resultAccount;
  }

  // Fallback: create under Assets root
  resultAccount = await ensureAccountExists({
    name,
    type: "Asset",
    parentId: String(assets._id),
    systemKey: systemKeyForEntity,
  });

  if (resultAccount.name !== name) {
    resultAccount.name = name;
    await resultAccount.save();
  }

  return resultAccount;
};

/* =======================================================
   Sync account name for an entity (idempotent).
   Use this from your entity update hooks (e.g. dealer.service.beforeUpdate)
   so when a dealer/supplier/product name changes, the linked COA account is renamed.
======================================================= */
(accountService as any).syncAccountNameForEntity = async function (opts: {
  entityType: "Dealer" | "Supplier" | "Product";
  entityId: string;
  newName: string;
}) {
  if (!opts || !opts.entityType || !opts.entityId || !opts.newName)
    throw new Error("entityType, entityId and newName are required");

  const systemKeyForEntity = `${opts.entityType.toLowerCase()}:${String(
    opts.entityId,
  )}`;

  // const acc = await Account.findOne({
  //   systemKey: systemKeyForEntity,
  //   deletedAt: { $exists: false },
  // }).exec();

  const acc = await Account.findById(opts.entityId).exec();

  if (!acc) {
    // nothing to sync
    return null;
  }

  if (acc.name !== opts.newName) {
    acc.name = String(opts.newName).trim();
    await acc.save();
  }

  return acc;
};
