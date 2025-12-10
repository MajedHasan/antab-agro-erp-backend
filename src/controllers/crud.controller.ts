// src/controllers/crud.controller.ts
import { Request, Response, NextFunction } from "express";
import { createCrudService } from "../services/crud.service";
import { parseListQuery } from "../utils/query";

export function createCrudController(
  service: ReturnType<typeof createCrudService>,
  options: { defaultPopulate?: any } = {}
) {
  return {
    list: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const pq = parseListQuery(req, { page: 1, limit: 15 });
        const result = await service.list({
          filter: pq.filter,
          page: pq.page,
          limit: pq.limit,
          sort: pq.sort,
          select: pq.select,
          populate: pq.populate ?? options.defaultPopulate,
          q: pq.q,
          searchFields: pq.searchFields,
        });
        res.json({ success: true, ...result });
      } catch (err) {
        next(err);
      }
    },

    get: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await service.getById(req.params.id, {
          populate: (req.query.populate as any) || options.defaultPopulate,
        });
        res.json({ success: true, data: doc });
      } catch (err) {
        next(err);
      }
    },

    create: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const created = await service.create(req.body);
        res.status(201).json({ success: true, data: created });
      } catch (err) {
        next(err);
      }
    },

    update: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const updated = await service.update(req.params.id, req.body);
        res.json({ success: true, data: updated });
      } catch (err) {
        next(err);
      }
    },

    delete: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const hard = req.query.hard === "true";
        const deleted = await service.remove(req.params.id, { hard });
        res.json({ success: true, data: deleted });
      } catch (err) {
        next(err);
      }
    },

    bulkCreate: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const created = await service.bulkCreate(req.body);
        res.status(201).json({ success: true, data: created });
      } catch (err) {
        next(err);
      }
    },

    bulkDelete: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const filters = req.body.filters || [];
        const hard = req.query.hard === "true";
        const result = await service.bulkDelete(filters, { hard });
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },

    exportCSV: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const fields = (req.query.fields as string)?.split(",") || [];
        const csv = await service.exportCSV({
          filter: req.body.filter || {},
          fields,
          populate: req.query.populate,
        });
        res.setHeader("Content-Type", "text/csv");
        res.send(csv);
      } catch (err) {
        next(err);
      }
    },
  };
}
