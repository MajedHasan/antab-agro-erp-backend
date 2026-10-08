// src/services/dealer-import.service.ts

import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import * as XLSX from "xlsx";

import Dealer from "../../models/dealer.model";
import Zone from "../../models/zone.model";
import Region from "../../models/region.model";
import Area from "../../models/area.model";
import Territory from "../../models/territory.model";
import WarehouseOrFactory from "../../models/warehouseOrFactory.model";
import User from "../../models/user.model";
import Media from "../../models/media.model";

import { dealerService } from "../../services/dealer.service";

/* =========================================================
   TYPES
========================================================= */

type DealerImportStatus =
  | "Pending"
  | "Active"
  | "Inactive"
  | "Blocked";

type DealerImportType = "CASH" | "CREDIT";

type DealerImportRow = {
  "Dealer Name": string;
  Proprietor: string;
  Zone: string;
  Region: string;
  Area: string;
  Territory: string;
  Type: string;
  "Phone Number": string;
  Warehouse: string;
  "Assigned Sales Manager": string;

  "Credit Limit"?: string | number;
  "Opening Balance"?: string | number;
  Email?: string;
  Address?: string;
  "Op. Date"?: string;
  "Op. Month"?: string;
  "Last Purchase Date"?: string;
  Status?: string;
  Notes?: string;
};

/**
 * Internal resolved row.
 *
 * This is the structure used during confirmation.
 * Relationship fields remain ObjectIds here.
 */
type ResolvedDealerRow = {
  rowNumber: number;

  name: string;
  proprietor: string;

  zone: mongoose.Types.ObjectId;
  region: mongoose.Types.ObjectId;
  area: mongoose.Types.ObjectId;
  territory: mongoose.Types.ObjectId;

  type: DealerImportType;

  phoneNumber: string;

  warehouse: mongoose.Types.ObjectId;
  assignedSalesManager: mongoose.Types.ObjectId;

  creditLimit: number;
  openingBalance: number;

  email?: string;
  address?: string;
  opDate?: string;
  opMonth?: string;
  lastPurchaseDate?: Date;

  status: DealerImportStatus;

  notes?: string;
};

/**
 * Relationship shown in the preview response.
 *
 * The frontend can display the name while the ID remains
 * available if it needs it.
 */
type PreviewReference = {
  id: string;
  name: string;
};

/**
 * Data returned inside preview.rows[].data.
 *
 * Unlike ResolvedDealerRow, relationship fields contain both
 * the resolved ID and human-readable name.
 */
type PreviewDealerData = {
  rowNumber: number;

  name: string;
  proprietor: string;

  zone: PreviewReference;
  region: PreviewReference;
  area: PreviewReference;
  territory: PreviewReference;

  type: DealerImportType;

  phoneNumber: string;

  warehouse: PreviewReference;
  assignedSalesManager: PreviewReference;

  creditLimit: number;
  openingBalance: number;

  email?: string;
  address?: string;
  opDate?: string;
  opMonth?: string;
  lastPurchaseDate?: Date;

  status: DealerImportStatus;

  notes?: string;
};

type PreviewRow = {
  rowNumber: number;
  name: string;
  phoneNumber: string;
  valid: boolean;
  errors: string[];

  /**
   * Human-readable preview data.
   */
  data?: PreviewDealerData;
};

type DealerImportPreview = {
  totalRows: number;
  validRows: number;
  invalidRows: number;

  rows: PreviewRow[];

  /**
   * Internal data used by confirmDealerImport().
   * Relationship fields are ObjectIds.
   */
  resolvedRows: ResolvedDealerRow[];
};

type ConfirmResult = {
  totalRows: number;
  createdCount: number;
  failedCount: number;

  created: Array<{
    rowNumber: number;
    id: string;
    code?: string;
    name: string;
  }>;

  failed: Array<{
    rowNumber: number;
    name: string;
    errors: string[];
  }>;
};

type NamedDocument = {
  _id: mongoose.Types.ObjectId;
  name?: string;
};

/* =========================================================
   EXCEL COLUMNS
========================================================= */

const REQUIRED_COLUMNS = [
  "Dealer Name",
  "Proprietor",
  "Zone",
  "Region",
  "Area",
  "Territory",
  "Type",
  "Phone Number",
  "Warehouse",
  "Assigned Sales Manager",
] as const;

