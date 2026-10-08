// src/controllers/dealer-import.controller.ts

import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  previewDealerImport,
  confirmDealerImport,
  createDealerImportTemplate,
} from "./dealer-import.service";

export const dealerImportController = {
  /**
   * GET /api/dealers/import/template
   */
  template: async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const buffer =
        createDealerImportTemplate();

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      res.setHeader(
        "Content-Disposition",
        'attachment; filename="dealer-import-template.xlsx"',
      );

      return res.send(buffer);
    } catch (error) {
      return next(error);
    }
  },

  /**
   * POST /api/dealers/import/preview
   */
  preview: async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Excel file is required",
        });
      }

      const result =
        await previewDealerImport(
          req.file.buffer,
        );

      return res.status(200).json({
        success: true,
        message:
          "Dealer import preview generated successfully",
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message:
          error?.message ||
          "Failed to preview dealer import",
      });
    }
  },

  /**
   * POST /api/dealers/import/confirm
   */
  confirm: async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    try {
      const { rows } = req.body;

      if (!Array.isArray(rows)) {
        return res.status(400).json({
          success: false,
          message:
            "rows must be an array",
        });
      }

      if (!rows.length) {
        return res.status(400).json({
          success: false,
          message:
            "No valid dealer rows were provided",
        });
      }

      const result =
        await confirmDealerImport(rows);

      /**
       * All succeeded.
       */
      if (result.failedCount === 0) {
        return res.status(200).json({
          success: true,
          message:
            "Dealer import completed successfully",
          data: result,
        });
      }

      /**
       * Some succeeded and some failed.
       *
       * HTTP 207 accurately represents a partial
       * success instead of pretending the whole
       * request failed.
       */
      if (result.createdCount > 0) {
        return res.status(207).json({
          success: true,
          message:
            "Dealer import completed with some failures",
          data: result,
        });
      }

      /**
       * Nothing was created.
       */
      return res.status(400).json({
        success: false,
        message:
          "Dealer import failed",
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message:
          error?.message ||
          "Failed to confirm dealer import",
      });
    }
  },
};