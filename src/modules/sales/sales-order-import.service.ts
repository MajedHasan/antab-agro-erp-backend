import * as XLSX from "xlsx";

import { Types } from "mongoose";

import Dealer from "../../models/dealer.model";

import WarehouseOrFactory from "../../models/warehouseOrFactory.model";

import Product from "../../models/product.model";

import { promotionService } from "../../services/product-promotion.service";

const REQUIRED_COLUMNS = [
  "Import Reference",
  "Dealer Code",
  "Warehouse Code",
  "Order Date",
  "Payment Method",
  "Product SKU",
  "Qty",
];

export interface SalesOrderImportRow {
  rowNumber: number;

  importReference: string;

  dealerCode: string;

  warehouseCode: string;

  orderDate: Date | null;

  paymentMethod: "CASH" | "CREDIT" | "";

  productSku: string;

  qty: number | null;

  // Optional Excel price override.
  // Blank = use product salePrice.
  price: number | null;

  hasPrice: boolean;

  bonusQtyOverride: number | null;

  hasBonusQtyOverride: boolean;

  discountPercent: number;

  taxPercent: number;

  hasDiscountPercent: boolean;

  hasTaxPercent: boolean;

  notes: string;

  errors: string[];
}

export interface ResolvedSalesOrderImportRow
  extends SalesOrderImportRow {
  dealerId?: Types.ObjectId;

  dealerName?: string;

  dealerType?: string;

  dealerStatus?: string;

  warehouseId?: Types.ObjectId;

  warehouseName?: string;

  warehouseType?: string;

  warehouseStatus?: string;

  productId?: Types.ObjectId;

  productName?: string;

  productSalePrice?: number;

  productTaxRate?: number;

  productStatus?: string;

  promotionBonusQty: number;

  appliedPromotionId?: string;

  finalBonusQty: number;

  unitPrice: number;

  grossAmount: number;

  discountAmount: number;

  taxableAmount: number;

  taxAmount: number;

  lineTotal: number;
}

export interface SalesOrderImportGroup {
  importReference: string;

  dealerId?: Types.ObjectId;

  dealerCode: string;

  dealerName?: string;

  warehouseId?: Types.ObjectId;

  warehouseCode: string;

  warehouseName?: string;

  orderDate: Date | null;

  paymentMethod: "CASH" | "CREDIT" | "";

  notes: string;

  items: ResolvedSalesOrderImportRow[];

  totalQty: number;

  totalBonusQty: number;

  subtotal: number;

  discountAmount: number;

  taxableAmount: number;

  taxAmount: number;

  grandTotal: number;

  errors: string[];
}

export interface SalesOrderImportPreview {
  rows: ResolvedSalesOrderImportRow[];

  groups: SalesOrderImportGroup[];

  totalRows: number;

  validRows: number;

  invalidRows: number;

  totalOrders: number;

  validOrders: number;

  invalidOrders: number;

  totalQty: number;

  totalBonusQty: number;

  subtotal: number;

  discountAmount: number;

  taxAmount: number;

  grandTotal: number;

  errors: string[];
}

export interface SalesOrderImportItemPayload {
  productId: Types.ObjectId;

  warehouseId: Types.ObjectId;

  qty: number;

  bonusQty: number;

  unitPrice: number;

  discountPercent: number;

  discountAmount: number;

  taxPercent: number;

  taxAmount: number;

  lineSubtotal: number;

  lineTotal: number;

  productSku: string;

  productName: string;
}

export interface SalesOrderImportOrderPayload {
  importReference: string;

  customerId: Types.ObjectId;

  warehouseId: Types.ObjectId;

  orderDate: Date;

  paymentMethod: "CASH" | "CREDIT";

  items: SalesOrderImportItemPayload[];

  subTotal: number;

  totalDiscount: number;

  totalTax: number;

  grandTotal: number;

  totalBonusQty: number;

  createdBy: Types.ObjectId;

