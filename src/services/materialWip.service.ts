// src/services/materialWip.service.ts
import mongoose from "mongoose";
import MaterialWIP from "../models/materialWip.model";
import BOM from "../models/bom.model";
import ProductStock from "../models/productStock.model";
import { RawMaterialStock } from "../models/rawMaterials.model";
import { PackagingStock } from "../models/packagingItems.model";
import { calculateConsumption, convertUnit } from "../utils/bomCalculation";
import { stockTransactionService } from "../modules/stockTransaction/stockTransaction.service";
import { inventoryCostService } from "../modules/stockTransaction/inventoryCost.service";
import { voucherService } from "./voucher.service";
import { accountService } from "./account.service";
import RawMaterial from "../models/rawMaterials.model";
import PackagingItem from "../models/packagingItems.model";
import Product from "../models/product.model";

const STRICT_WASTAGE = process.env.STRICT_WASTAGE === "true";

type ProductInput = {
  productId: string;
  quantityProduced: number;
};

type MaterialPool = {
  itemType: "RawMaterial" | "PackagingItem";
  itemId: string;
  unit: string;
  expectedQty: number;
  expectedByProduct: Record<string, number>;
};

type ProductAllocation = {
  productId: string;
  quantityProduced: number;
  expectedRawUsed: number;
  rawMaterialCost: number;
  packagingMaterialCost: number;
  otherMaterialCost: number;
  totalCost: number;
  unitCost: number;
};

// ---------- Rounding helpers ----------
const round3 = (n: number) =>
  Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

const round2 = (n: number) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const keyOf = (itemType: string, itemId: string) => `${itemType}:${itemId}`;

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ---------- Account helpers ----------
async function getRawMaterialAccount(
  rawMaterialId: string,
  session?: mongoose.ClientSession,
) {
  const rm = await RawMaterial.findById(rawMaterialId).session(session).lean();
  if (!rm) throw new Error("Raw material not found");
  return (accountService as any).getAccountByPath(
    ["Assets", "Current Assets", "Inventory", "Raw Materials", rm.name],
    "Asset",
    { session },
  );
}

async function getPackagingItemAccount(
  packagingItemId: string,
  session?: mongoose.ClientSession,
) {
  const item = await PackagingItem.findById(packagingItemId)
    .session(session)
    .lean();
  if (!item) throw new Error("Packaging item not found");
  return (accountService as any).getAccountByPath(
    ["Assets", "Current Assets", "Inventory", "Packaging Materials", item.name],
    "Asset",
    { session },
  );
}

async function getProductAccount(productId: string, session?: mongoose.ClientSession) {
  const prod = await Product.findById(productId).session(session).lean();
  if (!prod) throw new Error("Product not found");
  return (accountService as any).getAccountByPath(
    ["Assets", "Current Assets", "Inventory", "Finished Goods", prod.name],
    "Asset",
    { session },
  );
}

async function getWipAccount(rawMaterialId: string, session?: mongoose.ClientSession) {
  const rm = await RawMaterial.findById(rawMaterialId).session(session).lean();
  if (!rm) throw new Error("Raw material not found");
  return (accountService as any).getAccountByPath(
    ["Assets", "Current Assets", "Inventory", "Work In Progress", rm.name],
    "Asset",
    { session },
  );
}

