import { Types } from "mongoose";

export interface BOMComponentResult {
  itemType: "RawMaterial" | "PackagingItem";
  itemId: Types.ObjectId;
  quantity: number;
  unit?: string; // production unit chosen in BOM
}

/* ----------------- Unit conversion helpers ----------------- */
const unitGroups: Record<string, string[]> = {
  mass: ["kg", "g"],
  volume: ["ltr", "ml"],
  piece: ["pcs"],
};

function unitGroupOf(u?: string) {
  if (!u) return null;
  if (unitGroups.mass.includes(u)) return "mass";
  if (unitGroups.volume.includes(u)) return "volume";
  if (unitGroups.piece.includes(u)) return "piece";
  return null;
}

export function convertUnit(
  value: number,
  from: string | undefined,
  to: string | undefined
) {
  if (!from || !to || from === to) return value;
  // mass
  if (from === "kg" && to === "g") return value * 1000;
  if (from === "g" && to === "kg") return value / 1000;
  // volume
  if (from === "ltr" && to === "ml") return value * 1000;
  if (from === "ml" && to === "ltr") return value / 1000;
  // piece
  return value;
}

function applyRounding(
  val: number,
  method?: "NONE" | "CEIL" | "FLOOR" | "ROUND"
) {
  if (!method || method === "NONE") return val;
  if (method === "CEIL") return Math.ceil(val);
  if (method === "FLOOR") return Math.floor(val);
  if (method === "ROUND") return Math.round(val);
  return val;
}

/* ----------------- Main calculation ----------------- */
export function calculateConsumption(
  bom: any,
  productionQty: number
): BOMComponentResult[] {
  const results: BOMComponentResult[] = [];

  for (const comp of bom.components) {
    let baseQty = 0;

    // 1️⃣ Rule
    if (comp.rule.type === "PER_UNIT") {
      baseQty = productionQty * comp.quantity;
    } else if (comp.rule.type === "PER_N_UNITS") {
      if (!comp.rule.n || comp.rule.n <= 0)
        throw new Error("Invalid PER_N_UNITS N value");
      const batches = Math.ceil(productionQty / comp.rule.n);
      baseQty = batches * comp.quantity;
    }

    // 2️⃣ Wastage %
    if (comp.wastagePercent && comp.wastagePercent > 0) {
      baseQty *= 1 + comp.wastagePercent / 100;
    }

    // 3️⃣ Rounding
    baseQty = applyRounding(baseQty, comp.roundingMethod);

    results.push({
      itemType: comp.itemType,
      itemId: comp.itemId,
      quantity: Number(baseQty.toFixed(6)), // preserve precision
      unit: comp.unit, // production unit from BOM
    });
  }

  return results;
}
