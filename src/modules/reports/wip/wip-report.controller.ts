// src/controllers/materialWip.report.controller.ts
import { Request, Response, NextFunction } from "express";
import { materialWipReportService } from "./wip-report.service";

function parseMaybeString(value: any): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function parseMaybeNumber(value: any): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export const materialWipReportController = {
  /**
   * Paginated list with filters
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await materialWipReportService.list({
        factoryId: parseMaybeString(req.query.factoryId),
        rawMaterialId: parseMaybeString(req.query.rawMaterialId),
        status: parseMaybeString(req.query.status),
        createdBy: parseMaybeString(req.query.createdBy),
        approvedBy: parseMaybeString(req.query.approvedBy),
        q: parseMaybeString(req.query.q),
        preset: parseMaybeString(req.query.preset) as any,
        fromDate: parseMaybeString(req.query.fromDate),
        toDate: parseMaybeString(req.query.toDate),
        page: parseMaybeNumber(req.query.page) ?? 1,
        limit: parseMaybeNumber(req.query.limit) ?? 15,
      });

      return res.json({
        success: true,
        ...data,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Dashboard summary cards
   */
  async summary(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await materialWipReportService.summary({
        factoryId: parseMaybeString(req.query.factoryId),
        rawMaterialId: parseMaybeString(req.query.rawMaterialId),
        status: parseMaybeString(req.query.status),
        createdBy: parseMaybeString(req.query.createdBy),
        approvedBy: parseMaybeString(req.query.approvedBy),
        preset: parseMaybeString(req.query.preset) as any,
        fromDate: parseMaybeString(req.query.fromDate),
        toDate: parseMaybeString(req.query.toDate),
      });

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Trend report: day / week / month / year
   */
  async trend(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await materialWipReportService.trend({
        factoryId: parseMaybeString(req.query.factoryId),
        rawMaterialId: parseMaybeString(req.query.rawMaterialId),
        status: parseMaybeString(req.query.status),
        createdBy: parseMaybeString(req.query.createdBy),
        approvedBy: parseMaybeString(req.query.approvedBy),
        preset: parseMaybeString(req.query.preset) as any,
        fromDate: parseMaybeString(req.query.fromDate),
        toDate: parseMaybeString(req.query.toDate),
        groupBy: (parseMaybeString(req.query.groupBy) as any) || "day",
      });

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Raw material wise report
   */
  async rawMaterialWise(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await materialWipReportService.rawMaterialWise({
        factoryId: parseMaybeString(req.query.factoryId),
        rawMaterialId: parseMaybeString(req.query.rawMaterialId),
        status: parseMaybeString(req.query.status),
        createdBy: parseMaybeString(req.query.createdBy),
        approvedBy: parseMaybeString(req.query.approvedBy),
        preset: parseMaybeString(req.query.preset) as any,
        fromDate: parseMaybeString(req.query.fromDate),
        toDate: parseMaybeString(req.query.toDate),
      });

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Product wise report
   */
  async productWise(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await materialWipReportService.productWise({
        factoryId: parseMaybeString(req.query.factoryId),
        productId: parseMaybeString(req.query.productId),
        rawMaterialId: parseMaybeString(req.query.rawMaterialId),
        status: parseMaybeString(req.query.status),
        createdBy: parseMaybeString(req.query.createdBy),
        approvedBy: parseMaybeString(req.query.approvedBy),
        preset: parseMaybeString(req.query.preset) as any,
        fromDate: parseMaybeString(req.query.fromDate),
        toDate: parseMaybeString(req.query.toDate),
      });

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Packaging wise report
   */
  async packagingWise(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await materialWipReportService.packagingWise({
        factoryId: parseMaybeString(req.query.factoryId),
        packagingItemId: parseMaybeString(req.query.packagingItemId),
        rawMaterialId: parseMaybeString(req.query.rawMaterialId),
        status: parseMaybeString(req.query.status),
        createdBy: parseMaybeString(req.query.createdBy),
        approvedBy: parseMaybeString(req.query.approvedBy),
        preset: parseMaybeString(req.query.preset) as any,
        fromDate: parseMaybeString(req.query.fromDate),
        toDate: parseMaybeString(req.query.toDate),
      });

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * One WIP detail drill‑down
   */
  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await materialWipReportService.detail(req.params.id);

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "WIP not found",
        });
      }

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },
};