// ---------- Draft builder (returns per‑product base & allowed wastage) ----------
async function buildDraftFromProducts(
  session: mongoose.ClientSession,
  wip: any,
  products: ProductInput[],
) {
  const materialMap = new Map<string, MaterialPool>();
  const productDrafts: Array<{
    productId: string;
    quantityProduced: number;
    expectedRawUsed: number;   // base quantity (no wastage)
  }> = [];
  const productAllowedWastage: number[] = [];   // per‑product allowed wastage

  let totalBaseRaw = 0;
  let totalAllowedWastageRawUsed = 0;

  for (const p of products) {
    const productId = String(p.productId);
    const quantityProduced = num(p.quantityProduced);

    if (quantityProduced <= 0) {
      throw new Error(`Invalid quantityProduced for product ${productId}`);
    }

    const bom = await BOM.findOne({ productId, isActive: true }).session(session);
    if (!bom) {
      throw new Error(`BOM not found for product ${productId}`);
    }

    const components = calculateConsumption(bom, quantityProduced);
    let productBaseRaw = 0;          // base raw for this product
    let productAllowedWastageSum = 0; // allowed wastage for this product

    for (const comp of components) {
      const itemType = comp.itemType as "RawMaterial" | "PackagingItem";
      const itemId = String(comp.itemId);
      const qtyWithWastage = num(comp.quantity);   // includes wastage from BOM utility
      const wastagePercent = num(comp.wastagePercent) || 0;
      const unit = comp.unit || (itemType === "PackagingItem" ? "pcs" : wip.unit);

      const effectiveQty = round3(qtyWithWastage);
      const key = keyOf(itemType, itemId);

      if (!materialMap.has(key)) {
        materialMap.set(key, {
          itemType,
          itemId,
          unit,
          expectedQty: 0,
          expectedByProduct: {},
        });
      }

      const pool = materialMap.get(key)!;
      pool.expectedQty = round3(pool.expectedQty + effectiveQty);
      pool.expectedByProduct[productId] = round3(
        (pool.expectedByProduct[productId] || 0) + effectiveQty,
      );

      // Main raw material: separate base and allowed wastage per product
      if (itemType === "RawMaterial" && itemId === String(wip.rawMaterialId)) {
        const convertedEffective = convertUnit(effectiveQty, unit, wip.unit);

        let wastageQty = 0;
        if (wastagePercent > 0) {
          wastageQty = effectiveQty * wastagePercent / (100 + wastagePercent);
        }
        const convertedWastage = convertUnit(wastageQty, unit, wip.unit);
        const convertedBase = round3(convertedEffective - convertedWastage); // base without wastage

        productBaseRaw = round3(productBaseRaw + convertedBase);
        productAllowedWastageSum = round3(productAllowedWastageSum + convertedWastage);
      }
    }

    totalBaseRaw = round3(totalBaseRaw + productBaseRaw);
    totalAllowedWastageRawUsed = round3(totalAllowedWastageRawUsed + productAllowedWastageSum);

    productDrafts.push({
      productId,
      quantityProduced,
      expectedRawUsed: productBaseRaw,   // base only
    });
    productAllowedWastage.push(productAllowedWastageSum);
  }

  const otherMaterialsUsed = Array.from(materialMap.values())
    .filter(
      (m) =>
        !(m.itemType === "RawMaterial" && m.itemId === String(wip.rawMaterialId)),
    )
    .map((m) => ({
      itemType: m.itemType,
      itemId: m.itemId,
      quantity: m.expectedQty,
      unit: m.unit,
    }));

  return {
    productDrafts,
    productAllowedWastage,               // array aligned with productDrafts
    materialPools: Array.from(materialMap.values()),
    expectedRawUsed: totalBaseRaw,       // total base
    allowedWastageRawUsed: totalAllowedWastageRawUsed,
    otherMaterialsUsed,
  };
}

// ---------- Variance calculator ----------
function calculateWipVariance(expected: number, actual: number, allowedWastage: number) {
  if (actual < expected) {
    return {
      gainQuantity: round3(expected - actual),
      normalWastageQuantity: 0,
      productionLossQuantity: 0,
      variance: round3(actual - expected),
      varianceType: "GAIN" as const,
    };
  }

  if (actual === expected) {
    return {
      gainQuantity: 0,
      normalWastageQuantity: 0,
      productionLossQuantity: 0,
      variance: 0,
      varianceType: "PERFECT" as const,
    };
  }

  const excess = actual - expected;
  const normalWastageQuantity = Math.min(excess, allowedWastage);
  const productionLossQuantity = excess - normalWastageQuantity;

  return {
    gainQuantity: 0,
    normalWastageQuantity: round3(normalWastageQuantity),
    productionLossQuantity: round3(productionLossQuantity),
    variance: round3(excess),
    varianceType: "LOSS" as const,
  };
}

// ---------- Allocate actual raw used to products (exact, integer‑based) ----------
function allocateActualToProducts(
  actualUsed: number,
  productBases: number[],
  productAlloweds: number[],
): number[] {
  const scale = 1000;
  const totalBaseGrams = Math.round(productBases.reduce((a, b) => a + b, 0) * scale);
  if (totalBaseGrams === 0) return productBases.map(() => 0);

  const actualGrams = Math.round(actualUsed * scale);
  const baseGrams = productBases.map(b => Math.round(b * scale));
  const allowedGrams = productAlloweds.map(a => Math.round(a * scale));

  // Start with base allocation
  const allocations = baseGrams.slice();
  let excessGrams = actualGrams - totalBaseGrams; // positive = loss, negative = gain

  // Allocate allowed wastage first (only for positive excess)
  if (excessGrams > 0) {
    for (let i = 0; i < productBases.length; i++) {
      const take = Math.min(excessGrams, allowedGrams[i]);
      allocations[i] += take;
      excessGrams -= take;
      if (excessGrams === 0) break;
    }
  }

  // Distribute remaining excess (positive or negative) proportionally to base
  if (excessGrams !== 0) {
    let distributed = 0;
    for (let i = 0; i < productBases.length; i++) {
      const share = Math.trunc((excessGrams * baseGrams[i]) / totalBaseGrams);
      allocations[i] += share;
      distributed += share;
    }
    // Last product absorbs the rounding difference
    allocations[allocations.length - 1] += excessGrams - distributed;
  }

  // Convert back to kg
  return allocations.map(g => round3(g / scale));
}

