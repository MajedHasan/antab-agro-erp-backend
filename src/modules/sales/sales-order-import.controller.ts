// src/controllers/sales-order-import.controller.ts

import { Request, Response } from "express";
import * as XLSX from "xlsx";

import {
  salesOrderImportService,
} from "./sales-order-import.service";

import {
  salesOrderService,
} from "../../services/sales-order.service";
import { Types } from "mongoose";

/* =====================================================
   Types
===================================================== */

interface CreatedSalesOrder {
  _id: unknown;
  orderNo: unknown;
}

interface ImportResult {
  importReference: string;
  success: boolean;
  orderId?: string;
  orderNo?: string;
  error?: string;
}

/* =====================================================
   Helpers
===================================================== */

function getUploadedFile(
  req: Request,
): Express.Multer.File {
  const file = req.file;

  if (!file?.buffer) {
    throw new Error("Excel file is required");
  }

  return file;
}

function isExcelFile(
  file: Express.Multer.File,
): boolean {
  const allowedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/octet-stream",
  ];

  const allowedExtensions = [".xlsx", ".xls"];

  const originalName = file.originalname || "";

  const extension = originalName
    .substring(originalName.lastIndexOf("."))
    .toLowerCase();

  const mimeAllowed =
    !file.mimetype ||
    allowedMimeTypes.includes(file.mimetype);

  const extensionAllowed =
    allowedExtensions.includes(extension);

  return mimeAllowed && extensionAllowed;
}

function getAuthenticatedUserId(
  req: Request,
): string | undefined {
  const user = (req as any).user;

  if (!user) {
    return undefined;
  }

  if (user._id) {
    return String(user._id);
  }

  if (user.id) {
    return String(user.id);
  }

  return undefined;
}

/* =====================================================
   Controller
===================================================== */