  notes?: string;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toObjectId(value: unknown): Types.ObjectId | undefined {
  if (value instanceof Types.ObjectId) {
    return value;
  }

  if (typeof value === "string") {
    if (Types.ObjectId.isValid(value)) {
      return new Types.ObjectId(value);
    }

    return undefined;
  }

  if (value && typeof value === "object" && "_id" in value) {
    const nestedId = (value as { _id?: unknown })._id;

    return toObjectId(nestedId);
  }

  return undefined;
}

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeCode(value: unknown): string {
  return normalizeString(value).toUpperCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(String(value).trim());

  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercentage(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "string" && value.trim() === "") {
    return 0;
  }

  const parsed = parseNumber(value);

  if (parsed === null) {
    return NaN;
  }

  return parsed;
}

function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);

    if (!date) {
      return null;
    }

    const parsed = new Date(
      date.y,
      date.m - 1,
      date.d,
      date.H || 0,
      date.M || 0,
      date.S || 0,
    );

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "string") {
    const text = value.trim();

    if (!text) {
      return null;
    }

    /*
     * Excel users commonly use:
     *
     * 2026-01-31
     * 31/01/2026
     * 31-01-2026
     *
     * JavaScript's Date parser is not reliable for every
     * DD/MM/YYYY variation, so handle those explicitly.
     */

    const slashMatch = text.match(
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/,
    );

    if (slashMatch) {
      const day = Number(slashMatch[1]);

      const month = Number(slashMatch[2]);

      const year = Number(slashMatch[3]);

      const parsed = new Date(
        year,
        month - 1,
        day,
      );

      if (
        parsed.getFullYear() === year &&
        parsed.getMonth() === month - 1 &&
        parsed.getDate() === day
      ) {
        return parsed;
      }

      return null;
    }

    const parsed = new Date(text);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function normalizePaymentMethod(
  value: unknown,
): "CASH" | "CREDIT" | "" {
  const paymentMethod =
    normalizeString(value).toUpperCase();

  if (paymentMethod === "CASH") {
    return "CASH";
  }

  if (paymentMethod === "CREDIT") {
    return "CREDIT";
  }

  return "";
}

function validateHeaders(headers: string[]): string[] {
  const errors: string[] = [];

  const normalizedHeaders = new Set(
    headers.map((header) =>
      normalizeString(header),
    ),
  );

  for (const requiredColumn of REQUIRED_COLUMNS) {
    if (!normalizedHeaders.has(requiredColumn)) {
      errors.push(
        `Missing required column: ${requiredColumn}`,
      );
    }
  }

  return errors;
}

function validateRow(
  row: SalesOrderImportRow,
): void {
  const errors = row.errors;

  if (!row.importReference) {
    errors.push("Import Reference is required");
  }

  if (!row.dealerCode) {
    errors.push("Dealer Code is required");
  }

  if (!row.warehouseCode) {
    errors.push("Warehouse Code is required");
  }

  if (!row.orderDate) {
    errors.push(
      "Order Date is required and must be a valid date",
    );
  }

  if (!row.paymentMethod) {
    errors.push(
      "Payment Method must be CASH or CREDIT",
    );
  }

  if (!row.productSku) {
    errors.push("Product SKU is required");
  }

  if (row.qty === null) {
    errors.push(
      "Qty is required and must be a number",
    );
  } else if (row.qty <= 0) {
    errors.push(
      "Qty must be greater than 0",
    );
  }

  if (
    row.qty !== null &&
    !Number.isFinite(row.qty)
  ) {
    errors.push(
      "Qty must be a valid number",
    );
  }

  /*
   * Price override:
   *
   * blank = use product salePrice
   * 0     = explicitly use 0
   * 150   = use 150
   *
   * Negative prices are not allowed.
   */
  if (row.hasPrice) {
    if (row.price === null) {
      errors.push(
        "Price must be a number when provided",
      );
    } else if (row.price < 0) {
      errors.push(
        "Price cannot be negative",
      );
    }
  }

  if (row.hasBonusQtyOverride) {
    if (row.bonusQtyOverride === null) {
      errors.push(
        "Bonus Qty Override must be a number when provided",
      );
    } else if (row.bonusQtyOverride < 0) {
      errors.push(
        "Bonus Qty Override cannot be negative",
      );
    } else if (
      !Number.isInteger(row.bonusQtyOverride)
    ) {
      errors.push(
        "Bonus Qty Override must be a whole number",
      );
    }
  }

  if (Number.isNaN(row.discountPercent)) {
    errors.push(
      "Discount % must be a number",
    );
  } else if (
    row.discountPercent < 0 ||
    row.discountPercent > 100
  ) {
    errors.push(
      "Discount % must be between 0 and 100",
    );
  }

  if (Number.isNaN(row.taxPercent)) {
    errors.push(
      "Tax % must be a number",
    );
  } else if (
    row.taxPercent < 0 ||
    row.taxPercent > 100
  ) {
    errors.push(
      "Tax % must be between 0 and 100",
    );
  }
}

function calculateLineAmounts(
  row: ResolvedSalesOrderImportRow,
): void {
  const qty = row.qty || 0;

  /*
   * Price:
   *
   * Excel Price provided -> use Excel Price.
   * Excel Price blank -> use Product.salePrice.
   *
   * Using hasPrice is important because 0 is a valid
   * explicit price override.
   */
  const unitPrice = row.hasPrice
    ? Number(row.price ?? 0)
    : Number(row.productSalePrice || 0);

  const grossAmount = roundMoney(
    qty * unitPrice,
  );

  const discountAmount = roundMoney(
    grossAmount *
      (row.discountPercent / 100),
  );

  const taxableAmount = roundMoney(
    Math.max(
      0,
      grossAmount - discountAmount,
    ),
  );

  const taxAmount = roundMoney(
    taxableAmount *
      (row.taxPercent / 100),
  );

  const lineTotal = roundMoney(
    taxableAmount + taxAmount,
  );

  row.unitPrice = unitPrice;

  row.grossAmount = grossAmount;

  row.discountAmount = discountAmount;

  row.taxableAmount = taxableAmount;

  row.taxAmount = taxAmount;

  row.lineTotal = lineTotal;
}

export const salesOrderImportService = {
  parseWorkbook(
    buffer: Buffer,
  ): Record<string, unknown>[] {
    if (!buffer || buffer.length === 0) {
      throw new Error(
        "Excel file is empty",
      );
    }

    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      cellNF: false,
      cellText: true,
    });

    if (!workbook.SheetNames.length) {
      throw new Error(
        "Excel workbook contains no sheets",
      );
    }

    const firstSheetName =
      workbook.SheetNames[0];

    if (!firstSheetName) {
      throw new Error(
        "Excel workbook contains no usable sheet",
      );
    }

    const worksheet =
      workbook.Sheets[firstSheetName];

    if (!worksheet) {
      throw new Error(
        "Unable to read the first Excel worksheet",
      );
    }

    return XLSX.utils.sheet_to_json<
      Record<string, unknown>
    >(worksheet, {
      defval: "",
      raw: true,
    });
  },

  parseRows(
    buffer: Buffer,
  ): {
    rows: SalesOrderImportRow[];
    errors: string[];
  } {
    const rawRows =
      this.parseWorkbook(buffer);

    if (rawRows.length === 0) {
      throw new Error(
        "Excel file contains no data rows",
      );
    }

    const headers = Object.keys(
      rawRows[0] || {},
    );

    const headerErrors =
      validateHeaders(headers);

    if (headerErrors.length > 0) {
      return {
        rows: [],
        errors: headerErrors,
      };
    }

    const rows = rawRows.map(
      (
        rawRow,
        index,
      ): SalesOrderImportRow => {
        const rawPrice =
          rawRow["Price"];

        const rawBonusOverride =
          rawRow["Bonus Qty Override"];

        const rawDiscount =
          rawRow["Discount %"];

        const rawTax =
          rawRow["Tax %"];

        /*
         * Price is optional.
         *
         * Blank = fallback to Product.salePrice.
         * Any actual value, including 0, means
         * the user explicitly supplied a price.
         */
        const hasPrice =
          rawPrice !== undefined &&
          rawPrice !== null &&
          String(rawPrice).trim() !== "";

        const hasBonusQtyOverride =
          rawBonusOverride !== undefined &&
          rawBonusOverride !== null &&
          String(rawBonusOverride).trim() !== "";

        const hasDiscountPercent =
          rawDiscount !== undefined &&
          rawDiscount !== null &&
          String(rawDiscount).trim() !== "";

        const hasTaxPercent =
          rawTax !== undefined &&
          rawTax !== null &&
          String(rawTax).trim() !== "";

        const row: SalesOrderImportRow = {
          rowNumber: index + 2,

          importReference:
            normalizeString(
              rawRow["Import Reference"],
            ),

          dealerCode:
            normalizeString(
              rawRow["Dealer Code"],
            ),

          warehouseCode:
            normalizeString(
              rawRow["Warehouse Code"],
            ),

          orderDate:
            parseExcelDate(
              rawRow["Order Date"],
            ),

          paymentMethod:
            normalizePaymentMethod(
              rawRow["Payment Method"],
            ),

          productSku:
            normalizeString(
              rawRow["Product SKU"],
            ),

          qty:
            parseNumber(
              rawRow["Qty"],
            ),

          price: hasPrice
            ? parseNumber(rawPrice)
            : null,

          hasPrice,

          bonusQtyOverride:
            hasBonusQtyOverride
              ? parseNumber(
                  rawBonusOverride,
                )
              : null,

          hasBonusQtyOverride,

          discountPercent:
            parsePercentage(
              rawDiscount,
            ),

          taxPercent:
            parsePercentage(
              rawTax,
            ),

          hasDiscountPercent,

          hasTaxPercent,

          notes:
            normalizeString(
              rawRow["Notes"],
            ),

          errors: [],
        };

        validateRow(row);

        return row;
      },
    );

    return {
      rows,
      errors: [],
    };
  },

  async resolveRows(
    rows: SalesOrderImportRow[],
  ): Promise<ResolvedSalesOrderImportRow[]> {
    if (rows.length === 0) {
      return [];
    }

    const dealerCodes = [
      ...new Set(
        rows
          .map((row) =>
            normalizeCode(
              row.dealerCode,
            ),
          )
          .filter(Boolean),
      ),
    ];

    const warehouseCodes = [
      ...new Set(
        rows
          .map((row) =>
            normalizeCode(
              row.warehouseCode,
            ),
          )
          .filter(Boolean),
      ),
    ];

    const productSkus = [
      ...new Set(
        rows
          .map((row) =>
            normalizeCode(
              row.productSku,
            ),
          )
          .filter(Boolean),
      ),
    ];

    const [
      dealers,
      warehouses,
      products,
    ] = await Promise.all([
      Dealer.find({
        code: {
          $in: dealerCodes.map(
            (code) =>
              new RegExp(
                `^${escapeRegex(code)}$`,
                "i",
              ),
          ),
        },
      })
        .select(
          "_id code name status type creditLimit currentDue",
        )
        .lean(),

      WarehouseOrFactory.find({
        code: {
          $in: warehouseCodes.map(
            (code) =>
              new RegExp(
                `^${escapeRegex(code)}$`,
                "i",
              ),
          ),
        },
      })
        .select(
          "_id code name type status",
        )
        .lean(),

      Product.find({
        sku: {
          $in: productSkus.map(
            (sku) =>
              new RegExp(
                `^${escapeRegex(sku)}$`,
                "i",
              ),
          ),
        },
      })
        .select(
          "_id sku name salePrice taxRate status defaultBonusRule",
        )
        .lean(),
    ]);

    const dealerMap = new Map<
      string,
      (typeof dealers)[number]
    >();

    for (const dealer of dealers) {
      dealerMap.set(
        normalizeCode(dealer.code),
        dealer,
      );
    }

    const warehouseMap = new Map<
      string,
      (typeof warehouses)[number]
    >();

    for (const warehouse of warehouses) {
      warehouseMap.set(
        normalizeCode(
          warehouse.code,
        ),
        warehouse,
      );
    }

    const productMap = new Map<
      string,
      (typeof products)[number]
    >();

    for (const product of products) {
      productMap.set(
        normalizeCode(product.sku),
        product,
      );
    }

    const resolvedRows =
      rows.map(
        (
          row,
        ): ResolvedSalesOrderImportRow => {
          const resolved: ResolvedSalesOrderImportRow =
            {
              rowNumber:
                row.rowNumber,

              importReference:
                row.importReference,

              dealerCode:
                row.dealerCode,

              warehouseCode:
                row.warehouseCode,

              orderDate:
                row.orderDate,

              paymentMethod:
                row.paymentMethod,

              productSku:
                row.productSku,

              qty:
                row.qty,

              /*
               * Preserve the Excel price override
               * through the resolve stage.
               */
              price:
                row.price,

              hasPrice:
                row.hasPrice,

              bonusQtyOverride:
                row.bonusQtyOverride,

              hasBonusQtyOverride:
                row.hasBonusQtyOverride,

              discountPercent:
                row.discountPercent,

              taxPercent:
                row.taxPercent,

              hasDiscountPercent:
                row.hasDiscountPercent,

              hasTaxPercent:
                row.hasTaxPercent,

              notes:
                row.notes,

              errors: [
                ...row.errors,
              ],

              promotionBonusQty: 0,

              finalBonusQty: 0,

              unitPrice: 0,

              grossAmount: 0,

              discountAmount: 0,

              taxableAmount: 0,

              taxAmount: 0,

              lineTotal: 0,
            };

          const dealer =
            dealerMap.get(
              normalizeCode(
                row.dealerCode,
              ),
            );

          if (!dealer) {
            resolved.errors.push(
              `Dealer not found: ${row.dealerCode}`,
            );
          } else {
            const dealerId =
              toObjectId(
                dealer._id,
              );

            if (!dealerId) {
              resolved.errors.push(
                `Dealer ${row.dealerCode} has an invalid database ID`,
              );
            } else {
              resolved.dealerId =
                dealerId;
            }

            resolved.dealerName =
              dealer.name;

            resolved.dealerType =
              dealer.type;

            resolved.dealerStatus =
              dealer.status;

            if (
              dealer.status ===
              "Blocked"
            ) {
              resolved.errors.push(
                `Dealer is blocked: ${dealer.name}`,
              );
            }
          }

          const warehouse =
            warehouseMap.get(
              normalizeCode(
                row.warehouseCode,
              ),
            );

          if (!warehouse) {
            resolved.errors.push(
              `Warehouse not found: ${row.warehouseCode}`,
            );
          } else {
            const warehouseId =
              toObjectId(
                warehouse._id,
              );

            if (!warehouseId) {
              resolved.errors.push(
                `Warehouse ${row.warehouseCode} has an invalid database ID`,
              );
            } else {
              resolved.warehouseId =
                warehouseId;
            }

            resolved.warehouseName =
              warehouse.name;

            resolved.warehouseType =
              warehouse.type;

            resolved.warehouseStatus =
              warehouse.status;

            if (
              warehouse.status !==
              "Active"
            ) {
              resolved.errors.push(
                `Warehouse is not active: ${warehouse.name}`,
              );
            }

            if (
              warehouse.type !==
              "Warehouse"
            ) {
              resolved.errors.push(
                `Selected location is not a warehouse: ${warehouse.name}`,
              );
            }
          }

          const product =
            productMap.get(
              normalizeCode(
                row.productSku,
              ),
            );

          if (!product) {
            resolved.errors.push(
              `Product not found: ${row.productSku}`,
            );
          } else {
            const productId =
              toObjectId(
                product._id,
              );

            if (!productId) {
              resolved.errors.push(
                `Product ${row.productSku} has an invalid database ID`,
              );
            } else {
              resolved.productId =
                productId;
            }

            resolved.productName =
              product.name;

            resolved.productSalePrice =
              Number(
                product.salePrice || 0,
              );

            resolved.productTaxRate =
              Number(
                product.taxRate || 0,
              );

            resolved.productStatus =
              product.status;

            if (
              product.status !==
              "Active"
            ) {
              resolved.errors.push(
                `Product is not active: ${product.name}`,
              );
            }
          }

          return resolved;
        },
      );

    return resolvedRows;
  },

  async calculateBonuses(
    rows: ResolvedSalesOrderImportRow[],
  ): Promise<ResolvedSalesOrderImportRow[]> {
    const eligibleRows =
      rows.filter(
        (row) =>
          row.errors.length === 0 &&
          row.productId &&
          row.qty !== null &&
          row.qty > 0 &&
          row.dealerId &&
          row.warehouseId,
      );

    await Promise.all(
      eligibleRows.map(
        async (row) => {
          if (
            !row.productId ||
            !row.dealerId ||
            !row.warehouseId ||
            row.qty === null
          ) {
            return;
          }

          try {
            const result =
              await promotionService.calculateBonusQty(
                row.productId,
                row.qty,
                row.dealerId,
                row.warehouseId,
              );

            row.promotionBonusQty =
              result.bonusQty || 0;

            row.appliedPromotionId =
              result.appliedPromotionId;

            /*
             * Bonus override semantics:
             *
             * blank = automatic promotion bonus
             * 0     = explicitly disable bonus
             * 5     = force final bonus to 5
             */

            if (
              !row.hasBonusQtyOverride
            ) {
              row.finalBonusQty =
                row.promotionBonusQty;

              return;
            }

            row.finalBonusQty =
              row.bonusQtyOverride || 0;
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Unknown promotion calculation error";

            row.errors.push(
              `Promotion calculation failed: ${message}`,
            );

            row.promotionBonusQty =
              0;

            row.finalBonusQty =
              0;
          }
        },
      ),
    );

    for (const row of rows) {
      if (row.errors.length > 0) {
        row.promotionBonusQty = 0;

        row.finalBonusQty = 0;
      }
    }

    return rows;
  },

  validateDuplicateItems(
    rows: ResolvedSalesOrderImportRow[],
  ): ResolvedSalesOrderImportRow[] {
    const seen =
      new Map<string, number>();

    return rows.map(
      (row) => {
        const resolved: ResolvedSalesOrderImportRow =
          {
            ...row,

            errors: [
              ...row.errors,
            ],
          };

        if (
          !row.importReference ||
          !row.productSku
        ) {
          return resolved;
        }

        const key =
          `${normalizeCode(
            row.importReference,
          )}::${normalizeCode(
            row.productSku,
          )}`;

        const previousRow =
          seen.get(key);

        if (
          previousRow !==
          undefined
        ) {
          resolved.errors.push(
            `Duplicate product SKU ${row.productSku} in Import Reference ${row.importReference}; first appears on Excel row ${previousRow}`,
          );
        } else {
          seen.set(
            key,
            row.rowNumber,
          );
        }

        return resolved;
      },
    );
  },

  calculateTotals(
    rows: ResolvedSalesOrderImportRow[],
  ): ResolvedSalesOrderImportRow[] {
    for (const row of rows) {
      if (
        row.errors.length > 0 ||
        !row.productId ||
        row.qty === null ||
        row.qty <= 0
      ) {
        row.unitPrice = 0;

        row.grossAmount = 0;

        row.discountAmount = 0;

        row.taxableAmount = 0;

        row.taxAmount = 0;

        row.lineTotal = 0;

        continue;
      }

      /*
       * Discount:
       *
       * Excel value present -> use Excel value.
       * Excel blank -> 0%.
       */

      const discountPercent =
        row.hasDiscountPercent
          ? row.discountPercent
          : 0;

      row.discountPercent =
        discountPercent;

      /*
       * Tax:
       *
       * Excel value present -> use Excel value.
       * Excel blank -> use Product.taxRate.
       */

      const taxPercent =
        row.hasTaxPercent
          ? row.taxPercent
          : Number(
              row.productTaxRate || 0,
            );

      row.taxPercent =
        Number.isFinite(
          taxPercent,
        )
          ? taxPercent
          : 0;

      calculateLineAmounts(
        row,
      );
    }

    return rows;
  },

  groupRows(
    rows: ResolvedSalesOrderImportRow[],
  ): SalesOrderImportGroup[] {
    const groupMap =
      new Map<
        string,
        SalesOrderImportGroup
      >();

    for (const row of rows) {
      const key =
        normalizeCode(
          row.importReference,
        );

      let group =
        groupMap.get(key);

      if (!group) {
        group = {
          importReference:
            row.importReference,

          dealerId:
            row.dealerId,

          dealerCode:
            row.dealerCode,

          dealerName:
            row.dealerName,

          warehouseId:
            row.warehouseId,

          warehouseCode:
            row.warehouseCode,

          warehouseName:
            row.warehouseName,

          orderDate:
            row.orderDate,

          paymentMethod:
            row.paymentMethod,

          notes: "",

          items: [],

          totalQty: 0,

          totalBonusQty: 0,

          subtotal: 0,

          discountAmount: 0,

          taxableAmount: 0,

          taxAmount: 0,

          grandTotal: 0,

          errors: [],
        };

        groupMap.set(
          key,
          group,
        );
      }

      group.items.push(row);

      /*
       * A single Import Reference represents one order.
       * Therefore all rows inside the group must point to
       * the same dealer, warehouse, date and payment method.
       */

      if (
        group.dealerId &&
        row.dealerId &&
        !group.dealerId.equals(
          row.dealerId,
        )
      ) {
        group.errors.push(
          `Import Reference ${group.importReference} contains multiple dealers: ${group.dealerCode} and ${row.dealerCode} (Excel row ${row.rowNumber})`,
        );
      }

      if (
        group.warehouseId &&
        row.warehouseId &&
        !group.warehouseId.equals(
          row.warehouseId,
        )
      ) {
        group.errors.push(
          `Import Reference ${group.importReference} contains multiple warehouses: ${group.warehouseCode} and ${row.warehouseCode} (Excel row ${row.rowNumber})`,
        );
      }

      if (
        group.paymentMethod &&
        row.paymentMethod &&
        group.paymentMethod !==
          row.paymentMethod
      ) {
        group.errors.push(
          `Import Reference ${group.importReference} contains multiple payment methods on Excel row ${row.rowNumber}`,
        );
      }

      if (
        group.orderDate &&
        row.orderDate
      ) {
        const groupDate =
          group.orderDate
            .toISOString()
            .slice(0, 10);

        const rowDate =
          row.orderDate
            .toISOString()
            .slice(0, 10);

        if (
          groupDate !==
          rowDate
        ) {
          group.errors.push(
            `Import Reference ${group.importReference} contains multiple order dates on Excel row ${row.rowNumber}`,
          );
        }
      }

      if (
        row.notes &&
        row.notes !==
          group.notes
      ) {
        group.notes =
          group.notes
            ? `${group.notes}; ${row.notes}`
            : row.notes;
      }

      group.totalQty +=
        row.qty || 0;

      group.totalBonusQty +=
        row.finalBonusQty || 0;

      group.subtotal =
        roundMoney(
          group.subtotal +
            row.grossAmount,
        );

      group.discountAmount =
        roundMoney(
          group.discountAmount +
            row.discountAmount,
        );

      group.taxableAmount =
        roundMoney(
          group.taxableAmount +
            row.taxableAmount,
        );

      group.taxAmount =
        roundMoney(
          group.taxAmount +
            row.taxAmount,
        );

      group.grandTotal =
        roundMoney(
          group.grandTotal +
            row.lineTotal,
        );
    }

    /*
     * Add row-level errors into the corresponding order.
     */

    for (const group of groupMap.values()) {
      for (const item of group.items) {
        for (const error of item.errors) {
          group.errors.push(
            `Excel row ${item.rowNumber}: ${error}`,
          );
        }
      }

      /*
       * Remove duplicated messages while preserving order.
       */

      group.errors = [
        ...new Set(
          group.errors,
        ),
      ];
    }

    return [
      ...groupMap.values(),
    ];
  },

  buildOrderPayloads(
    groups: SalesOrderImportGroup[],
    createdBy: Types.ObjectId,
  ): SalesOrderImportOrderPayload[] {
    const payloads: SalesOrderImportOrderPayload[] =
      [];

    for (const group of groups) {
      if (
        group.errors.length > 0 ||
        !group.dealerId ||
        !group.warehouseId ||
        !group.orderDate ||
        !group.paymentMethod
      ) {
        continue;
      }

      const validItems =
        group.items.filter(
          (item) =>
            item.errors.length === 0 &&
            item.productId &&
            item.qty !== null &&
            item.qty > 0,
        );

      if (
        validItems.length === 0
      ) {
        continue;
      }

      const items =
        validItems.map(
          (
            item,
          ): SalesOrderImportItemPayload => ({
            productId:
              item.productId!,

            warehouseId:
              group.warehouseId!,

            qty:
              item.qty!,

            bonusQty:
              item.finalBonusQty,

            /*
             * This is already the final effective price:
             *
             * Excel Price if provided,
             * otherwise Product.salePrice.
             */
            unitPrice:
              item.unitPrice,

            discountPercent:
              item.discountPercent,

            discountAmount:
              item.discountAmount,

            taxPercent:
              item.taxPercent,

            taxAmount:
              item.taxAmount,

            lineSubtotal:
              item.grossAmount,

            lineTotal:
              item.lineTotal,

            productSku:
              item.productSku,

            productName:
              item.productName ||
              "",
          }),
        );

      payloads.push({
        importReference:
          group.importReference,

        customerId:
          group.dealerId,

        warehouseId:
          group.warehouseId,

        orderDate:
          group.orderDate,

        paymentMethod:
          group.paymentMethod,

        items,

        subTotal:
          group.subtotal,

        totalDiscount:
          group.discountAmount,

        totalTax:
          group.taxAmount,

        grandTotal:
          group.grandTotal,

        totalBonusQty:
          items.reduce(
            (sum, item) =>
              sum +
              item.bonusQty,
            0,
          ),

        createdBy,

        ...(group.notes
          ? {
              notes:
                group.notes,
            }
          : {}),
      });
    }

    return payloads;
  },

  async preview(
    buffer: Buffer,
  ): Promise<SalesOrderImportPreview> {
    const parsed =
      this.parseRows(buffer);

    if (
      parsed.errors.length > 0
    ) {
      return {
        rows: [],

        groups: [],

        totalRows: 0,

        validRows: 0,

        invalidRows: 0,

        totalOrders: 0,

        validOrders: 0,

        invalidOrders: 0,

        totalQty: 0,

        totalBonusQty: 0,

        subtotal: 0,

        discountAmount: 0,

        taxAmount: 0,

        grandTotal: 0,

        errors:
          parsed.errors,
      };
    }

    let rows =
      await this.resolveRows(
        parsed.rows,
      );

    rows =
      await this.calculateBonuses(
        rows,
      );

    rows =
      this.validateDuplicateItems(
        rows,
      );

    rows =
      this.calculateTotals(
        rows,
      );

    const groups =
      this.groupRows(rows);

    const validRows =
      rows.filter(
        (row) =>
          row.errors.length === 0,
      );

    const invalidRows =
      rows.filter(
        (row) =>
          row.errors.length > 0,
      );

    const validOrders =
      groups.filter(
        (group) =>
          group.errors.length === 0 &&
          group.items.some(
            (item) =>
              item.errors.length ===
              0,
          ),
      );

    const invalidOrders =
      groups.filter(
        (group) =>
          group.errors.length > 0,
      );

    let totalQty = 0;

    let totalBonusQty = 0;

    let subtotal = 0;

    let discountAmount = 0;

    let taxAmount = 0;

    let grandTotal = 0;

    for (const row of rows) {
      if (
        row.errors.length > 0
      ) {
        continue;
      }

      totalQty +=
        row.qty || 0;

      totalBonusQty +=
        row.finalBonusQty || 0;

      subtotal =
        roundMoney(
          subtotal +
            row.grossAmount,
        );

      discountAmount =
        roundMoney(
          discountAmount +
            row.discountAmount,
        );

      taxAmount =
        roundMoney(
          taxAmount +
            row.taxAmount,
        );

      grandTotal =
        roundMoney(
          grandTotal +
            row.lineTotal,
        );
    }

    const previewErrors = [
      ...new Set(
        groups.flatMap(
          (group) =>
            group.errors,
        ),
      ),
    ];

    return {
      rows,

      groups,

      totalRows:
        rows.length,

      validRows:
        validRows.length,

      invalidRows:
        invalidRows.length,

      totalOrders:
        groups.length,

      validOrders:
        validOrders.length,

      invalidOrders:
        invalidOrders.length,

      totalQty,

      totalBonusQty,

      subtotal,

      discountAmount,

      taxAmount,

      grandTotal,

      errors:
        previewErrors,
    };
  },
};

export default salesOrderImportService;