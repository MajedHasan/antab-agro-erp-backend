// src/services/materialWip.report.service.ts
import mongoose from "mongoose";
import MaterialWIP from "../../../models/materialWip.model";
import RawMaterial from "../../../models/rawMaterials.model";
import PackagingItem from "../../../models/packagingItems.model";
import Product from "../../../models/product.model";

// ---------- types ----------
type ReportFilters = {
  factoryId?: string;
  rawMaterialId?: string;
  productId?: string;
  packagingItemId?: string;
  status?: string;
  createdBy?: string;
  approvedBy?: string;
  q?: string;
  preset?: "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "thisYear" | "lastYear";
  fromDate?: string;
  toDate?: string;
  page?: number | string;
  limit?: number | string;
};

type TrendGroupBy = "day" | "week" | "month" | "year";

// ---------- helpers ----------
const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const round3 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- date helpers ----------
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function getDateRange(filters: ReportFilters) {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const weekStart = (date: Date) => {
    const d = startOfDay(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    d.setDate(diff);
    return d;
  };

  const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
  const yearStart = (date: Date) => new Date(date.getFullYear(), 0, 1);

  switch (filters.preset) {
    case "today":
      return { from: today, to: endOfDay(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: y, to: endOfDay(y) };
    }
    case "thisWeek":
      return { from: weekStart(now), to: endOfDay(now) };
    case "lastWeek": {
      const end = weekStart(now);
      end.setDate(end.getDate() - 1);
      const start = weekStart(end);
      return { from: start, to: endOfDay(end) };
    }
    case "thisMonth":
      return { from: monthStart(now), to: endOfDay(now) };
    case "lastMonth": {
      const first = monthStart(now);
      const last = new Date(first);
      last.setDate(0);
      return { from: monthStart(last), to: endOfDay(last) };
    }
    case "thisYear":
      return { from: yearStart(now), to: endOfDay(now) };
    case "lastYear": {
      const last = new Date(now.getFullYear() - 1, 11, 31);
      return { from: yearStart(last), to: endOfDay(last) };
    }
    default: {
      if (filters.fromDate || filters.toDate) {
        return {
          from: filters.fromDate ? startOfDay(new Date(filters.fromDate)) : undefined,
          to: filters.toDate ? endOfDay(new Date(filters.toDate)) : undefined,
        };
      }
      return {};
    }
  }
}

// ---------- search helpers ----------
async function resolveRawMaterialIdsByName(q: string) {
  const regex = new RegExp(escapeRegex(q), "i");
  const rows = await RawMaterial.find({ name: regex }, "_id").lean();
  return rows.map((r: any) => r._id);
}

async function resolveProductIdsByName(q: string) {
  const regex = new RegExp(escapeRegex(q), "i");
  const rows = await Product.find({ name: regex }, "_id").lean();
  return rows.map((r: any) => r._id);
}

async function resolvePackagingIdsByName(q: string) {
  const regex = new RegExp(escapeRegex(q), "i");
  const rows = await PackagingItem.find({ name: regex }, "_id").lean();
  return rows.map((r: any) => r._id);
}

// ---------- filter builder ----------
function buildBaseMatch(filters: ReportFilters) {
  const match: any = {};

  if (filters.factoryId) match.factoryId = filters.factoryId;
  if (filters.rawMaterialId) match.rawMaterialId = filters.rawMaterialId;
  if (filters.status) match.status = filters.status;
  if (filters.createdBy) match.createdBy = filters.createdBy;
  if (filters.approvedBy) match.approvedBy = filters.approvedBy;

  const range = getDateRange(filters);
  if (range.from || range.to) {
    match.date = {};
    if (range.from) match.date.$gte = range.from;
    if (range.to) match.date.$lte = range.to;
  }

  return match;
}

// ---------- main service ----------
export const materialWipReportService = {
  /**
   * Paginated WIP report list
   */
  async list(filters: ReportFilters) {
    const match = buildBaseMatch(filters);
    const q = filters.q?.trim();

    if (q) {
      const rawIds = await resolveRawMaterialIdsByName(q);
      const productIds = await resolveProductIdsByName(q);

      const or: any[] = [];

      if (rawIds.length) {
        or.push({ rawMaterialId: { $in: rawIds } });
      }

      if (productIds.length) {
        or.push({ "conversions.products.productId": { $in: productIds } });
        or.push({ "pendingConversion.products.productId": { $in: productIds } });
      }

      if (mongoose.Types.ObjectId.isValid(q)) {
        or.push({ _id: q });
      }

      if (or.length) {
        match.$or = or;
      } else {
        // fallback: search by raw material name
        const rawIds2 = await resolveRawMaterialIdsByName(q);
        match.rawMaterialId = { $in: rawIds2.length ? rawIds2 : ["000000000000000000000000"] };
      }
    }

    const page = num(filters.page || 1);
    const limit = num(filters.limit || 15);
    const skip = (page - 1) * limit;

    const [data, total, summary] = await Promise.all([
      MaterialWIP.find(match)
        .populate("rawMaterialId")
        .populate("factoryId", "name code")
        .populate("createdBy", "name")
        .populate("approvedBy", "name")
        .populate("conversions.products.productId", "name code sku")
        .populate("pendingConversion.products.productId", "name code sku")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MaterialWIP.countDocuments(match),
      MaterialWIP.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            totalIssuedQuantity: { $sum: "$issuedQuantity" },
            totalReturnedQuantity: { $sum: "$returnedQuantity" },
            totalConsumedQuantity: { $sum: "$consumedQuantity" },
            totalExpectedRawUsed: { $sum: "$expectedRawUsed" },
            totalAllowedWastageRawUsed: { $sum: "$allowedWastageRawUsed" },
            totalActualRawUsed: { $sum: "$actualRawUsed" },
            totalGainQuantity: { $sum: "$gainQuantity" },
            totalNormalWastageQuantity: { $sum: "$normalWastageQuantity" },
            totalProductionLossQuantity: { $sum: "$productionLossQuantity" },
            totalRawMaterialCost: { $sum: "$rawMaterialCost" },
            totalPackagingMaterialCost: { $sum: "$packagingMaterialCost" },
            totalOtherMaterialCost: { $sum: "$otherMaterialCost" },
            totalInputCost: { $sum: "$totalInputCost" },
            totalFinishedGoodsCost: { $sum: "$totalFinishedGoodsCost" },
            activeCount: {
              $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
            },
            pendingCount: {
              $sum: { $cond: [{ $eq: ["$status", "PENDING_APPROVAL"] }, 1, 0] },
            },
            approvedCount: {
              $sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] },
            },
            rejectedCount: {
              $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    return {
      data,
      total,
      page,
      limit,
      summary: summary[0] || {
        totalRecords: 0,
        totalIssuedQuantity: 0,
        totalReturnedQuantity: 0,
        totalConsumedQuantity: 0,
        totalExpectedRawUsed: 0,
        totalAllowedWastageRawUsed: 0,
        totalActualRawUsed: 0,
        totalGainQuantity: 0,
        totalNormalWastageQuantity: 0,
        totalProductionLossQuantity: 0,
        totalRawMaterialCost: 0,
        totalPackagingMaterialCost: 0,
        totalOtherMaterialCost: 0,
        totalInputCost: 0,
        totalFinishedGoodsCost: 0,
        activeCount: 0,
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
      },
    };
  },

  /**
   * Overall WIP summary (dashboard cards)
   */
  async summary(filters: ReportFilters) {
    const match = buildBaseMatch(filters);

    const rows = await MaterialWIP.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalIssuedQuantity: { $sum: "$issuedQuantity" },
          totalReturnedQuantity: { $sum: "$returnedQuantity" },
          totalConsumedQuantity: { $sum: "$consumedQuantity" },
          totalExpectedRawUsed: { $sum: "$expectedRawUsed" },
          totalAllowedWastageRawUsed: { $sum: "$allowedWastageRawUsed" },
          totalActualRawUsed: { $sum: "$actualRawUsed" },
          totalGainQuantity: { $sum: "$gainQuantity" },
          totalNormalWastageQuantity: { $sum: "$normalWastageQuantity" },
          totalProductionLossQuantity: { $sum: "$productionLossQuantity" },
          totalRawMaterialCost: { $sum: "$rawMaterialCost" },
          totalPackagingMaterialCost: { $sum: "$packagingMaterialCost" },
          totalOtherMaterialCost: { $sum: "$otherMaterialCost" },
          totalInputCost: { $sum: "$totalInputCost" },
          totalFinishedGoodsCost: { $sum: "$totalFinishedGoodsCost" },
          activeCount: {
            $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$status", "PENDING_APPROVAL"] }, 1, 0] },
          },
          approvedCount: {
            $sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] },
          },
          rejectedCount: {
            $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] },
          },
        },
      },
    ]);

    return rows[0] || {
      totalRecords: 0,
      totalIssuedQuantity: 0,
      totalReturnedQuantity: 0,
      totalConsumedQuantity: 0,
      totalExpectedRawUsed: 0,
      totalAllowedWastageRawUsed: 0,
      totalActualRawUsed: 0,
      totalGainQuantity: 0,
      totalNormalWastageQuantity: 0,
      totalProductionLossQuantity: 0,
      totalRawMaterialCost: 0,
      totalPackagingMaterialCost: 0,
      totalOtherMaterialCost: 0,
      totalInputCost: 0,
      totalFinishedGoodsCost: 0,
      activeCount: 0,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
    };
  },

  /**
   * Time‑series trend
   */
  async trend(filters: ReportFilters & { groupBy?: TrendGroupBy }) {
    const match = buildBaseMatch(filters);
    const groupBy = filters.groupBy || "day";

    let groupId: any;
    let labelProject: any;

    if (groupBy === "week") {
      groupId = {
        isoWeekYear: { $isoWeekYear: "$date" },
        isoWeek: { $isoWeek: "$date" },
      };
      labelProject = {
        label: {
          $concat: [
            { $toString: "$_id.isoWeekYear" },
            "-W",
            { $toString: "$_id.isoWeek" },
          ],
        },
      };
    } else if (groupBy === "month") {
      groupId = {
        year: { $year: "$date" },
        month: { $month: "$date" },
      };
      labelProject = {
        label: {
          $concat: [
            { $toString: "$_id.year" },
            "-",
            {
              $cond: [
                { $lt: ["$_id.month", 10] },
                { $concat: ["0", { $toString: "$_id.month" }] },
                { $toString: "$_id.month" },
              ],
            },
          ],
        },
      };
    } else if (groupBy === "year") {
      groupId = {
        year: { $year: "$date" },
      };
      labelProject = {
        label: { $toString: "$_id.year" },
      };
    } else {
      groupId = {
        day: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
      };
      labelProject = {
        label: "$_id.day",
      };
    }

    const rows = await MaterialWIP.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupId,
          totalRecords: { $sum: 1 },
          issued: { $sum: "$issuedQuantity" },
          returned: { $sum: "$returnedQuantity" },
          consumed: { $sum: "$consumedQuantity" },
          expected: { $sum: "$expectedRawUsed" },
          actual: { $sum: "$actualRawUsed" },
          gain: { $sum: "$gainQuantity" },
          wastage: { $sum: "$normalWastageQuantity" },
          loss: { $sum: "$productionLossQuantity" },
          inputCost: { $sum: "$totalInputCost" },
          finishedGoodsCost: { $sum: "$totalFinishedGoodsCost" },
        },
      },
      {
        $project: {
          ...labelProject,
          totalRecords: 1,
          issued: 1,
          returned: 1,
          consumed: 1,
          expected: 1,
          actual: 1,
          gain: 1,
          wastage: 1,
          loss: 1,
          inputCost: 1,
          finishedGoodsCost: 1,
        },
      },
      { $sort: { label: 1 } },
    ]);

    return rows.map((r) => ({
      ...r,
      issued: round3(r.issued),
      returned: round3(r.returned),
      consumed: round3(r.consumed),
      expected: round3(r.expected),
      actual: round3(r.actual),
      gain: round3(r.gain),
      wastage: round3(r.wastage),
      loss: round3(r.loss),
      inputCost: round2(r.inputCost),
      finishedGoodsCost: round2(r.finishedGoodsCost),
    }));
  },

  /**
   * Raw‑material‑wise report
   */
  async rawMaterialWise(filters: ReportFilters) {
    const match = buildBaseMatch(filters);
    if (filters.rawMaterialId) {
      match.rawMaterialId = filters.rawMaterialId;
    }

    const rows = await MaterialWIP.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$rawMaterialId",
          wipCount: { $sum: 1 },
          totalIssuedQuantity: { $sum: "$issuedQuantity" },
          totalReturnedQuantity: { $sum: "$returnedQuantity" },
          totalConsumedQuantity: { $sum: "$consumedQuantity" },
          totalExpectedRawUsed: { $sum: "$expectedRawUsed" },
          totalAllowedWastageRawUsed: { $sum: "$allowedWastageRawUsed" },
          totalActualRawUsed: { $sum: "$actualRawUsed" },
          totalGainQuantity: { $sum: "$gainQuantity" },
          totalNormalWastageQuantity: { $sum: "$normalWastageQuantity" },
          totalProductionLossQuantity: { $sum: "$productionLossQuantity" },
          totalRawMaterialCost: { $sum: "$rawMaterialCost" },
          totalInputCost: { $sum: "$totalInputCost" },
          totalFinishedGoodsCost: { $sum: "$totalFinishedGoodsCost" },
        },
      },
      { $sort: { totalConsumedQuantity: -1 } },
    ]);

    const ids = rows.map((r) => r._id).filter(Boolean);
    const materials = await RawMaterial.find({ _id: { $in: ids } }).lean();
    const map = new Map(materials.map((m: any) => [String(m._id), m]));

    return rows.map((r) => {
      const material = map.get(String(r._id));
      return {
        rawMaterialId: r._id,
        rawMaterialName: material?.name || null,
        sku: material?.sku || null,
        unit: material?.unit || null,
        wipCount: r.wipCount,
        totalIssuedQuantity: round3(r.totalIssuedQuantity),
        totalReturnedQuantity: round3(r.totalReturnedQuantity),
        totalConsumedQuantity: round3(r.totalConsumedQuantity),
        totalExpectedRawUsed: round3(r.totalExpectedRawUsed),
        totalAllowedWastageRawUsed: round3(r.totalAllowedWastageRawUsed),
        totalActualRawUsed: round3(r.totalActualRawUsed),
        totalGainQuantity: round3(r.totalGainQuantity),
        totalNormalWastageQuantity: round3(r.totalNormalWastageQuantity),
        totalProductionLossQuantity: round3(r.totalProductionLossQuantity),
        totalRawMaterialCost: round2(r.totalRawMaterialCost),
        totalInputCost: round2(r.totalInputCost),
        totalFinishedGoodsCost: round2(r.totalFinishedGoodsCost),
      };
    });
  },

  /**
   * Finished‑product‑wise report
   */
  async productWise(filters: ReportFilters) {
    const match = buildBaseMatch(filters);
    const pipeline: any[] = [
      { $match: match },
      { $unwind: "$conversions" },
      { $unwind: "$conversions.products" },
    ];

    if (filters.productId) {
      pipeline.push({
        $match: { "conversions.products.productId": new mongoose.Types.ObjectId(filters.productId) },
      });
    }

    pipeline.push({
      $group: {
        _id: "$conversions.products.productId",
        totalQtyProduced: { $sum: "$conversions.products.quantityProduced" },
        totalExpectedRawUsed: { $sum: "$conversions.products.expectedRawUsed" },
        totalRawMaterialCost: { $sum: "$conversions.products.rawMaterialCost" },
        totalPackagingMaterialCost: { $sum: "$conversions.products.packagingMaterialCost" },
        totalOtherMaterialCost: { $sum: "$conversions.products.otherMaterialCost" },
        totalCost: { $sum: "$conversions.products.totalCost" },
        wipCount: { $sum: 1 },
      },
    });

    pipeline.push({ $sort: { totalQtyProduced: -1 } });

    const rows = await MaterialWIP.aggregate(pipeline);

    const ids = rows.map((r) => r._id).filter(Boolean);
    const products = await Product.find({ _id: { $in: ids } }).lean();
    const map = new Map(products.map((p: any) => [String(p._id), p]));

    return rows.map((r) => {
      const product = map.get(String(r._id));
      return {
        productId: r._id,
        productName: product?.name || null,
        sku: product?.sku || null,
        unit: product?.unit || null,
        wipCount: r.wipCount,
        totalQtyProduced: round3(r.totalQtyProduced),
        totalExpectedRawUsed: round3(r.totalExpectedRawUsed),
        totalRawMaterialCost: round2(r.totalRawMaterialCost),
        totalPackagingMaterialCost: round2(r.totalPackagingMaterialCost),
        totalOtherMaterialCost: round2(r.totalOtherMaterialCost),
        totalCost: round2(r.totalCost),
        avgUnitCost: round2(
          r.totalQtyProduced > 0 ? r.totalCost / r.totalQtyProduced : 0,
        ),
      };
    });
  },

  /**
   * Packaging‑wise report
   */
  async packagingWise(filters: ReportFilters) {
    const match = buildBaseMatch(filters);

    const pipeline: any[] = [
      { $match: match },
      { $unwind: "$conversions" },
      { $unwind: "$conversions.otherMaterialsUsed" },
      {
        $match: {
          "conversions.otherMaterialsUsed.itemType": "PackagingItem",
        },
      },
    ];

    if (filters.packagingItemId) {
      pipeline.push({
        $match: {
          "conversions.otherMaterialsUsed.itemId": new mongoose.Types.ObjectId(filters.packagingItemId),
        },
      });
    }

    pipeline.push({
      $group: {
        _id: "$conversions.otherMaterialsUsed.itemId",
        usedQty: { $sum: "$conversions.otherMaterialsUsed.quantity" },
        totalCost: { $sum: "$conversions.otherMaterialsUsed.totalCost" },
        wipCount: { $sum: 1 },
      },
    });

    pipeline.push({ $sort: { usedQty: -1 } });

    const rows = await MaterialWIP.aggregate(pipeline);

    const ids = rows.map((r) => r._id).filter(Boolean);
    const items = await PackagingItem.find({ _id: { $in: ids } }).lean();
    const map = new Map(items.map((p: any) => [String(p._id), p]));

    return rows.map((r) => {
      const item = map.get(String(r._id));
      return {
        packagingItemId: r._id,
        packagingItemName: item?.name || null,
        sku: item?.sku || null,
        unit: item?.unit || null,
        wipCount: r.wipCount,
        usedQty: round3(r.usedQty),
        totalCost: round2(r.totalCost),
      };
    });
  },

  /**
   * Single WIP detail (drill‑down)
   */
  async detail(id: string) {
    const doc = await MaterialWIP.findById(id)
      .populate("rawMaterialId")
      .populate("factoryId", "name code")
      .populate("createdBy", "name")
      .populate("approvedBy", "name")
      .populate("conversions.products.productId", "name code sku")
      .populate("pendingConversion.products.productId", "name code sku")
      .lean();

    if (!doc) return null;

    return {
      ...doc,
      issuedQuantity: round3(doc.issuedQuantity),
      returnedQuantity: round3(doc.returnedQuantity),
      consumedQuantity: round3(doc.consumedQuantity),
      expectedRawUsed: round3(doc.expectedRawUsed),
      allowedWastageRawUsed: round3(doc.allowedWastageRawUsed),
      actualRawUsed: round3(doc.actualRawUsed),
      gainQuantity: round3(doc.gainQuantity),
      normalWastageQuantity: round3(doc.normalWastageQuantity),
      productionLossQuantity: round3(doc.productionLossQuantity),
      rawMaterialCost: round2(doc.rawMaterialCost),
      packagingMaterialCost: round2(doc.packagingMaterialCost),
      otherMaterialCost: round2(doc.otherMaterialCost),
      totalInputCost: round2(doc.totalInputCost),
      totalFinishedGoodsCost: round2(doc.totalFinishedGoodsCost),
    };
  },
};