const OPTIONAL_COLUMNS = [
  "Credit Limit",
  "Opening Balance",
  "Email",
  "Address",
  "Op. Date",
  "Op. Month",
  "Last Purchase Date",
  "Status",
  "Notes",
] as const;

const ALL_COLUMNS = [
  ...REQUIRED_COLUMNS,
  ...OPTIONAL_COLUMNS,
] as const;

/* =========================================================
   DEMO TEMPLATE DATA
========================================================= */

const DEMO_DEALER: DealerImportRow = {
  "Dealer Name": "ABC Agro Traders",
  Proprietor: "Mr. Rahim",

  Zone: "Dhaka",
  Region: "Dhaka North",
  Area: "Mirpur",
  Territory: "Mirpur-1",

  Type: "CREDIT",
  "Phone Number": "01712345678",

  Warehouse: "Main Warehouse",
  "Assigned Sales Manager": "John Doe",

  "Credit Limit": 100000,
  "Opening Balance": 25000,

  Email: "dealer@example.com",
  Address: "Mirpur, Dhaka",

  "Op. Date": "2026-10-01",
  "Op. Month": "October 2026",
  "Last Purchase Date": "2026-10-05",

  Status: "Active",
  Notes: "Sample dealer",
};

/* =========================================================
   HELPERS
========================================================= */

function cleanString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function normalizeKey(value: unknown): string {
  return cleanString(value)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseNumber(
  value: unknown,
  fallback = 0,
): number {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return fallback;
  }

  const parsed = Number(
    String(value)
      .replace(/,/g, "")
      .trim(),
  );

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function parseDate(
  value: unknown,
): Date | undefined {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return undefined;
  }

  if (
    value instanceof Date &&
    !Number.isNaN(value.getTime())
  ) {
    return value;
  }

  /**
   * Excel serial date.
   */
  if (typeof value === "number") {
    const parsed =
      XLSX.SSF.parse_date_code(value);

    if (parsed) {
      return new Date(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.H || 0,
        parsed.M || 0,
        parsed.S || 0,
      );
    }
  }

  const stringValue = String(value).trim();

  const date = new Date(stringValue);

  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  return undefined;
}

