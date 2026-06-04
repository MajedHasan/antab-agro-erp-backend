// src/services/collection.service.ts
import mongoose from "mongoose";
import Collection from "./collection.model";
import mediaModel from "../../models/media.model";
import { VoucherAccount } from "../../models/voucher-account.model";
import DealerModel from "../../models/dealer.model";
import SalesInvoice from "../../models/sales-invoice.model";
import { Voucher } from "../../models/voucher.model";
import { VoucherLine } from "../../models/voucher-line.model";
import { createCrudService } from "../../services/crud.service";
import { accountService } from "../../services/account.service";

type UploadedFile = {
  fieldname?: string;
  originalname?: string;
  filename?: string;
  path?: string;
  mimetype?: string;
  size?: number;
};

type CollectionInput = any;

const base = createCrudService(Collection, {
  defaultSort: "-createdAt",
  defaultPopulate: [
    "dealers.dealerId",
    "dealers.invoices.invoiceId",
    "dealers.invoices.moneyReceipts.mediaId",
    "onlineCopy.mediaId",
    {
      path: "onlineCopy.bankAccountId",
      populate: { path: "accountId", select: "name code type balance status" },
    },
    {
      path: "workflowLogs.by",
      select: "name email",
    },
  ],
  searchFields: [
    "voucherNo",
    "onlineCopy.onlineCopyNo",
    "dealers.dealerName",
    "dealers.invoices.invoiceNo",
    "dealers.invoices.moneyReceipts.mrNo",
  ],
  allowedFilterFields: [
    "voucherNo",
    "date",
    "status",
    "onlineCopy.onlineCopyNo",
    "dealers.dealerId",
    "dealers.invoices.invoiceId",
    "dealers.invoices.moneyReceipts.mrNo",
    "dealers.invoices.invoiceNo",
  ],
});

// ── Utility functions (unchanged) ──────────────────────
function cleanText(value: any) {
  return String(value ?? "").trim();
}

