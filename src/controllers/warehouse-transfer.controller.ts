import { Request, Response, NextFunction } from "express";
import { createCrudController } from "./crud.controller";
import {
  warehouseTransferCrudService,
  warehouseTransferService,
} from "../services/warehouse-transfer.service";

function getUser(req: Request) {
  const u = (req as any).user;
  if (!u) return undefined;

  return {
    userId: u.userId || u._id || String(u.id || ""),
    name: u.name,
    role: u.role,
  };
}

const baseController = createCrudController(warehouseTransferCrudService, {
  defaultPopulate: [
    { path: "sender" },
    { path: "receiver" },
    { path: "createdBy", select: "name email role" },
    { path: "receiverNsmApprovedBy", select: "name email role" },
    { path: "senderReviewedBy", select: "name email role" },
    { path: "senderNsmApprovedBy", select: "name email role" },
    { path: "dispatchedBy", select: "name email role" },
    { path: "receivedBy", select: "name email role" },
    { path: "items.productId", select: "name sku unit salePrice" },
    {
      path: "documents.signed.mediaId",
      select: "url fileName module folder",
    },
  ],
});

export const warehouseTransferController = {
  ...baseController,

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const data = await warehouseTransferService.create(req.body, { user });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const data = await warehouseTransferService.update(
        req.params.id,
        req.body,
        {
          user,
        },
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await warehouseTransferService.remove(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  bulkCreate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const data = await warehouseTransferService.bulkCreate(req.body, {
        user,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  bulkDelete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);

      const data = await warehouseTransferService.bulkDelete(
        req.body.filters || [],
        {
          user,
        },
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  receiverNSMApprove: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = getUser(req);
      const data = await warehouseTransferService.receiverNSMApprove(
        req.params.id,
        req.body,
        user as any,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  senderReview: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const data = await warehouseTransferService.senderReview(
        req.params.id,
        req.body,
        user as any,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  senderNSMApprove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const data = await warehouseTransferService.senderNSMApprove(
        req.params.id,
        req.body,
        user as any,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  generatePrintSnapshot: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = getUser(req);
      const data = await warehouseTransferService.generatePrintSnapshot(
        req.params.id,
        user as any,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  dispatch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const data = await warehouseTransferService.dispatch(
        req.params.id,
        user as any,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  receive: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const data = await warehouseTransferService.receive(
        req.params.id,
        req.body,
        user as any,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  cancel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const data = await warehouseTransferService.cancel(
        req.params.id,
        req.body,
        user as any,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  reject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = getUser(req);
      const data = await warehouseTransferService.reject(
        req.params.id,
        req.body,
        user as any,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