// ---------- Cost allocator (unchanged) ----------
function allocatePoolCostToProducts(
  pool: MaterialPool,
  poolActualCost: number,
  productDrafts: Array<{
    productId: string;
    quantityProduced: number;
    expectedRawUsed: number;
  }>,
) {
  const allocations = new Map<string, number>();

  const shares = productDrafts.map((p) => ({
    productId: p.productId,
    expectedQty: round2(pool.expectedByProduct[p.productId] || 0),
    quantityProduced: p.quantityProduced,
  }));

  let totalExpected = shares.reduce((sum, s) => sum + s.expectedQty, 0);

  if (totalExpected <= 0) {
    totalExpected = shares.reduce((sum, s) => sum + s.quantityProduced, 0);
    if (totalExpected <= 0) {
      for (const s of shares) allocations.set(s.productId, 0);
      return allocations;
    }

    let remaining = round2(poolActualCost);
    for (let i = 0; i < shares.length; i++) {
      const s = shares[i];
      if (i === shares.length - 1) {
        allocations.set(s.productId, round2(remaining));
      } else {
        const value = round2((poolActualCost * s.quantityProduced) / totalExpected);
        allocations.set(s.productId, value);
        remaining = round2(remaining - value);
      }
    }
    return allocations;
  }

  let remaining = round2(poolActualCost);
  for (let i = 0; i < shares.length; i++) {
    const s = shares[i];
    if (i === shares.length - 1) {
      allocations.set(s.productId, round2(remaining));
    } else {
      const value = round2((poolActualCost * s.expectedQty) / totalExpected);
      allocations.set(s.productId, value);
      remaining = round2(remaining - value);
    }
  }

  return allocations;
}