function escapeRegex(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

function normalizeType(
  value: unknown,
): DealerImportType | null {
  const normalized =
    cleanString(value).toUpperCase();

  if (normalized === "CASH") {
    return "CASH";
  }

  if (normalized === "CREDIT") {
    return "CREDIT";
  }

  return null;
}

function normalizeStatus(
  value: unknown,
): DealerImportStatus {
  const normalized =
    cleanString(value).toLowerCase();

  if (!normalized) {
    return "Pending";
  }

  const statuses: Record<
    string,
    DealerImportStatus
  > = {
    pending: "Pending",
    active: "Active",
    inactive: "Inactive",
    blocked: "Blocked",
  };

  return (
    statuses[normalized] ||
    "Pending"
  );
}

function getMissingRequiredColumns(
  headers: string[],
): string[] {
  const normalizedHeaders =
    new Set(
      headers.map((header) =>
        normalizeKey(header),
      ),
    );

  return REQUIRED_COLUMNS.filter(
    (column) =>
      !normalizedHeaders.has(
        normalizeKey(column),
      ),
  );
}

function normalizeExcelRow(
  row: Record<string, unknown>,
): DealerImportRow {
  const result: Record<
    string,
    unknown
  > = {};

  for (const column of ALL_COLUMNS) {
    result[column] = row[column];
  }

  return result as DealerImportRow;
}

/* =========================================================
   MODEL HELPERS
========================================================= */

/**
 * Find a document by exact name, case-insensitive.
 */
async function findByName<
  T extends NamedDocument,
>(
  Model: mongoose.Model<T>,
  name: string,
): Promise<T | null> {
  const cleanName = cleanString(name);

  if (!cleanName) {
    return null;
  }

  return Model.findOne({
    name: {
      $regex: `^${escapeRegex(cleanName)}$`,
      $options: "i",
    },
  }).exec();
}

/**
 * Convert a mongoose document into the small reference
 * object returned by the preview API.
 */
function toPreviewReference(
  document: NamedDocument,
): PreviewReference {
  return {
    id: String(document._id),
    name: cleanString(document.name),
  };
}

/**
 * Find a user by unique name.
 */
async function findUniqueUserByName(
  name: string,
) {
  const cleanName = cleanString(name);

  if (!cleanName) {
    return {
      user: null,
      error:
        "Assigned Sales Manager is required",
    };
  }

  const users = await User.find({
    name: {
      $regex: `^${escapeRegex(cleanName)}$`,
      $options: "i",
    },
  })
    .select("_id name")
    .limit(2)
    .lean()
    .exec();

  if (!users.length) {
    return {
      user: null,
      error: `Assigned Sales Manager "${cleanName}" was not found`,
    };
  }

  if (users.length > 1) {
    return {
      user: null,
      error: `Multiple users found with the name "${cleanName}". Assigned Sales Manager must be unique`,
    };
  }

  return {
    user: users[0],
    error: null,
  };
}

/* =========================================================
   DEMO MEDIA
========================================================= */

const DEMO_ATTACHMENT_LABELS: Record<
  string,
  string
> = {
  bankCheque: "Demo Bank Cheque",
  tradeLicense: "Demo Trade License",
  nidCard: "Demo NID Card",
  informationDeed: "Demo Information Deed",
  pesticideLicense:
    "Demo Pesticide License",
};

function createDemoSvg(
  dealerName: string,
  label: string,
): string {
  const safeDealerName =
    dealerName
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const safeLabel =
    label
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1200"
  height="800"
  viewBox="0 0 1200 800"
>
  <rect
    width="1200"
    height="800"
    fill="#f3f4f6"
  />

  <rect
    x="40"
    y="40"
    width="1120"
    height="720"
    rx="24"
    fill="#ffffff"
    stroke="#d1d5db"
    stroke-width="4"
  />

  <text
    x="600"
    y="250"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="52"
    font-weight="700"
    fill="#111827"
  >
    DEMO ATTACHMENT
  </text>

  <text
    x="600"
    y="340"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="42"
    font-weight="600"
    fill="#374151"
  >
    ${safeLabel}
  </text>

  <text
    x="600"
    y="440"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="32"
    fill="#6b7280"
  >
    Dealer: ${safeDealerName}
  </text>

  <text
    x="600"
    y="540"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="28"
    fill="#9ca3af"
  >
    Replace this document with the real dealer document.
  </text>

  <text
    x="600"
    y="600"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="24"
    fill="#9ca3af"
  >
    Created automatically by Dealer Bulk Import
  </text>
</svg>
`.trim();
}

async function createDemoMedia(
  dealerName: string,
  folder: string,
): Promise<mongoose.Types.ObjectId> {
  const label =
    DEMO_ATTACHMENT_LABELS[folder] ||
    "Demo Dealer Attachment";

  const timestamp = Date.now();
  const random =
    Math.floor(Math.random() * 900000) +
    100000;

  const fileName =
    `demo-${folder}-${timestamp}-${random}.svg`;

  const year =
    new Date().getFullYear();

  const relativeFolder =
    path.join(
      "uploads",
      "dealers",
      folder,
      String(year),
    );

  const absoluteFolder =
    path.join(
      process.cwd(),
      relativeFolder,
    );

  await fs.mkdir(
    absoluteFolder,
    {
      recursive: true,
    },
  );

  const absoluteFilePath =
    path.join(
      absoluteFolder,
      fileName,
    );

  const svg = createDemoSvg(
    dealerName,
    label,
  );

  await fs.writeFile(
    absoluteFilePath,
    svg,
    "utf8",
  );

  const url =
    "/" +
    path
      .join(
        "uploads",
        "dealers",
        folder,
        String(year),
        fileName,
      )
      .replace(/\\/g, "/");

  const media = await Media.create({
    originalName: `${label}.svg`,
    fileName,
    mimeType: "image/svg+xml",
    fileType: "image",
    size: Buffer.byteLength(
      svg,
      "utf8",
    ),
    module: "dealers",
    folder,
    url,
  });

  return media._id;
}

async function createDealerDemoAttachments(
  dealerName: string,
) {
  const folders = [
    "bankCheque",
    "tradeLicense",
    "nidCard",
    "informationDeed",
    "pesticideLicense",
  ];

  const createdMediaIds: mongoose.Types.ObjectId[] =
    [];

  try {
    const [
      bankCheque,
      tradeLicense,
      nidCard,
      informationDeed,
      pesticideLicense,
    ] = await Promise.all(
      folders.map((folder) =>
        createDemoMedia(
          dealerName,
          folder,
        ),
      ),
    );

    createdMediaIds.push(
      bankCheque,
      tradeLicense,
      nidCard,
      informationDeed,
      pesticideLicense,
    );

    return {
      attachments: {
        required: {
          bankCheque,
          tradeLicense,
          nidCard,
          informationDeed,
          pesticideLicense,
        },

        optional: {
          agreements: [],
          others: [],
        },
      },

      mediaIds: createdMediaIds,
    };
  } catch (error) {
    if (createdMediaIds.length) {
      await Media.deleteMany({
        _id: {
          $in: createdMediaIds,
        },
      }).catch(() => undefined);
    }

    throw error;
  }
}

/* =========================================================
   HIERARCHY RESOLUTION
========================================================= */

async function resolveHierarchy(
  row: DealerImportRow,
  errors: string[],
) {
  const zoneName =
    cleanString(row.Zone);

  const regionName =
    cleanString(row.Region);

  const areaName =
    cleanString(row.Area);

  const territoryName =
    cleanString(row.Territory);

  const zone =
    await findByName(
      Zone,
      zoneName,
    );

  if (!zone) {
    errors.push(
      `Zone "${zoneName}" was not found`,
    );
  }

  let region: Awaited<
    ReturnType<typeof Region.findOne>
  > | null = null;

  let area: Awaited<
    ReturnType<typeof Area.findOne>
  > | null = null;

  let territory: Awaited<
    ReturnType<typeof Territory.findOne>
  > | null = null;

  if (zone) {
    region =
      await Region.findOne({
        name: {
          $regex: `^${escapeRegex(regionName)}$`,
          $options: "i",
        },

        zone: zone._id,
      }).exec();

    if (!region) {
      errors.push(
        `Region "${regionName}" was not found under Zone "${zoneName}"`,
      );
    }
  }

  if (region) {
    area =
      await Area.findOne({
        name: {
          $regex: `^${escapeRegex(areaName)}$`,
          $options: "i",
        },

        region: region._id,
      }).exec();

    if (!area) {
      errors.push(
        `Area "${areaName}" was not found under Region "${regionName}"`,
      );
    }
  }

  if (area) {
    territory =
      await Territory.findOne({
        name: {
          $regex: `^${escapeRegex(territoryName)}$`,
          $options: "i",
        },

        area: area._id,
      }).exec();

    if (!territory) {
      errors.push(
        `Territory "${territoryName}" was not found under Area "${areaName}"`,
      );
    }
  }

  return {
    zone,
    region,
    area,
    territory,
  };
}

/* =========================================================
   PREVIEW
========================================================= */

export async function previewDealerImport(
  buffer: Buffer,
): Promise<DealerImportPreview> {
  const workbook = XLSX.read(
    buffer,
    {
      type: "buffer",
      cellDates: true,
    },
  );

  if (!workbook.SheetNames.length) {
    throw new Error(
      "Excel workbook does not contain any sheets",
    );
  }

  const worksheet =
    workbook.Sheets[
      workbook.SheetNames[0]
    ];

  const rawRows =
    XLSX.utils.sheet_to_json<
      Record<string, unknown>
    >(worksheet, {
      defval: "",
      raw: true,
    });

  const headerRows =
    XLSX.utils.sheet_to_json<
      unknown[]
    >(worksheet, {
      header: 1,
      defval: "",
      raw: true,
    });

  const firstRow =
    headerRows[0] || [];

  const headers =
    firstRow
      .map((value) =>
        cleanString(value),
      )
      .filter(Boolean);

  const missingColumns =
    getMissingRequiredColumns(
      headers,
    );

  if (missingColumns.length) {
    throw new Error(
      `Missing required Excel columns: ${missingColumns.join(", ")}`,
    );
  }

  if (!rawRows.length) {
    throw new Error(
      "Excel file does not contain any dealer data",
    );
  }

  const rows: PreviewRow[] = [];

  const resolvedRows: ResolvedDealerRow[] =
    [];

  const seenPhones =
    new Set<string>();

  for (
    let index = 0;
    index < rawRows.length;
    index++
  ) {
    const excelRowNumber =
      index + 2;

    const row =
      normalizeExcelRow(
        rawRows[index],
      );

    const errors: string[] = [];

    const name =
      cleanString(
        row["Dealer Name"],
      );

    const proprietor =
      cleanString(
        row.Proprietor,
      );

    const phoneNumber =
      cleanString(
        row["Phone Number"],
      );

    const warehouseName =
      cleanString(
        row.Warehouse,
      );

    const salesManagerName =
      cleanString(
        row["Assigned Sales Manager"],
      );

    const type =
      normalizeType(row.Type);

    /* -----------------------------------------
       Required basic values
    ----------------------------------------- */

    if (!name) {
      errors.push(
        "Dealer Name is required",
      );
    }

    if (!proprietor) {
      errors.push(
        "Proprietor is required",
      );
    }

    if (!phoneNumber) {
      errors.push(
        "Phone Number is required",
      );
    }

    if (!warehouseName) {
      errors.push(
        "Warehouse is required",
      );
    }

    if (!salesManagerName) {
      errors.push(
        "Assigned Sales Manager is required",
      );
    }

    if (!type) {
      errors.push(
        `Invalid Type "${cleanString(
          row.Type,
        )}". Expected CASH or CREDIT`,
      );
    }

    /* -----------------------------------------
       Phone duplicate checks
    ----------------------------------------- */

    const normalizedPhone =
      phoneNumber.replace(
        /\s+/g,
        "",
      );

    if (
      normalizedPhone &&
      seenPhones.has(
        normalizedPhone,
      )
    ) {
      errors.push(
        `Duplicate Phone Number "${phoneNumber}" exists in this import file`,
      );
    }

    if (normalizedPhone) {
      seenPhones.add(
        normalizedPhone,
      );
    }

    if (normalizedPhone) {
      const existingDealer =
        await Dealer.findOne({
          phoneNumber:
            normalizedPhone,
        })
          .select("_id name")
          .lean()
          .exec();

      if (existingDealer) {
        errors.push(
          `Phone Number "${normalizedPhone}" already belongs to Dealer "${existingDealer.name}"`,
        );
      }
    }

    /* -----------------------------------------
       Hierarchy
    ----------------------------------------- */

    const hierarchy =
      await resolveHierarchy(
        row,
        errors,
      );

    /* -----------------------------------------
       Warehouse
    ----------------------------------------- */

    let warehouse:
      | Awaited<
          ReturnType<
            typeof WarehouseOrFactory.findOne
          >
        >
      | null = null;

    if (warehouseName) {
      warehouse =
        await findByName(
          WarehouseOrFactory,
          warehouseName,
        );

      if (!warehouse) {
        errors.push(
          `Warehouse "${warehouseName}" was not found`,
        );
      }
    }

    /* -----------------------------------------
       Sales manager
    ----------------------------------------- */

    let assignedSalesManager:
      | {
          _id: mongoose.Types.ObjectId;
          name?: string;
        }
      | null = null;

    if (salesManagerName) {
      const managerResult =
        await findUniqueUserByName(
          salesManagerName,
        );

      assignedSalesManager =
        managerResult.user;

      if (managerResult.error) {
        errors.push(
          managerResult.error,
        );
      }
    }

    /* -----------------------------------------
       Financial values
    ----------------------------------------- */

    const creditLimit =
      parseNumber(
        row["Credit Limit"],
        0,
      );

    const openingBalance =
      parseNumber(
        row["Opening Balance"],
        0,
      );

    if (
      type === "CREDIT" &&
      creditLimit <= 0
    ) {
      errors.push(
        "Credit Limit must be greater than 0 for CREDIT dealers",
      );
    }

    /* -----------------------------------------
       Dates
    ----------------------------------------- */

    const lastPurchaseDate =
      parseDate(
        row["Last Purchase Date"],
      );

    const lastPurchaseDateValue =
      cleanString(
        row["Last Purchase Date"],
      );

    if (
      lastPurchaseDateValue &&
      !lastPurchaseDate
    ) {
      errors.push(
        `Invalid Last Purchase Date "${lastPurchaseDateValue}"`,
      );
    }

    /* -----------------------------------------
       Status
    ----------------------------------------- */

    const statusValue =
      cleanString(row.Status);

    const allowedStatuses = [
      "pending",
      "active",
      "inactive",
      "blocked",
    ];

    if (
      statusValue &&
      !allowedStatuses.includes(
        statusValue.toLowerCase(),
      )
    ) {
      errors.push(
        `Invalid Status "${statusValue}". Expected Pending, Active, Inactive, or Blocked`,
      );
    }

    const status =
      normalizeStatus(
        row.Status,
      );

    /* -----------------------------------------
       Valid row
    ----------------------------------------- */

    const isValid =
      errors.length === 0 &&
      !!hierarchy.zone &&
      !!hierarchy.region &&
      !!hierarchy.area &&
      !!hierarchy.territory &&
      !!warehouse &&
      !!assignedSalesManager &&
      !!type;

    const previewRow: PreviewRow = {
      rowNumber:
        excelRowNumber,

      name,

      phoneNumber,

      valid: isValid,

      errors,
    };

    if (isValid) {
      /**
       * ---------------------------------------------------
       * INTERNAL RESOLVED ROW
       * ---------------------------------------------------
       *
       * This is used later by confirmDealerImport().
       *
       * Relationship fields remain ObjectIds.
       */
      const resolvedRow: ResolvedDealerRow = {
        rowNumber:
          excelRowNumber,

        name,
        proprietor,

        zone:
          hierarchy.zone!._id,

        region:
          hierarchy.region!._id,

        area:
          hierarchy.area!._id,

        territory:
          hierarchy.territory!._id,

        type: type!,

        phoneNumber:
          normalizedPhone,

        warehouse:
          warehouse!._id,

        assignedSalesManager:
          assignedSalesManager!._id,

        creditLimit,

        openingBalance,

        email:
          cleanString(
            row.Email,
          ) || undefined,

        address:
          cleanString(
            row.Address,
          ) || undefined,

        opDate:
          cleanString(
            row["Op. Date"],
          ) || undefined,

        opMonth:
          cleanString(
            row["Op. Month"],
          ) || undefined,

        lastPurchaseDate,

        status,

        notes:
          cleanString(
            row.Notes,
          ) || undefined,
      };

      /**
       * ---------------------------------------------------
       * FRONTEND PREVIEW DATA
       * ---------------------------------------------------
       *
       * This is the important fix.
       *
       * Instead of:
       *
       * zone: "6aa83..."
       *
       * we return:
       *
       * zone: {
       *   id: "6aa83...",
       *   name: "Dhaka"
       * }
       */
      const previewData: PreviewDealerData = {
        rowNumber:
          excelRowNumber,

        name,

        proprietor,

        zone:
          toPreviewReference(
            hierarchy.zone,
          ),

        region:
          toPreviewReference(
            hierarchy.region,
          ),

        area:
          toPreviewReference(
            hierarchy.area,
          ),

        territory:
          toPreviewReference(
            hierarchy.territory,
          ),

        type: type!,

        phoneNumber:
          normalizedPhone,

        warehouse:
          toPreviewReference(
            warehouse!,
          ),

        assignedSalesManager: {
          id: String(
            assignedSalesManager!._id,
          ),
          name: cleanString(
            assignedSalesManager!.name,
          ),
        },

        creditLimit,

        openingBalance,

        email:
          cleanString(
            row.Email,
          ) || undefined,

        address:
          cleanString(
            row.Address,
          ) || undefined,

        opDate:
          cleanString(
            row["Op. Date"],
          ) || undefined,

        opMonth:
          cleanString(
            row["Op. Month"],
          ) || undefined,

        lastPurchaseDate,

        status,

        notes:
          cleanString(
            row.Notes,
          ) || undefined,
      };

      previewRow.data =
        previewData;

      resolvedRows.push(
        resolvedRow,
      );
    }

    rows.push(previewRow);
  }

  return {
    totalRows:
      rows.length,

    validRows:
      rows.filter(
        (row) => row.valid,
      ).length,

    invalidRows:
      rows.filter(
        (row) => !row.valid,
      ).length,

    rows,

    resolvedRows,
  };
}