function toNumber(value: any, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(value: any) {
  const n = toNumber(value, 0);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sameMoney(a: any, b: any) {
  return roundMoney(a) === roundMoney(b);
}

function sumBy<T>(items: T[], getter: (item: T) => number) {
  return roundMoney(
    items.reduce((sum, item) => sum + toNumber(getter(item), 0), 0),
  );
}

function parseJsonMaybe(value: any) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value ?? {};
}

function isValidObjectId(value: any) {
  return mongoose.Types.ObjectId.isValid(String(value ?? "").trim());
}

function requireObjectId(value: any, fieldName: string) {
  const id = cleanText(value);
  if (!id) throw new Error(`${fieldName} is required`);
  if (!isValidObjectId(id)) throw new Error(`Invalid ${fieldName}`);
  return id;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getActorId(input: any) {
  const userId =
    input?.user?._id || input?.user?.id || input?.actorId || input?.userId;
  const cleaned = cleanText(userId);
  if (!cleaned) return null;
  if (!isValidObjectId(cleaned)) throw new Error("Invalid actor user id");
  return cleaned;
}

function parseDateOrThrow(value: any, fieldName: string) {
  const text = cleanText(value);
  if (!text) throw new Error(`${fieldName} is required`);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ${fieldName}`);
  return date;
}

function parsePayload(rawPayload: CollectionInput) {
  const parsed = parseJsonMaybe(rawPayload?.collection ?? rawPayload);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid collection payload");
  }
  return parsed;
}

// ── Types ─────────────────────────────────────────────
type NormalizedCommission = {
  mode: "FIXED" | "PERCENT";
  value: number;
  amount: number;
};

type NormalizedMoneyReceipt = {
  mrNo: string;
  mrDate: Date;
  taka: number;
  commission: NormalizedCommission;
  deductCommission: boolean;
  mediaId: string | null;
};

type NormalizedInvoice = {
  invoiceId: string;
  invoiceNo: string;
  moneyReceipts: NormalizedMoneyReceipt[];
};

type NormalizedDealer = {
  dealerId: string;
  dealerName: string;
  invoices: NormalizedInvoice[];
};

type InvoiceApprovalPlan = {
  dealerId: string;
  dealerName: string;
  invoiceId: string;
  invoiceNo: string;
  amount: number;
  commission: number;
  mrNos: string[];
};

type DealerApprovalPlan = {
  dealerId: string;
  dealerName: string;
  amount: number;
  commission: number;
  invoicePlans: InvoiceApprovalPlan[];
  currentDue: number;
  creditLimit: number;
  availableBefore: number;
  availableAfter: number;
};

// ── Commission helpers ─────────────────────────────────
function normalizeCommission(
  rawCommission: any,
  taka: number,
): NormalizedCommission {
  const raw =
    typeof rawCommission === "number"
      ? { mode: "FIXED", value: rawCommission }
      : (rawCommission ?? {});
  const mode = String(raw.mode ?? "FIXED").toUpperCase();
  if (mode !== "FIXED" && mode !== "PERCENT")
    throw new Error("Commission mode must be FIXED or PERCENT");
  const value = toNumber(raw.value, NaN);
  if (!Number.isFinite(value) || value < 0)
    throw new Error("Commission value must be a valid non-negative number");
  const amount =
    mode === "PERCENT"
      ? roundMoney((roundMoney(taka) * roundMoney(value)) / 100)
      : roundMoney(value);
  if (
    raw.amount !== undefined &&
    raw.amount !== null &&
    !sameMoney(raw.amount, amount)
  ) {
    throw new Error("Commission amount does not match the selected mode/value");
  }
  return { mode, value: roundMoney(value), amount };
}

function extractCommissionAmount(commission: any) {
  if (!commission) return 0;
  if (typeof commission === "number") return roundMoney(commission);
  return roundMoney(commission?.amount ?? 0);
}

// ── Summary computation ───────────────────────────────
function computeSummary(doc: any) {
  const dealers = Array.isArray(doc?.dealers) ? doc.dealers : [];
  const onlineCopy = doc?.onlineCopy ?? {};

  let totalInvoices = 0;
  let totalMRAmount = 0;
  let totalCommission = 0;
  let totalDeductCommission = 0;
  const uniqueMrNos = new Set<string>();

  for (const dealer of dealers) {
    const invoices = Array.isArray(dealer?.invoices) ? dealer.invoices : [];
    totalInvoices += invoices.length;
    for (const invoice of invoices) {
      const mrs = Array.isArray(invoice?.moneyReceipts)
        ? invoice.moneyReceipts
        : [];
      for (const mr of mrs) {
        const mrNo = cleanText(mr?.mrNo);
        if (!mrNo) continue;
        uniqueMrNos.add(mrNo);

        const taka = roundMoney(mr?.taka ?? 0);
        const comm = roundMoney(extractCommissionAmount(mr?.commission));
        const deduct = Boolean(mr?.deductCommission ?? false);

        totalMRAmount = roundMoney(totalMRAmount + taka);
        totalCommission = roundMoney(totalCommission + comm);
        if (deduct) {
          totalDeductCommission = roundMoney(totalDeductCommission + comm);
        }
      }
    }
  }

  const bankDepositCharge = roundMoney(onlineCopy?.bankDepositCharge ?? 0);

  return {
    totalDealers: dealers.length,
    totalInvoices,
    totalMoneyReceipts: uniqueMrNos.size,
    totalMRAmount,
    totalCommission,
    totalDeductCommission,
    bankDepositCharge,
    totalNetDeposited: roundMoney(
      totalMRAmount - totalDeductCommission - bankDepositCharge,
    ),
  };
}

// ── Validation helpers (unchanged) ────────────────────
async function validateMediaIds(mediaIds: string[]) {
  const ids = Array.from(
    new Set((mediaIds ?? []).map((id) => cleanText(id)).filter(Boolean)),
  );
  if (!ids.length) return;
  const found = await mediaModel
    .find({ _id: { $in: ids }, deletedAt: null })
    .select("_id")
    .lean();
  const foundIds = new Set(found.map((item: any) => String(item._id)));
  const missing = ids.filter((id) => !foundIds.has(String(id)));
  if (missing.length) throw new Error(`Media not found: ${missing.join(", ")}`);
}

async function validateBankAccount(bankAccountId: string, session?: any) {
  const bank = await VoucherAccount.findById(bankAccountId)
    .session(session ?? null)
    .populate({ path: "accountId", select: "name code type balance status" });
  if (!bank) throw new Error("Selected bank account not found");
  if (!bank.isActive) throw new Error("Selected bank account is inactive");
  if (bank.role !== "Bank")
    throw new Error("Selected account is not a bank account");
  const allowed = new Set(
    (bank.allowedVoucherTypes ?? []).map((x: any) => String(x)),
  );
  if (
    !allowed.has("Collection") &&
    !allowed.has("BankReceive") &&
    !allowed.has("Bank Payment")
  ) {
    throw new Error("Selected bank is not allowed for Collection");
  }
  if (!bank.accountId)
    throw new Error("Selected bank account is not linked to chart of accounts");
  return bank;
}

async function ensureUniqueOnlineCopyNo(
  onlineCopyNo: string | null,
  excludeId?: string,
) {
  if (!onlineCopyNo) return;
  const existing = await Collection.findOne({
    "onlineCopy.onlineCopyNo": onlineCopyNo,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).lean();
  if (existing) throw new Error("Online Copy No already exists");
}

function buildWorkflowLog(action: string, by: any, remarks?: string | null) {
  return {
    action,
    by: by ?? null,
    at: new Date(),
    remarks: cleanText(remarks) || null,
  };
}

function buildTransitionPatch(
  existing: any,
  nextStatus: string,
  actorId: string,
  remarks?: string | null,
) {
  return {
    status: nextStatus,
    workflowLogs: [
      ...(existing?.workflowLogs ?? []),
      buildWorkflowLog(nextStatus, actorId, remarks),
    ],
  };
}

function canEditStatus(status: string) {
  return ["SUBMITTED", "UNDER_REVIEW", "HOLD", "DISPUTED"].includes(status);
}

function isTransitionAllowed(fromStatus: string, toStatus: string) {
  const allowed: Record<string, string[]> = {
    SUBMITTED: ["UNDER_REVIEW", "APPROVED", "HOLD", "DISPUTED", "CANCELLED"],
    UNDER_REVIEW: ["APPROVED", "HOLD", "DISPUTED", "CANCELLED", "SUBMITTED"],
    HOLD: ["SUBMITTED", "UNDER_REVIEW", "DISPUTED", "CANCELLED", "APPROVED"],
    DISPUTED: ["SUBMITTED", "UNDER_REVIEW", "HOLD", "CANCELLED", "APPROVED"],
    APPROVED: [],
    CANCELLED: [],
  };

  return allowed[fromStatus]?.includes(toStatus) ?? false;
}

async function generateVoucherNo() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const prefix = `COL-${yyyy}${mm}${dd}`;

  const count = await Collection.countDocuments({
    voucherNo: new RegExp(`^${escapeRegex(prefix)}-`),
  });

  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

function buildAccountingDraft(normalized: any) {
  return {
    dealers: (normalized.dealers ?? []).map((dealer: NormalizedDealer) => ({
      dealerId: dealer.dealerId,
      dealerName: dealer.dealerName,
      invoices: dealer.invoices.map((invoice: NormalizedInvoice) => ({
        invoiceId: invoice.invoiceId,
        invoiceNo: invoice.invoiceNo,
        moneyReceipts: invoice.moneyReceipts.map((mr) => ({
          mrNo: mr.mrNo,
          mrDate: mr.mrDate,
          taka: roundMoney(mr.taka),
          commission: {
            mode: mr.commission.mode,
            value: roundMoney(mr.commission.value),
            amount: roundMoney(mr.commission.amount),
          },
          commissionAmount: roundMoney(mr.commission.amount),
          deductCommission: mr.deductCommission,
          mediaId: mr.mediaId,
        })),
        totalMRAmount: sumBy(invoice.moneyReceipts, (mr) => mr.taka),
        totalCommission: sumBy(
          invoice.moneyReceipts,
          (mr) => mr.commission.amount,
        ),
        netAmount: roundMoney(
          sumBy(invoice.moneyReceipts, (mr) => mr.taka) -
            sumBy(invoice.moneyReceipts, (mr) => mr.commission.amount),
        ),
      })),
    })),
    onlineCopy: {
      onlineCopyNo: normalized.onlineCopy?.onlineCopyNo,
      onlineCopyDate: normalized.onlineCopy?.onlineCopyDate,
      onlineCopyTaka: roundMoney(normalized.onlineCopy?.onlineCopyTaka ?? 0),
      bankDepositCharge: roundMoney(
        normalized.onlineCopy?.bankDepositCharge ?? 0,
      ),
      bankAccountId: normalized.onlineCopy?.bankAccountId ?? null,
      mediaId: normalized.onlineCopy?.mediaId,
    },
    totals: normalized.summary,
    commissionTotal: roundMoney(normalized.summary?.totalCommission ?? 0),
    netBankAmount: roundMoney(
      (normalized.summary?.totalMRAmount ?? 0) -
        (normalized.summary?.totalDeductCommission ?? 0) -
        (normalized.summary?.bankDepositCharge ?? 0),
    ),
  };
}

// ── Core validation & normalization ─────────────────
function normalizeAndValidatePayload(rawPayload: CollectionInput) {
  const raw = parsePayload(rawPayload);
  const dealersInput = Array.isArray(raw?.dealers) ? raw.dealers : [];
  if (!dealersInput.length) throw new Error("At least one dealer is required");

  const dealerIdsSeen = new Set<string>();
  const invoiceIdsSeen = new Set<string>();
  const mrDealerMap = new Map<string, string>();

  const dealers: NormalizedDealer[] = dealersInput.map(
    (dealer: any, dealerIndex: number) => {
      const dealerId = requireObjectId(
        dealer?.dealerId,
        `Dealer ${dealerIndex + 1}: dealerId`,
      );
      const dealerName = cleanText(dealer?.dealerName);
      if (!dealerName)
        throw new Error(`Dealer ${dealerIndex + 1}: dealerName is required`);
      if (dealerIdsSeen.has(dealerId))
        throw new Error(`Duplicate dealer selected: ${dealerName}`);
      dealerIdsSeen.add(dealerId);

      const invoicesInput = Array.isArray(dealer?.invoices)
        ? dealer.invoices
        : [];
      if (!invoicesInput.length)
        throw new Error(
          `Dealer ${dealerIndex + 1}: at least one invoice is required`,
        );

      const invoices: NormalizedInvoice[] = invoicesInput.map(
        (invoice: any, invoiceIndex: number) => {
          const invoiceId = requireObjectId(
            invoice?.invoiceId,
            `Dealer ${dealerIndex + 1}, Invoice ${invoiceIndex + 1}: invoiceId`,
          );
          const invoiceNo = cleanText(invoice?.invoiceNo);
          if (!invoiceNo)
            throw new Error(
              `Dealer ${dealerIndex + 1}, Invoice ${invoiceIndex + 1}: invoiceNo is required`,
            );
          if (invoiceIdsSeen.has(invoiceId))
            throw new Error(`Duplicate invoice selected: ${invoiceNo}`);
          invoiceIdsSeen.add(invoiceId);

          const moneyReceiptsInput = Array.isArray(invoice?.moneyReceipts)
            ? invoice.moneyReceipts
            : [];
          if (!moneyReceiptsInput.length)
            throw new Error(
              `Dealer ${dealerIndex + 1}, Invoice ${invoiceIndex + 1}: at least one MR is required`,
            );

          const seenMrNosInInvoice = new Set<string>();
          const moneyReceipts: NormalizedMoneyReceipt[] =
            moneyReceiptsInput.map((mr: any, mrIndex: number) => {
              const mrNo = cleanText(mr?.mrNo);
              if (!mrNo)
                throw new Error(
                  `Dealer ${dealerIndex + 1}, Invoice ${invoiceIndex + 1}, MR ${mrIndex + 1}: MR No is required`,
                );
              if (seenMrNosInInvoice.has(mrNo))
                throw new Error(`Duplicate MR No in the same invoice: ${mrNo}`);
              seenMrNosInInvoice.add(mrNo);

              if (mrDealerMap.has(mrNo)) {
                const existingDealerId = mrDealerMap.get(mrNo);
                if (existingDealerId !== dealerId) {
                  throw new Error(
                    `MR No ${mrNo} is already used by another dealer`,
                  );
                }
              } else {
                mrDealerMap.set(mrNo, dealerId);
              }

              const mrDate = parseDateOrThrow(
                mr?.mrDate,
                `Dealer ${dealerIndex + 1}, Invoice ${invoiceIndex + 1}, MR ${mrNo}: MR Date`,
              );
              const taka = toNumber(mr?.taka, NaN);
              if (!Number.isFinite(taka) || taka <= 0)
                throw new Error(`MR ${mrNo}: valid taka amount is required`);

              const deductCommission = Boolean(mr?.deductCommission ?? false);
              const commission = normalizeCommission(mr?.commission, taka);

              if (deductCommission) {
                if (commission.amount > roundMoney(taka) + 0.005) {
                  throw new Error(
                    `MR ${mrNo}: commission cannot exceed collected cash in deduct mode`,
                  );
                }
              }

              const mediaIdRaw = cleanText(
                mr?.mediaId || mr?.media?.id || mr?.media,
              );
              const mediaId = mediaIdRaw || null;

              return {
                mrNo,
                mrDate,
                taka: roundMoney(taka),
                commission,
                deductCommission,
                mediaId,
              };
            });

          return { invoiceId, invoiceNo, moneyReceipts };
        },
      );

      return { dealerId, dealerName, invoices };
    },
  );

  const onlineCopyRaw = raw?.onlineCopy;
  if (!onlineCopyRaw || typeof onlineCopyRaw !== "object")
    throw new Error("Online copy is required");

  const onlineCopyNo = cleanText(onlineCopyRaw?.onlineCopyNo);
  if (!onlineCopyNo) throw new Error("Online Copy No is required");
  const onlineCopyDate = parseDateOrThrow(
    onlineCopyRaw?.onlineCopyDate,
    "Online Copy Date",
  );
  const onlineCopyTaka = toNumber(onlineCopyRaw?.onlineCopyTaka, NaN);
  if (!Number.isFinite(onlineCopyTaka) || onlineCopyTaka <= 0)
    throw new Error("Online Copy Taka is required");
  const bankDepositCharge = toNumber(onlineCopyRaw?.bankDepositCharge, 0);
  if (!Number.isFinite(bankDepositCharge) || bankDepositCharge < 0)
    throw new Error("Bank Deposit Charge must be non-negative");
  const bankAccountId = requireObjectId(
    onlineCopyRaw?.bankAccountId,
    "Bank Account",
  );
  const onlineCopyMediaId = cleanText(
    onlineCopyRaw?.mediaId || onlineCopyRaw?.media?.id || onlineCopyRaw?.media,
  );
  if (!onlineCopyMediaId) throw new Error("Online Copy mediaId is required");

  const allReceipts: NormalizedMoneyReceipt[] = dealers.flatMap((d) =>
    d.invoices.flatMap((i) => i.moneyReceipts),
  );
  const totalMRAmount = sumBy(allReceipts, (mr) => mr.taka);
  const totalCommission = sumBy(allReceipts, (mr) => mr.commission.amount);
  const totalDeductCommission = sumBy(
    allReceipts.filter((mr) => mr.deductCommission),
    (mr) => mr.commission.amount,
  );

  if (!sameMoney(onlineCopyTaka, totalMRAmount)) {
    throw new Error("Online Copy Taka must equal total collected cash");
  }

  const mediaIds = Array.from(
    new Set([
      ...allReceipts.map((mr) => String(mr.mediaId)),
      String(onlineCopyMediaId),
    ]),
  );

  return {
    dealers,
    onlineCopy: {
      onlineCopyNo,
      onlineCopyDate,
      onlineCopyTaka: roundMoney(onlineCopyTaka),
      bankDepositCharge: roundMoney(bankDepositCharge),
      bankAccountId,
      mediaId: onlineCopyMediaId,
    },
    mediaIds,
    summary: {
      totalDealers: dealers.length,
      totalInvoices: dealers.reduce((sum, d) => sum + d.invoices.length, 0),
      totalMoneyReceipts: allReceipts.length,
      totalMRAmount,
      totalCommission,
      totalDeductCommission,
      bankDepositCharge: roundMoney(bankDepositCharge),
    },
  };
}

async function persistCollection(normalized: any, excludeId?: string) {
  await validateMediaIds(normalized.mediaIds ?? []);
  await ensureUniqueOnlineCopyNo(
    normalized.onlineCopy?.onlineCopyNo ?? null,
    excludeId,
  );
  await validateBankAccount(normalized.onlineCopy?.bankAccountId);
}

// ── Build approval plans (EXPLICIT dealer due reduction logic) ──
function buildApprovalPlans(collectionDoc: any) {
  const invoicePlanMap = new Map<string, InvoiceApprovalPlan>();
  const dealerPlanMap = new Map<string, DealerApprovalPlan>();

  const dealers = Array.isArray(collectionDoc?.dealers)
    ? collectionDoc.dealers
    : [];

  for (const dealer of dealers) {
    const dealerId = String(dealer?.dealerId ?? "");
    const dealerName = cleanText(dealer?.dealerName);
    const invoices = Array.isArray(dealer?.invoices) ? dealer.invoices : [];

    for (const invoice of invoices) {
      const invoiceId = String(invoice?.invoiceId ?? "");
      const invoiceNo = cleanText(invoice?.invoiceNo);

      if (!invoicePlanMap.has(invoiceId)) {
        invoicePlanMap.set(invoiceId, {
          dealerId,
          dealerName,
          invoiceId,
          invoiceNo,
          amount: 0,
          commission: 0,
          mrNos: [],
        });
      }

      for (const mr of Array.isArray(invoice?.moneyReceipts)
        ? invoice.moneyReceipts
        : []) {
        const mrNo = cleanText(mr?.mrNo);
        if (!mrNo) continue;

        const taka = roundMoney(mr?.taka ?? 0);
        const comm = roundMoney(extractCommissionAmount(mr?.commission));
        const deduct = Boolean(mr?.deductCommission ?? false);

        // ── DEALER DUE REDUCTION LOGIC ──
        // deductCommission = true  → dealer pays only cash, commission taken from it → reduction = taka
        // deductCommission = false → dealer pays cash PLUS commission → reduction = taka + commission
        const reduction = deduct ? taka : roundMoney(taka + comm);

        const invPlan = invoicePlanMap.get(invoiceId)!;
        invPlan.amount = roundMoney(invPlan.amount + reduction);
        invPlan.commission = roundMoney(invPlan.commission + comm);
        invPlan.mrNos.push(mrNo);

        if (!dealerPlanMap.has(dealerId)) {
          dealerPlanMap.set(dealerId, {
            dealerId,
            dealerName,
            amount: 0,
            commission: 0,
            invoicePlans: [],
            currentDue: 0,
            creditLimit: 0,
            availableBefore: 0,
            availableAfter: 0,
          });
        }

        const dealerPlan = dealerPlanMap.get(dealerId)!;
        dealerPlan.amount = roundMoney(dealerPlan.amount + reduction);
        dealerPlan.commission = roundMoney(dealerPlan.commission + comm);
      }
    }
  }

  const invoicePlans = Array.from(invoicePlanMap.values()).filter(
    (p) => p.amount > 0,
  );
  const dealerPlans = Array.from(dealerPlanMap.values()).map((dp) => ({
    ...dp,
    invoicePlans: invoicePlans.filter((inv) => inv.dealerId === dp.dealerId),
  }));

  return { invoicePlans, dealerPlans };
}

// ── Accounts resolution ────────────────────────────
async function resolveDealerAccountId(dealerId: string, session?: any) {
  let dealer = await DealerModel.findById(dealerId).session(session);
  if (!dealer) throw new Error("Dealer not found");

  if (!dealer.accountId) {
    await accountService.createAutoAccountForEntity({
      entityType: "Dealer",
      entityId: String(dealer._id),
      name: dealer.name,
    });

    dealer = await DealerModel.findById(dealerId).session(session);
  }

  if (!dealer?.accountId) {
    throw new Error(`Dealer account not found for ${dealer.name}`);
  }

  return dealer;
}

async function resolveExpenseAccounts(session?: any) {
  const salesCommissionAccount = await accountService.getAccountByPath(
    ["Expense", "Selling & Distribution", "Sales Commission"],
    "Expense",
    { session },
  );

  const bankDepositChargeAccount = await accountService.getAccountByPath(
    ["Expense", "Selling & Distribution", "Bank Deposit Charge"],
    "Expense",
    { session },
  );

  return { salesCommissionAccount, bankDepositChargeAccount };
}

// ── Approval & accounting (all console logs removed) ──
async function postCollectionApproval(
  collectionDoc: any,
  actorId: string,
  remarks?: string,
  session?: any,
) {
  const bankVa = await validateBankAccount(
    String(collectionDoc?.onlineCopy?.bankAccountId ?? ""),
    session,
  );
  const bankAccountId = String(bankVa.accountId?._id ?? bankVa.accountId);
  const bankAccountName = String(bankVa.accountId?.name ?? "Bank");

  const { invoicePlans, dealerPlans } = buildApprovalPlans(collectionDoc);
  if (!invoicePlans.length)
    throw new Error("No money receipt allocation found for approval");

  // Compute totals directly from the document (ensures correct bank deposit)
  let totalMRTaka = 0;
  let totalDeductCommission = 0;
  const dealers = Array.isArray(collectionDoc?.dealers)
    ? collectionDoc.dealers
    : [];
  for (const dealer of dealers) {
    const invoices = Array.isArray(dealer?.invoices) ? dealer.invoices : [];
    for (const invoice of invoices) {
      const mrs = Array.isArray(invoice?.moneyReceipts)
        ? invoice.moneyReceipts
        : [];
      for (const mr of mrs) {
        const taka = roundMoney(mr?.taka ?? 0);
        const comm = roundMoney(extractCommissionAmount(mr?.commission));
        const deduct = Boolean(mr?.deductCommission ?? false);
        totalMRTaka = roundMoney(totalMRTaka + taka);
        if (deduct) {
          totalDeductCommission = roundMoney(totalDeductCommission + comm);
        }
      }
    }
  }

  const bankDepositCharge = roundMoney(
    collectionDoc?.onlineCopy?.bankDepositCharge ?? 0,
  );
  const bankDepositAmount = roundMoney(
    totalMRTaka - totalDeductCommission - bankDepositCharge,
  );

  if (bankDepositAmount < 0)
    throw new Error("Net bank deposit amount cannot be negative");

  const dealerDocs = new Map<string, any>();
  const invoiceDocs = new Map<string, any>();

  // Validate dealers & invoices
  for (const dealerPlan of dealerPlans) {
    const dealer = await resolveDealerAccountId(dealerPlan.dealerId, session);
    const dealerCurrentDue = roundMoney(dealer.currentDue ?? 0);
    const dealerCreditLimit = roundMoney(dealer.creditLimit ?? 0);

    dealerPlan.currentDue = dealerCurrentDue;
    dealerPlan.creditLimit = dealerCreditLimit;
    dealerPlan.availableBefore = roundMoney(
      dealerCreditLimit - dealerCurrentDue,
    );
    dealerPlan.availableAfter = roundMoney(
      dealerPlan.availableBefore + dealerPlan.amount,
    );

    if (dealerPlan.amount > dealerCurrentDue + 0.005) {
      throw new Error(
        `Collection amount for dealer "${dealer.name}" exceeds current due`,
      );
    }

    for (const invPlan of dealerPlan.invoicePlans) {
      const invoice = await SalesInvoice.findById(invPlan.invoiceId).session(
        session,
      );
      if (!invoice) throw new Error(`Invoice not found: ${invPlan.invoiceNo}`);
      if (String(invoice.customerId) !== dealerPlan.dealerId) {
        throw new Error(
          `Invoice ${invPlan.invoiceNo} does not belong to dealer ${dealerPlan.dealerName}`,
        );
      }
      if (invoice.status !== "ACTIVE")
        throw new Error(`Invoice ${invPlan.invoiceNo} is not active`);

      const balanceAmount = roundMoney(invoice.balanceAmount ?? 0);
      if (invPlan.amount > balanceAmount + 0.005) {
        throw new Error(
          `Reduction for invoice ${invPlan.invoiceNo} exceeds remaining balance`,
        );
      }
      invoiceDocs.set(invPlan.invoiceId, invoice);
    }
    dealerDocs.set(dealerPlan.dealerId, dealer);
  }

  const { salesCommissionAccount, bankDepositChargeAccount } =
    await resolveExpenseAccounts(session);

  const lines: any[] = [];

  // 1. Debit bank with net deposit (taka - deductCommission - bank charge)
  if (bankDepositAmount > 0) {
    lines.push({
      accountId: bankAccountId,
      debit: roundMoney(bankDepositAmount),
      credit: 0,
      narration: `Collection deposited to ${bankAccountName} against ${collectionDoc.voucherNo}`,
    });
  }

  // 2. Credit each invoice's dealer receivable (total reduction)
  for (const dealerPlan of dealerPlans) {
    const dealer = dealerDocs.get(dealerPlan.dealerId);
    const dealerAccountId = String(dealer.accountId?._id ?? dealer.accountId);

    for (const invPlan of dealerPlan.invoicePlans) {
      if (invPlan.amount <= 0) continue;
      lines.push({
        accountId: dealerAccountId,
        debit: 0,
        credit: roundMoney(invPlan.amount),
        narration: `Collection against invoice ${invPlan.invoiceNo} for dealer ${dealerPlan.dealerName}`,
      });
    }
  }

  // 3. Per-invoice commission expense (debit) – all commissions
  for (const dealerPlan of dealerPlans) {
    for (const invPlan of dealerPlan.invoicePlans) {
      if (invPlan.commission <= 0) continue;
      lines.push({
        accountId: String(salesCommissionAccount._id),
        debit: roundMoney(invPlan.commission),
        credit: 0,
        narration: `Sales commission for invoice ${invPlan.invoiceNo} (dealer ${dealerPlan.dealerName})`,
      });
    }
  }

  // 4. Bank deposit charge expense
  if (bankDepositCharge > 0) {
    lines.push({
      accountId: String(bankDepositChargeAccount._id),
      debit: roundMoney(bankDepositCharge),
      credit: 0,
      narration: `Bank deposit charge for collection ${collectionDoc.voucherNo}`,
    });
  }

  const debitTotal = sumBy(lines, (l) => l.debit);
  const creditTotal = sumBy(lines, (l) => l.credit);

  if (!sameMoney(debitTotal, creditTotal))
    throw new Error("Voucher is not balanced");

  // Create voucher
  const now = new Date();
  const voucherNo = `V-${collectionDoc.voucherNo}`;
  const voucherDocs = await Voucher.create(
    [
      {
        voucherNo,
        date:
          collectionDoc?.onlineCopy?.onlineCopyDate ||
          collectionDoc.date ||
          now,
        type: "BankReceive",
        reference: collectionDoc.voucherNo,
        narration: `Collection approval for ${collectionDoc.voucherNo}`,
        bankVaId: collectionDoc?.onlineCopy?.bankAccountId,
        status: "Approved",
        createdBy: new mongoose.Types.ObjectId(actorId),
        submittedBy: new mongoose.Types.ObjectId(actorId),
        submittedAt: now,
        approvedBy: new mongoose.Types.ObjectId(actorId),
        approvedAt: now,
      },
    ],
    { session },
  );

  const voucher = voucherDocs[0];

  const insertedLines = await VoucherLine.insertMany(
    lines.map((line) => ({
      voucherId: voucher._id,
      accountId: line.accountId,
      debit: roundMoney(line.debit),
      credit: roundMoney(line.credit),
      narration: line.narration || "",
    })),
    { session },
  );

  // ── UPDATE DEALER DUE (uses dealerPlan.amount, already correct) ──
  for (const dealerPlan of dealerPlans) {
    const dealer = dealerDocs.get(dealerPlan.dealerId);
    const newDue = roundMoney((dealer.currentDue ?? 0) - dealerPlan.amount);
    if (newDue < -0.005)
      throw new Error(
        `Dealer due would become negative for ${dealerPlan.dealerName}`,
      );
    dealer.currentDue = Math.max(0, newDue);
    await dealer.save({ session });
  }

  // Update invoice payment records
  for (const invPlan of invoicePlans) {
    const invoice = invoiceDocs.get(invPlan.invoiceId);
    if (!invoice) continue;
    const newPaidAmount = roundMoney(
      (invoice.paidAmount ?? 0) + invPlan.amount,
    );
    if (newPaidAmount > roundMoney(invoice.grandTotal ?? 0) + 0.005) {
      throw new Error(`Invoice ${invPlan.invoiceNo} payment exceeds total`);
    }
    invoice.payments = Array.isArray(invoice.payments) ? invoice.payments : [];
    invoice.payments.push({
      method: "BANK_TRANSFER",
      amount: roundMoney(invPlan.amount),
      paymentDate: now,
      referenceNo:
        collectionDoc?.onlineCopy?.onlineCopyNo || collectionDoc.voucherNo,
      receivedBy: new mongoose.Types.ObjectId(actorId),
    });
    invoice.paidAmount = newPaidAmount;
    invoice.balanceAmount = roundMoney(
      (invoice.grandTotal ?? 0) - newPaidAmount,
    );
    invoice.paymentStatus = invoice.balanceAmount <= 0 ? "PAID" : "PARTIAL";
    await invoice.save({ session });
  }

  collectionDoc.status = "APPROVED";
  collectionDoc.workflowLogs = [
    ...(collectionDoc.workflowLogs ?? []),
    buildWorkflowLog("APPROVED", actorId, remarks || "Collection approved"),
  ];
  await collectionDoc.save({ session });

  return {
    voucher,
    voucherLines: insertedLines,
    totals: {
      totalMRAmount: totalMRTaka,
      totalCommission: sumBy(invoicePlans, (p) => p.commission),
      bankDepositCharge,
      bankNetDeposit: bankDepositAmount,
      debitTotal,
      creditTotal,
    },
    dealerPlans,
    invoicePlans,
  };
}

// ── Public service interface ──────────────────────────
export const collectionService = {
  ...base,

  computeSummary(doc: any) {
    return computeSummary(doc);
  },

  async listCollections(filters: any = {}) {
    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 15);
    const sort = filters.sort ?? "-createdAt";
    const q = cleanText(filters.q);
    const filter: any = {};

    if (filters.voucherNo) filter.voucherNo = cleanText(filters.voucherNo);
    if (filters.status) filter.status = cleanText(filters.status);

    if (filters.dealerId && isValidObjectId(filters.dealerId)) {
      filter["dealers.dealerId"] = cleanText(filters.dealerId);
    }

    if (filters.invoiceId && isValidObjectId(filters.invoiceId)) {
      filter["dealers.invoices.invoiceId"] = cleanText(filters.invoiceId);
    }

    if (filters.onlineCopyNo) {
      filter["onlineCopy.onlineCopyNo"] = cleanText(filters.onlineCopyNo);
    }

    if (filters.mrNo) {
      filter["dealers.invoices.moneyReceipts.mrNo"] = cleanText(filters.mrNo);
    }

    if (filters.date) {
      const date = new Date(filters.date);
      if (!Number.isNaN(date.getTime())) filter.date = date;
    }

    const result = await base.list({
      filter,
      page,
      limit,
      sort,
      q,
      searchFields: [
        "voucherNo",
        "onlineCopy.onlineCopyNo",
        "dealers.dealerName",
        "dealers.invoices.invoiceNo",
        "dealers.invoices.moneyReceipts.mrNo",
      ],
    });

    return {
      ...result,
      data: (result.data ?? []).map((item: any) => ({
        ...item,
        summary: computeSummary(item),
      })),
    };
  },

  async getCollectionById(id: string) {
    const doc = await base.getById(id);
    if (!doc) return doc;

    return {
      ...doc,
      summary: computeSummary(doc),
    };
  },

  async checkOnlineCopyNoAvailable(no: string, excludeId?: string) {
    const value = cleanText(no);
    if (!value) return false;

    const existing = await Collection.findOne({
      "onlineCopy.onlineCopyNo": value,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).lean();

    return !existing;
  },

  async createCollection(
    rawPayload: CollectionInput,
    context: any = {},
    _files: UploadedFile[] = [],
  ) {
    const actorId = getActorId(context);
    if (!actorId) throw new Error("User is required to create a collection");

    const normalized = normalizeAndValidatePayload(rawPayload);
    await persistCollection(normalized);

    const voucherNo = await generateVoucherNo();
    const now = new Date();

    const created = await base.create({
      voucherNo,
      date: now,
      dealers: normalized.dealers,
      onlineCopy: normalized.onlineCopy,
      status: "SUBMITTED",
      workflowLogs: [
        buildWorkflowLog("SUBMITTED", actorId, "Collection submitted"),
      ],
      summary: normalized.summary,
    });

    return {
      ...created,
      summary: computeSummary(created),
      accountingDraft: buildAccountingDraft(normalized),
    };
  },

  async updateCollection(
    id: string,
    rawPayload: CollectionInput,
    context: any = {},
    _files: UploadedFile[] = [],
  ) {
    const actorId = getActorId(context);
    if (!actorId) throw new Error("User is required to update a collection");

    const existing = await Collection.findById(id).lean();
    if (!existing) throw new Error("Collection not found");

    if (!canEditStatus(existing.status)) {
      throw new Error(
        `Collection cannot be edited in ${existing.status} status`,
      );
    }

    const normalized = normalizeAndValidatePayload(rawPayload);
    await persistCollection(normalized, id);

    const updated = await base.update(id, {
      voucherNo: existing.voucherNo,
      date: existing.date || new Date(),
      dealers: normalized.dealers,
      onlineCopy: normalized.onlineCopy,
      status: existing.status,
      workflowLogs: existing.workflowLogs ?? [],
      summary: normalized.summary,
    });

    return {
      ...updated,
      summary: computeSummary(updated),
      accountingDraft: buildAccountingDraft(normalized),
    };
  },

  async approveCollection(id: string, context: any = {}, remarks?: string) {
    const actorId = getActorId(context);
    if (!actorId) throw new Error("User is required to approve collection");

    return base.withTransaction(async (session) => {
      const collectionDoc = await Collection.findById(id).session(session);
      if (!collectionDoc) throw new Error("Collection not found");

      if (!isTransitionAllowed(collectionDoc.status, "APPROVED")) {
        throw new Error(
          `Status transition from ${collectionDoc.status} to APPROVED is not allowed`,
        );
      }

      const result = await postCollectionApproval(
        collectionDoc,
        actorId,
        remarks,
        session,
      );
      const saved = collectionDoc.toObject();

      return {
        ...saved,
        summary: computeSummary(saved),
        approval: {
          voucher: result.voucher,
          voucherLines: result.voucherLines,
          totals: result.totals,
          dealerPlans: result.dealerPlans,
          invoicePlans: result.invoicePlans,
        },
      };
    });
  },

  async transitionCollectionStatus(
    id: string,
    nextStatus: string,
    context: any = {},
    remarks?: string,
  ) {
    const actorId = getActorId(context);
    if (!actorId)
      throw new Error("User is required to change collection status");

    if (nextStatus === "APPROVED") {
      return this.approveCollection(id, context, remarks);
    }

    const existing = await Collection.findById(id).lean();
    if (!existing) throw new Error("Collection not found");

    if (!isTransitionAllowed(existing.status, nextStatus)) {
      throw new Error(
        `Status transition from ${existing.status} to ${nextStatus} is not allowed`,
      );
    }

    const patch = buildTransitionPatch(existing, nextStatus, actorId, remarks);
    const updated = await base.update(id, patch);

    return {
      ...updated,
      summary: computeSummary(updated),
    };
  },
};

export type CollectionService = typeof collectionService;