// =====================================================
//                   MAIN SERVICE
// =====================================================
export const materialWipService = {
  // ---------- startWip ----------
  async startWip({ rawMaterialId, quantity, factoryId, userId }: any) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const today = new Date(new Date().toDateString());
      const qty = num(quantity);

      if (qty <= 0) throw new Error("Invalid quantity");

      const older = await MaterialWIP.findOne({
        rawMaterialId,
        factoryId,
        date: { $lt: today },
        status: { $in: ["ACTIVE", "PENDING_APPROVAL"] },
      }).session(session);

      if (older) {
        throw new Error(
          `WIP from ${older.date.toISOString().slice(0, 10)} is still ${older.status}. Complete it first.`,
        );
      }

      const stock = await RawMaterialStock.findOne({
        rawMaterialId,
        factoryId,
      }).session(session);

      if (!stock || stock.quantity < qty) {
        throw new Error("Insufficient raw material stock");
      }

      const { totalCost } = await inventoryCostService.consume(
        "RawMaterial",
        rawMaterialId,
        factoryId,
        qty,
        "FIFO",
        session,
      );

      const unitCost = round2(totalCost / qty);

      await inventoryCostService.recordConsumption(
        "RawMaterial",
        rawMaterialId,
        factoryId,
        qty,
        totalCost,
        RawMaterialStock,
        "rawMaterialId",
        undefined,
        undefined,
        userId,
        session,
      );

      const rawMaterial = await RawMaterial.findById(rawMaterialId).session(session);
      if (!rawMaterial) throw new Error("Raw material not found");

      const wipAccount = await getWipAccount(rawMaterialId, session);
      const rawMaterialAccount = await getRawMaterialAccount(rawMaterialId, session);

      const startVoucher = await voucherService.create(
        {
          voucherNo: `WIP-START-${Date.now()}`,
          date: new Date(),
          type: "Journal",
          narration: `WIP addition – ${rawMaterial.name} (${qty} ${stock.unit})`,
          lines: [
            {
              accountId: wipAccount._id,
              debit: totalCost,
              credit: 0,
              narration: `WIP for ${rawMaterial.name}`,
            },
            {
              accountId: rawMaterialAccount._id,
              debit: 0,
              credit: totalCost,
              narration: `Raw material issued to WIP`,
            },
          ],
          status: "Approved",
          createdBy: userId,
        },
        session,
      );

      let wip = await MaterialWIP.findOne({
        rawMaterialId,
        factoryId,
        date: today,
        status: "ACTIVE",
      }).session(session);

      if (wip) {
        const newQty = round3(wip.initialQuantity + qty);
        const newCost = round2(wip.startCost + totalCost);

        wip.initialQuantity = newQty;
        wip.remainingQuantity = round3(wip.remainingQuantity + qty);
        wip.issuedQuantity = round3((wip.issuedQuantity || 0) + qty);
        wip.startCost = newCost;
        wip.unitCost = round2(newCost / newQty);
        wip.startVoucherIds.push(startVoucher._id);
        await wip.save({ session });
      } else {
        const created = await MaterialWIP.create(
          [
            {
              rawMaterialId,
              factoryId,
              date: today,
              initialQuantity: qty,
              remainingQuantity: qty,
              issuedQuantity: qty,
              returnedQuantity: 0,
              consumedQuantity: 0,
              unit: stock.unit,
              unitCost,
              startCost: totalCost,
              createdBy: userId,
              startVoucherIds: [startVoucher._id],
            },
          ],
          { session },
        );

        wip = created[0];
      }

      await session.commitTransaction();
      return wip;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },

  // ---------- getPossibleProducts ----------
  async getPossibleProducts(rawMaterialId: string) {
    return BOM.find({
      "components.itemId": rawMaterialId,
      isActive: true,
    }).populate("productId");
  },

  // ---------- requestConversion ----------
  async requestConversion({
    wipId,
    factoryId,
    products,
    remainingRawQuantity,
    userId,
    bypassWastageCheck = false,
  }: any) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wip = await MaterialWIP.findById(wipId).session(session);
      if (!wip) throw new Error("WIP not found");
      if (wip.status !== "ACTIVE") throw new Error("WIP is not active");
      if (String(factoryId) !== String(wip.factoryId)) throw new Error("Factory mismatch");

      const remaining = num(remainingRawQuantity);
      if (remaining < 0) throw new Error("Invalid remaining quantity");
      if (remaining > wip.initialQuantity) {
        throw new Error("Remaining cannot exceed initial quantity");
      }

      const actualUsed = wip.initialQuantity - remaining;
      if (actualUsed <= 0) throw new Error("No material consumed");

      const draft = await buildDraftFromProducts(session, wip, products);

      for (const om of draft.otherMaterialsUsed) {
        const StockModel = om.itemType === "RawMaterial" ? RawMaterialStock : PackagingStock;
        const idField = om.itemType === "RawMaterial" ? "rawMaterialId" : "packagingItemId";

        const stock = await StockModel.findOne({
          [idField]: om.itemId,
          factoryId,
        }).session(session);

        const available = stock?.quantity ?? 0;
        let required = om.quantity;

        if (stock && stock.unit && om.unit && stock.unit !== om.unit) {
          required = convertUnit(om.quantity, om.unit, stock.unit);
        }

        if (required > available) {
          let itemName = om.itemId;
          if (om.itemType === "RawMaterial") {
            const rm = await RawMaterial.findById(om.itemId).session(session).lean();
            itemName = rm?.name || om.itemId;
          } else {
            const pk = await PackagingItem.findById(om.itemId).session(session).lean();
            itemName = pk?.name || om.itemId;
          }

          throw new Error(
            `Shortage: ${itemName} requires ${required} ${stock?.unit || om.unit} but only ${available} ${stock?.unit || om.unit} available.`,
          );
        }
      }

      const variance = calculateWipVariance(
        draft.expectedRawUsed,
        actualUsed,
        draft.allowedWastageRawUsed,
      );

      if (
        STRICT_WASTAGE &&
        variance.productionLossQuantity > 0 &&
        !bypassWastageCheck
      ) {
        throw new Error(
          `Actual raw material used (${round3(actualUsed)} ${wip.unit}) exceeds BOM expected + allowed wastage (${round3(
            draft.expectedRawUsed + draft.allowedWastageRawUsed,
          )} ${wip.unit}).`,
        );
      }

      const perProductActual = allocateActualToProducts(
        actualUsed,
        draft.productDrafts.map((pd) => pd.expectedRawUsed),
        draft.productAllowedWastage,
      );

      const pendingProducts = draft.productDrafts.map((pd, i) => ({
        productId: pd.productId,
        quantityProduced: pd.quantityProduced,
        expectedRawUsed: pd.expectedRawUsed,
        actualRawUsed: perProductActual[i],
        rawMaterialCost: round2(perProductActual[i] * wip.unitCost),
        packagingMaterialCost: 0,
        otherMaterialCost: 0,
        totalCost: round2(perProductActual[i] * wip.unitCost),
        unitCost:
          pd.quantityProduced > 0
            ? round2((perProductActual[i] * wip.unitCost) / pd.quantityProduced)
            : 0,
      }));

      const otherMaterials = draft.otherMaterialsUsed.map((o) => ({
        itemType: o.itemType,
        itemId: o.itemId,
        quantity: o.quantity,
        unit: o.unit,
        unitCost: 0,
        totalCost: 0,
      }));

      wip.set("pendingConversion", {
        products: pendingProducts,
        remainingRawQuantity: remaining,
        expectedRawUsed: draft.expectedRawUsed,
        allowedWastageRawUsed: draft.allowedWastageRawUsed,
        actualRawUsed: round3(actualUsed),
        gainQuantity: variance.gainQuantity,
        normalWastageQuantity: variance.normalWastageQuantity,
        productionLossQuantity: variance.productionLossQuantity,
        rawMaterialCost: round2(actualUsed * wip.unitCost),
        packagingMaterialCost: 0,
        otherMaterialCost: 0,
        totalInputCost: round2(actualUsed * wip.unitCost),
        totalFinishedGoodsCost: pendingProducts.reduce((s, p) => s + p.totalCost, 0),
        otherMaterialsUsed: otherMaterials,
        notes: "Pending approval",
        createdBy: userId,
      });

      wip.status = "PENDING_APPROVAL";
      wip.remainingQuantity = round3(remaining);
      wip.issuedQuantity = wip.initialQuantity;
      wip.consumedQuantity = round3(actualUsed);

      await wip.save({ session });

      await session.commitTransaction();

      return {
        wip,
        warning:
          variance.productionLossQuantity > 0
            ? "Actual usage exceeds BOM expected + allowed wastage. Approver review required."
            : null,
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },

  // ---------- updatePendingConversion ----------
  async updatePendingConversion({
    wipId,
    factoryId,
    products,
    remainingRawQuantity,
    notes,
    userId,
  }: any) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wip = await MaterialWIP.findById(wipId).session(session);
      if (!wip) throw new Error("WIP not found");
      if (wip.status !== "PENDING_APPROVAL") {
        throw new Error("WIP is not pending approval");
      }
      if (String(factoryId) !== String(wip.factoryId)) {
        throw new Error("Factory mismatch");
      }

      const pendingProducts =
        products?.length > 0
          ? products
          : wip.pendingConversion?.products?.map((p: any) => ({
              productId: String(p.productId),
              quantityProduced: num(p.quantityProduced),
            })) || [];

      const remaining =
        remainingRawQuantity !== undefined
          ? num(remainingRawQuantity)
          : num(wip.pendingConversion?.remainingRawQuantity);

      if (remaining < 0 || remaining > wip.initialQuantity) {
        throw new Error("Invalid remaining quantity");
      }

      const draft = await buildDraftFromProducts(session, wip, pendingProducts);
      const actualUsed = wip.initialQuantity - remaining;
      const variance = calculateWipVariance(
        draft.expectedRawUsed,
        actualUsed,
        draft.allowedWastageRawUsed,
      );

      const perProductActual = allocateActualToProducts(
        actualUsed,
        draft.productDrafts.map((pd) => pd.expectedRawUsed),
        draft.productAllowedWastage,
      );

      const newPendingProducts = draft.productDrafts.map((pd, i) => ({
        productId: pd.productId,
        quantityProduced: pd.quantityProduced,
        expectedRawUsed: pd.expectedRawUsed,
        actualRawUsed: perProductActual[i],
        rawMaterialCost: round2(perProductActual[i] * wip.unitCost),
        packagingMaterialCost: 0,
        otherMaterialCost: 0,
        totalCost: round2(perProductActual[i] * wip.unitCost),
        unitCost:
          pd.quantityProduced > 0
            ? round2((perProductActual[i] * wip.unitCost) / pd.quantityProduced)
            : 0,
      }));

      const otherMaterials = draft.otherMaterialsUsed.map((o) => ({
        itemType: o.itemType,
        itemId: o.itemId,
        quantity: o.quantity,
        unit: o.unit,
        unitCost: 0,
        totalCost: 0,
      }));

      wip.set("pendingConversion", {
        products: newPendingProducts,
        remainingRawQuantity: remaining,
        expectedRawUsed: draft.expectedRawUsed,
        allowedWastageRawUsed: draft.allowedWastageRawUsed,
        actualRawUsed: round3(actualUsed),
        gainQuantity: variance.gainQuantity,
        normalWastageQuantity: variance.normalWastageQuantity,
        productionLossQuantity: variance.productionLossQuantity,
        rawMaterialCost: round2(actualUsed * wip.unitCost),
        packagingMaterialCost: 0,
        otherMaterialCost: 0,
        totalInputCost: round2(actualUsed * wip.unitCost),
        totalFinishedGoodsCost: newPendingProducts.reduce((s, p) => s + p.totalCost, 0),
        otherMaterialsUsed: otherMaterials,
        notes: notes || wip.pendingConversion?.notes || "",
        createdBy: wip.pendingConversion?.createdBy || userId,
      });

      wip.remainingQuantity = round3(remaining);
      wip.issuedQuantity = wip.initialQuantity;
      wip.consumedQuantity = round3(actualUsed);

      await wip.save({ session });

      await session.commitTransaction();
      return wip;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },

  // ---------- approveConversion ----------
  async approveConversion({ wipId, userId }: any) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wip = await MaterialWIP.findById(wipId).session(session);
      if (!wip) throw new Error("WIP not found");
      if (wip.status !== "PENDING_APPROVAL") {
        throw new Error("WIP is not pending approval");
      }
      if (!wip.pendingConversion) {
        throw new Error("No pending conversion");
      }

      const pending = wip.pendingConversion as any;
      const draft = await buildDraftFromProducts(
        session,
        wip,
        pending.products.map((p: any) => ({
          productId: String(p.productId),
          quantityProduced: num(p.quantityProduced),
        })),
      );

      const remaining = num(pending.remainingRawQuantity);
      const actualUsed = wip.initialQuantity - remaining;

      if (actualUsed < 0 || remaining > wip.initialQuantity) {
        throw new Error("Invalid remaining quantity in pending conversion");
      }

      const variance = calculateWipVariance(
        draft.expectedRawUsed,
        actualUsed,
        draft.allowedWastageRawUsed,
      );

      for (const om of draft.otherMaterialsUsed) {
        const StockModel = om.itemType === "RawMaterial" ? RawMaterialStock : PackagingStock;
        const idField = om.itemType === "RawMaterial" ? "rawMaterialId" : "packagingItemId";

        const stock = await StockModel.findOne({
          [idField]: om.itemId,
          factoryId: wip.factoryId,
        }).session(session);

        const available = stock?.quantity ?? 0;
        let required = om.quantity;

        if (stock && stock.unit && om.unit && stock.unit !== om.unit) {
          required = convertUnit(om.quantity, om.unit, stock.unit);
        }

        if (required > available) {
          throw new Error(
            `Shortage during approval: ${om.itemType} ${om.itemId} requires ${required} ${stock?.unit || om.unit}, but only ${available} available.`,
          );
        }
      }

      const materialPools: Array<{
        itemType: "RawMaterial" | "PackagingItem";
        itemId: string;
        unit: string;
        expectedByProduct: Record<string, number>;
        actualQty: number;
        actualCost: number;
      }> = [];

      const mainConsumedCost = round2(wip.startCost - remaining * wip.unitCost);
      const mainPool = draft.materialPools.find(
        (p) => p.itemType === "RawMaterial" && p.itemId === String(wip.rawMaterialId),
      );

      if (mainPool) {
        materialPools.push({
          itemType: "RawMaterial",
          itemId: String(wip.rawMaterialId),
          unit: wip.unit,
          expectedByProduct: mainPool.expectedByProduct,
          actualQty: round3(actualUsed),
          actualCost: mainConsumedCost,
        });
      } else {
        materialPools.push({
          itemType: "RawMaterial",
          itemId: String(wip.rawMaterialId),
          unit: wip.unit,
          expectedByProduct: {},
          actualQty: round3(actualUsed),
          actualCost: mainConsumedCost,
        });
      }

      let totalOtherMaterialCost = 0;
      const otherMaterialCostByType = { RawMaterial: 0, PackagingItem: 0 };

      for (const om of draft.otherMaterialsUsed) {
        const itemType = om.itemType;
        const itemId = String(om.itemId);
        const StockModel = itemType === "RawMaterial" ? RawMaterialStock : PackagingStock;
        const idField = itemType === "RawMaterial" ? "rawMaterialId" : "packagingItemId";

        const { totalCost } = await inventoryCostService.consume(
          itemType,
          itemId,
          wip.factoryId,
          om.quantity,
          "FIFO",
          session,
        );

        await inventoryCostService.recordConsumption(
          itemType,
          itemId,
          wip.factoryId,
          om.quantity,
          totalCost,
          StockModel,
          idField,
          undefined,
          undefined,
          userId,
          session,
        );

        totalOtherMaterialCost = round2(totalOtherMaterialCost + totalCost);
        if (itemType === "RawMaterial") {
          otherMaterialCostByType.RawMaterial = round2(
            otherMaterialCostByType.RawMaterial + totalCost,
          );
        } else {
          otherMaterialCostByType.PackagingItem = round2(
            otherMaterialCostByType.PackagingItem + totalCost,
          );
        }

        const pool = draft.materialPools.find(
          (p) => p.itemType === itemType && p.itemId === itemId,
        );

        materialPools.push({
          itemType,
          itemId,
          unit: om.unit,
          expectedByProduct: pool?.expectedByProduct || {},
          actualQty: om.quantity,
          actualCost: totalCost,
        });
      }

      const productMap = new Map<string, ProductAllocation>();

      const perProductActual = allocateActualToProducts(
        actualUsed,
        draft.productDrafts.map((pd) => pd.expectedRawUsed),
        draft.productAllowedWastage,
      );

      for (let i = 0; i < pending.products.length; i++) {
        const p = pending.products[i];
        const productId = String(p.productId);
        productMap.set(productId, {
          productId,
          quantityProduced: num(p.quantityProduced),
          expectedRawUsed: draft.productDrafts[i]?.expectedRawUsed || 0,
          actualRawUsed: perProductActual[i],
          rawMaterialCost: 0,
          packagingMaterialCost: 0,
          otherMaterialCost: 0,
          totalCost: 0,
          unitCost: 0,
        });
      }

      for (const pool of materialPools) {
        const allocations = allocatePoolCostToProducts(
          {
            itemType: pool.itemType,
            itemId: pool.itemId,
            unit: pool.unit,
            expectedQty: 0,
            expectedByProduct: pool.expectedByProduct,
          },
          pool.actualCost,
          draft.productDrafts,
        );

        for (const [productId, cost] of allocations.entries()) {
          const line = productMap.get(productId);
          if (!line) continue;

          line.totalCost = round2(line.totalCost + cost);

          if (pool.itemType === "PackagingItem") {
            line.packagingMaterialCost = round2(line.packagingMaterialCost + cost);
          } else {
            line.rawMaterialCost = round2(line.rawMaterialCost + cost);
          }
        }
      }

      for (const line of productMap.values()) {
        line.unitCost =
          line.quantityProduced > 0 ? round2(line.totalCost / line.quantityProduced) : 0;
      }

      const productAllocations = Array.from(productMap.values());

      const finishedGoodsVoucherLines: any[] = [];
      let totalFinishedGoodsCost = 0;

      for (const pc of productAllocations) {
        totalFinishedGoodsCost = round2(totalFinishedGoodsCost + pc.totalCost);

        await ProductStock.findOneAndUpdate(
          { productId: pc.productId, warehouseId: wip.factoryId },
          { $inc: { quantity: pc.quantityProduced } },
          { upsert: true, session },
        );

        await stockTransactionService.create(
          {
            itemType: "Product",
            itemId: pc.productId,
            locationId: wip.factoryId,
            transactionType: "production",
            quantity: pc.quantityProduced,
            unitCost: pc.unitCost,
            totalCost: pc.totalCost,
            transactionDate: new Date(),
            createdBy: userId,
            remainingQuantity: pc.quantityProduced,
          },
          session,
        );

        const productAccount = await getProductAccount(pc.productId, session);
        finishedGoodsVoucherLines.push({
          accountId: productAccount._id,
          debit: pc.totalCost,
          credit: 0,
          narration: `Finished goods produced`,
        });
      }

      const returnCost = round2(remaining * wip.unitCost);
      const rawMaterialName =
        (await RawMaterial.findById(wip.rawMaterialId).session(session).lean())?.name ||
        String(wip.rawMaterialId);

      if (remaining > 0) {
        await RawMaterialStock.updateOne(
          { rawMaterialId: wip.rawMaterialId, factoryId: wip.factoryId },
          { $inc: { quantity: remaining } },
          { session },
        );

        await stockTransactionService.create(
          {
            itemType: "RawMaterial",
            itemId: String(wip.rawMaterialId),
            locationId: wip.factoryId,
            transactionType: "production_return",
            quantity: remaining,
            unitCost: wip.unitCost,
            totalCost: returnCost,
            transactionDate: new Date(),
            createdBy: userId,
            remainingQuantity: remaining,
          },
          session,
        );
      }

      const rawMaterialAccount = await getRawMaterialAccount(String(wip.rawMaterialId), session);
      const wipAccount = await getWipAccount(String(wip.rawMaterialId), session);

      const returnVoucher = await voucherService.create(
        {
          voucherNo: `WIP-RET-${Date.now()}`,
          date: new Date(),
          type: "Journal",
          narration: `Return remaining raw material – ${rawMaterialName} (${round3(remaining)} ${wip.unit})`,
          lines: [
            {
              accountId: rawMaterialAccount._id,
              debit: returnCost,
              credit: 0,
              narration: `Raw material returned`,
            },
            {
              accountId: wipAccount._id,
              debit: 0,
              credit: returnCost,
              narration: `WIP reduction`,
            },
          ],
          status: "Approved",
          createdBy: userId,
        },
        session,
      );

      const conversionLines: any[] = [
        ...finishedGoodsVoucherLines,
        {
          accountId: wipAccount._id,
          debit: 0,
          credit: mainConsumedCost,
          narration: `Consumed WIP cost`,
        },
      ];

      for (const om of draft.otherMaterialsUsed) {
        const account =
          om.itemType === "RawMaterial"
            ? await getRawMaterialAccount(String(om.itemId), session)
            : await getPackagingItemAccount(String(om.itemId), session);

        const actualCost =
          materialPools.find(
            (m) => m.itemType === om.itemType && m.itemId === String(om.itemId),
          )?.actualCost || 0;

        conversionLines.push({
          accountId: account._id,
          debit: 0,
          credit: actualCost,
          narration: `Consumed ${om.itemType}`,
        });
      }

      const convVoucher = await voucherService.create(
        {
          voucherNo: `WIP-CONV-${Date.now()}`,
          date: new Date(),
          type: "Journal",
          narration: `Conversion for WIP ${wip._id}`,
          lines: conversionLines,
          status: "Approved",
          createdBy: userId,
        },
        session,
      );

      const rawMaterialCost = round2(
        mainConsumedCost +
          materialPools
            .filter(
              (m) => m.itemType === "RawMaterial" && m.itemId !== String(wip.rawMaterialId),
            )
            .reduce((sum, m) => sum + m.actualCost, 0),
      );

      const packagingMaterialCost = round2(
        materialPools
          .filter((m) => m.itemType === "PackagingItem")
          .reduce((sum, m) => sum + m.actualCost, 0),
      );

      wip.conversions.push({
        products: productAllocations.map((p) => ({
          productId: p.productId,
          quantityProduced: p.quantityProduced,
          expectedRawUsed: p.expectedRawUsed,
          actualRawUsed: p.actualRawUsed,
          rawMaterialCost: p.rawMaterialCost,
          packagingMaterialCost: p.packagingMaterialCost,
          otherMaterialCost: p.otherMaterialCost,
          totalCost: p.totalCost,
          unitCost: p.unitCost,
        })),
        expectedRawUsed: draft.expectedRawUsed,
        allowedWastageRawUsed: draft.allowedWastageRawUsed,
        actualRawUsed: round3(actualUsed),
        gainQuantity: variance.gainQuantity,
        normalWastageQuantity: variance.normalWastageQuantity,
        productionLossQuantity: variance.productionLossQuantity,
        rawMaterialCost,
        packagingMaterialCost,
        otherMaterialCost: 0,
        totalInputCost: round2(rawMaterialCost + packagingMaterialCost),
        totalFinishedGoodsCost: totalFinishedGoodsCost,
        otherMaterialsUsed: draft.otherMaterialsUsed.map((o) => ({
          itemType: o.itemType,
          itemId: o.itemId,
          quantity: o.quantity,
          unit: o.unit,
          totalCost:
            materialPools.find(
              (m) => m.itemType === o.itemType && m.itemId === o.itemId,
            )?.actualCost || 0,
        })),
        notes: pending.notes || "",
        createdBy: pending.createdBy || userId,
        approvedBy: userId,
        approvedAt: new Date(),
      });

      wip.pendingConversion = undefined;
      wip.status = "APPROVED";
      wip.approvedBy = userId;
      wip.approvedAt = new Date();
      wip.remainingQuantity = round3(remaining);
      wip.issuedQuantity = wip.initialQuantity;
      wip.consumedQuantity = round3(actualUsed);
      wip.expectedRawUsed = draft.expectedRawUsed;
      wip.allowedWastageRawUsed = draft.allowedWastageRawUsed;
      wip.actualRawUsed = round3(actualUsed);
      wip.gainQuantity = variance.gainQuantity;
      wip.normalWastageQuantity = variance.normalWastageQuantity;
      wip.productionLossQuantity = variance.productionLossQuantity;
      wip.rawMaterialCost = rawMaterialCost;
      wip.packagingMaterialCost = packagingMaterialCost;
      wip.otherMaterialCost = 0;
      wip.totalInputCost = round2(rawMaterialCost + packagingMaterialCost);
      wip.totalFinishedGoodsCost = totalFinishedGoodsCost;
      wip.returnVoucherId = returnVoucher._id;
      wip.conversionVoucherId = convVoucher._id;

      await wip.save({ session });

      await session.commitTransaction();
      return wip;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },

  // ---------- rejectPendingConversion (now factoryId optional) ----------
  async rejectPendingConversion({ wipId, factoryId, reason, userId }: any) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wip = await MaterialWIP.findById(wipId).session(session);
      if (!wip) throw new Error("WIP not found");
      if (wip.status !== "PENDING_APPROVAL") {
        throw new Error("WIP is not pending approval");
      }
      // Skip factory check if factoryId not provided
      if (factoryId && String(factoryId) !== String(wip.factoryId)) {
        throw new Error("Factory mismatch");
      }

      wip.pendingConversion = undefined;
      wip.status = "ACTIVE";
      wip.rejectionReason = reason || "Rejected by approver";
      wip.approvedBy = undefined;
      wip.approvedAt = undefined;

      await wip.save({ session });

      await session.commitTransaction();
      return wip;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },

  // ---------- listWip ----------
  async listWip({
    factoryId,
    rawMaterialId,
    status,
    fromDate,
    toDate,
    q,
    page = 1,
    limit = 15,
  }: any) {
    const filter: any = {};

    if (factoryId) filter.factoryId = factoryId;
    if (rawMaterialId) filter.rawMaterialId = rawMaterialId;
    if (status) filter.status = status;

    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate) filter.date.$lte = new Date(toDate);
    }

    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const rawMaterials = await RawMaterial.find({ name: regex }, "_id").lean();
      const rawIds = rawMaterials.map((rm) => rm._id);

      filter.$or = [
        { rawMaterialId: { $in: rawIds } },
        { _id: mongoose.Types.ObjectId.isValid(q) ? q : undefined },
      ].filter(Boolean);
    }

    const skip = (num(page) - 1) * num(limit);

    const [data, total] = await Promise.all([
      MaterialWIP.find(filter)
        .populate("rawMaterialId")
        .populate("factoryId", "name code")
        .populate("createdBy", "name")
        .populate("approvedBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(num(limit))
        .lean(),
      MaterialWIP.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page: num(page),
      limit: num(limit),
    };
  },

  // ---------- getWipById ----------
  async getWipById(id: string) {
    return MaterialWIP.findById(id)
      .populate("rawMaterialId")
      .populate("factoryId", "name code")
      .populate("createdBy", "name")
      .populate("approvedBy", "name")
      .populate("conversions.products.productId", "name code")
      .populate("pendingConversion.products.productId", "name code")
      .lean();
  },
};