/* =========================================================
   CONFIRM IMPORT
========================================================= */

export async function confirmDealerImport(
  rows: ResolvedDealerRow[],
): Promise<ConfirmResult> {
  const result: ConfirmResult = {
    totalRows:
      rows.length,

    createdCount: 0,

    failedCount: 0,

    created: [],

    failed: [],
  };

  for (const row of rows) {
    let createdMediaIds: mongoose.Types.ObjectId[] =
      [];

    try {
      /**
       * Create the five required demo attachments.
       *
       * Dealer schema requires all five documents.
       */
      const demoAttachments =
        await createDealerDemoAttachments(
          row.name,
        );

      createdMediaIds =
        demoAttachments.mediaIds;

      const dealerPayload = {
        name: row.name,

        proprietor:
          row.proprietor,

        zone:
          row.zone,

        region:
          row.region,

        area:
          row.area,

        territory:
          row.territory,

        type:
          row.type,

        creditLimit:
          row.creditLimit,

        openingBalance:
          row.openingBalance,

        phoneNumber:
          row.phoneNumber,

        email:
          row.email,

        address:
          row.address,

        opDate:
          row.opDate,

        opMonth:
          row.opMonth,

        warehouse:
          row.warehouse,

        status:
          row.status,

        notes:
          row.notes,

        lastPurchaseDate:
          row.lastPurchaseDate,

        assignedSalesManager:
          row.assignedSalesManager,

        attachments:
          demoAttachments.attachments,
      };

      /**
       * Use the existing dealer service lifecycle.
       */
      const dealer =
        await dealerService.create(
          dealerPayload,
        );

      result.createdCount += 1;

      result.created.push({
        rowNumber:
          row.rowNumber,

        id:
          String(dealer._id),

        code:
          dealer.code,

        name:
          dealer.name,
      });
    } catch (error: unknown) {
      /**
       * If Dealer creation fails, remove the demo Media
       * documents created specifically for this dealer.
       */
      if (createdMediaIds.length) {
        await Media.deleteMany({
          _id: {
            $in: createdMediaIds,
          },
        }).catch(() => undefined);
      }

      result.failedCount += 1;

      const message =
        error instanceof Error
          ? error.message
          : "Failed to create dealer";

      result.failed.push({
        rowNumber:
          row.rowNumber,

        name:
          row.name ||
          `Row ${row.rowNumber}`,

        errors: [message],
      });
    }
  }

  return result;
}