export const salesOrderImportController = {
  /* ===================================================
     GET /sales-orders/import/template
  =================================================== */

  async template(
    req: Request,
    res: Response,
  ): Promise<Response | void> {
    try {
      const headers = [
        "Import Reference",
        "Dealer Code",
        "Warehouse Code",
        "Order Date",
        "Payment Method",
        "Product SKU",
        "Qty",
        "Bonus Qty Override",
        "Discount %",
        "Tax %",
        "Notes",
      ];

      const sampleRows = [
        [
          "IMP-0001",
          "DLR-001",
          "WH-001",
          "2026-10-03",
          "CASH",
          "SKU-001",
          10,
          "",
          "",
          "",
          "Sample order",
        ],
        [
          "IMP-0001",
          "DLR-001",
          "WH-001",
          "2026-10-03",
          "CASH",
          "SKU-002",
          5,
          "",
          5,
          "",
          "",
        ],
        [
          "IMP-0002",
          "DLR-002",
          "WH-002",
          "2026-10-03",
          "CREDIT",
          "SKU-003",
          20,
          0,
          "",
          0,
          "Explicitly disable bonus",
        ],
      ];

      const worksheet = XLSX.utils.aoa_to_sheet([
        headers,
        ...sampleRows,
      ]);

      worksheet["!cols"] = [
        { wch: 20 },
        { wch: 18 },
        { wch: 20 },
        { wch: 15 },
        { wch: 18 },
        { wch: 20 },
        { wch: 12 },
        { wch: 22 },
        { wch: 15 },
        { wch: 12 },
        { wch: 30 },
      ];

      const instructions = XLSX.utils.aoa_to_sheet([
        ["Sales Order Bulk Import Instructions"],
        [],
        ["Column", "Rule"],

        [
          "Import Reference",
          "Required. Rows with the same reference become one Sales Order.",
        ],

        [
          "Dealer Code",
          "Required. Must match an existing Dealer.code.",
        ],

        [
          "Warehouse Code",
          "Required. Must match an existing WarehouseOrFactory.code.",
        ],

        [
          "Order Date",
          "Required. Use YYYY-MM-DD.",
        ],

        [
          "Payment Method",
          "Required. CASH or CREDIT.",
        ],

        [
          "Product SKU",
          "Required. Must match an existing Product.sku.",
        ],

        [
          "Qty",
          "Required. Must be greater than 0.",
        ],

        [
          "Bonus Qty Override",
          "Blank = automatic promotion bonus. 0 = disable bonus. Positive number = force bonus.",
        ],

        [
          "Discount %",
          "Optional percentage from 0 to 100.",
        ],

        [
          "Tax %",
          "Optional percentage from 0 to 100. Blank uses product tax rate.",
        ],

        [
          "Notes",
          "Optional order notes.",
        ],

        [],

        [
          "Important",
          "Preview does not create or modify any database records.",
        ],

        [
          "Important",
          "Confirmation revalidates the Excel data before creating orders.",
        ],
      ]);

      instructions["!cols"] = [
        { wch: 25 },
        { wch: 100 },
      ];

      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Sales Orders",
      );

      XLSX.utils.book_append_sheet(
        workbook,
        instructions,
        "Instructions",
      );

      const buffer = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      res.setHeader(
        "Content-Disposition",
        'attachment; filename="sales-order-import-template.xlsx"',
      );

      return res.send(buffer);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate template";

      return res.status(400).json({
        success: false,
        message,
      });
    }
  },

  /* ===================================================
     POST /sales-orders/import/preview
  =================================================== */

  async preview(
    req: Request,
    res: Response,
  ): Promise<Response | void> {
    try {
      const file = getUploadedFile(req);

      if (!isExcelFile(file)) {
        return res.status(400).json({
          success: false,
          message:
            "Only .xlsx or .xls Excel files are allowed",
        });
      }

      const result =
        await salesOrderImportService.preview(
          file.buffer,
        );

      return res.status(200).json({
        success: true,
        message:
          "Sales order import preview generated successfully",
        data: result,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate sales order import preview";

      return res.status(400).json({
        success: false,
        message,
      });
    }
  },

  /* ===================================================
     POST /sales-orders/import/confirm
  =================================================== */

  async confirm(
    req: Request,
    res: Response,
  ): Promise<Response | void> {
    try {
      /* -----------------------------------------------
         1. Validate uploaded file
      ------------------------------------------------ */

      const file = getUploadedFile(req);

      if (!isExcelFile(file)) {
        return res.status(400).json({
          success: false,
          message:
            "Only .xlsx or .xls Excel files are allowed",
        });
      }

      /* -----------------------------------------------
         2. Re-run complete validation

         NEVER trust the previous preview.

         Between preview and confirmation:

         - stock can change
         - dealer status can change
         - credit availability can change
         - promotion can expire
         - promotion can change
      ------------------------------------------------ */

      const preview =
        await salesOrderImportService.preview(
          file.buffer,
        );

      /* -----------------------------------------------
         3. Stop if validation errors exist
      ------------------------------------------------ */

      if (preview.errors.length > 0) {
        return res.status(422).json({
          success: false,
          message:
            "Import cannot be confirmed because the Excel file contains validation errors",
          data: preview,
        });
      }

      /* -----------------------------------------------
         4. Ensure orders exist
      ------------------------------------------------ */

      if (
        !preview.groups ||
        preview.groups.length === 0
      ) {
        return res.status(422).json({
          success: false,
          message:
            "No valid sales orders found in the Excel file",
          data: preview,
        });
      }

      /* -----------------------------------------------
         5. Get logged-in user
      ------------------------------------------------ */

      const userId =
        getAuthenticatedUserId(req);

      /* -----------------------------------------------
         6. Convert groups into SalesOrder payloads
      ------------------------------------------------ */

      const orderPayloads =
        salesOrderImportService.buildOrderPayloads(
            preview.groups,
            userId ? new Types.ObjectId(userId) : new Types.ObjectId(),
        );

      if (orderPayloads.length === 0) {
        return res.status(422).json({
          success: false,
          message:
            "No valid sales orders found to create",
          data: preview,
        });
      }

      /* -----------------------------------------------
         7. Create orders independently

         IMPORTANT:

         Do NOT use Promise.all().

         salesOrderService.create() already does:

             base.withTransaction(...)

         Therefore:

             Order 1 -> Transaction 1
             Order 2 -> Transaction 2
             Order 3 -> Transaction 3

         If Order 3 fails, Orders 1 and 2 remain
         successfully committed.
      ------------------------------------------------ */

      const results: ImportResult[] = [];

      for (const payload of orderPayloads) {
        const importReference = String(
          payload.importReference || "",
        );

        try {
          /* -------------------------------------------
             Build create payload
          ------------------------------------------- */

          const createPayload: any = {
            ...payload,
          };

          if (userId) {
            createPayload.createdBy = userId;
            createPayload.updatedBy = userId;
          }

          /* -------------------------------------------
             Existing SalesOrder business logic

             This is NOT a direct insert.

             It goes through:

             salesOrderService.create()
               ↓
             Dealer validation
               ↓
             Credit validation
               ↓
             Order number
               ↓
             SalesOrder creation
               ↓
             Stock reservation
               ↓
             Transaction commit
          ------------------------------------------- */

          const order =
            (await salesOrderService.create(
              createPayload,
            )) as CreatedSalesOrder | undefined;

          /* -------------------------------------------
             TypeScript/runtime guard

             salesOrderService.create() is currently
             inferred as potentially undefined by
             TypeScript.

             Do not use:

                 order!._id

             Instead explicitly verify it exists.
          ------------------------------------------- */

          if (!order) {
            throw new Error(
              `Sales order was not created for import reference "${importReference}"`,
            );
          }

          /* -------------------------------------------
             Successful order
          ------------------------------------------- */

          results.push({
            importReference,
            success: true,
            orderId: String(order._id),
            orderNo: String(order.orderNo),
          });
        } catch (error: unknown) {
          /* -------------------------------------------
             Failed order

             salesOrderService.create() handles the
             transaction rollback for this order.

             Previously successful orders are NOT rolled
             back.
          ------------------------------------------- */

          const message =
            error instanceof Error
              ? error.message
              : "Failed to create sales order";

          results.push({
            importReference,
            success: false,
            error: message,
          });
        }
      }

      /* -----------------------------------------------
         8. Calculate final result
      ------------------------------------------------ */

      const successfulOrders =
        results.filter(
          (item) => item.success,
        );

      const failedOrders =
        results.filter(
          (item) => !item.success,
        );

      const allSuccessful =
        failedOrders.length === 0 &&
        successfulOrders.length ===
          orderPayloads.length;

      const partiallySuccessful =
        successfulOrders.length > 0 &&
        failedOrders.length > 0;

      /* -----------------------------------------------
         9. Response
      ------------------------------------------------ */

      return res
        .status(
          allSuccessful
            ? 201
            : partiallySuccessful
              ? 207
              : 400,
        )
        .json({
          success: allSuccessful,
          partialSuccess:
            partiallySuccessful,

          message: allSuccessful
            ? "All sales orders imported successfully"
            : partiallySuccessful
              ? "Sales order import completed with some failures"
              : "Sales order import failed",

          data: {
            totalOrders:
              orderPayloads.length,

            successfulOrders:
              successfulOrders.length,

            failedOrders:
              failedOrders.length,

            results,
          },
        });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to confirm sales order import";

      return res.status(400).json({
        success: false,
        message,
      });
    }
  },
};

export default salesOrderImportController;