/* =========================================================
   EXCEL TEMPLATE
========================================================= */

export function createDealerImportTemplate(): Buffer {
  /**
   * Generate the demo row from the same ordered
   * ALL_COLUMNS definition used by the worksheet.
   */
  const demoRow =
    ALL_COLUMNS.map(
      (column) =>
        DEMO_DEALER[column] ?? "",
    );

  const instructions = [
    ["Dealer Bulk Import Template"],

    [""],

    ["Instructions"],

    [
      "1. Do not rename or remove the required columns.",
    ],

    [
      "2. Zone, Region, Area, Territory, Warehouse and Assigned Sales Manager must already exist in the system.",
    ],

    [
      "3. Region must belong to the selected Zone.",
    ],

    [
      "4. Area must belong to the selected Region.",
    ],

    [
      "5. Territory must belong to the selected Area.",
    ],

    [
      "6. Type must be CASH or CREDIT.",
    ],

    [
      "7. CREDIT dealers must have a Credit Limit greater than 0.",
    ],

    [
      "8. Phone Number must be unique.",
    ],

    [
      "9. Status can be Pending, Active, Inactive or Blocked.",
    ],

    [
      "10. The bulk importer automatically creates DEMO attachments for the five required Dealer documents.",
    ],

    [
      "11. Replace the demo attachments later with the real dealer documents from the Dealer page.",
    ],

    [
      "12. Do not add Dealer Code. Dealer Code is generated automatically.",
    ],

    [""],

    ["Required Columns"],

    [
      REQUIRED_COLUMNS.join(
        " | ",
      ),
    ],

    [""],

    ["Optional Columns"],

    [
      OPTIONAL_COLUMNS.join(
        " | ",
      ),
    ],
  ];

  const dataSheet =
    XLSX.utils.aoa_to_sheet([
      ALL_COLUMNS,
      demoRow,
    ]);

  const instructionSheet =
    XLSX.utils.aoa_to_sheet(
      instructions,
    );

  dataSheet["!cols"] =
    ALL_COLUMNS.map(
      (column) => {
        const maxLength =
          Math.max(
            column.length,

            cleanString(
              DEMO_DEALER[column],
            ).length,

            18,
          );

        return {
          wch: Math.min(
            Math.max(
              maxLength + 2,
              18,
            ),
            32,
          ),
        };
      },
    );

  instructionSheet["!cols"] =
    [
      {
        wch: 110,
      },
    ];

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    dataSheet,
    "Dealers",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    instructionSheet,
    "Instructions",
  );

  return XLSX.write(
    workbook,
    {
      type: "buffer",
      bookType: "xlsx",
    },
  );
}