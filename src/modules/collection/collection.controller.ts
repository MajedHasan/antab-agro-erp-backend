import { Request, Response, NextFunction } from "express";
import { createCrudController } from "../../controllers/crud.controller";
import { collectionService } from "./collection.service";

const base = createCrudController(collectionService);

function getPayload(req: Request) {
  const body: any = req.body ?? {};

  if (typeof body.collection === "string") {
    try {
      return JSON.parse(body.collection);
    } catch {
      throw new Error("Invalid collection payload");
    }
  }

  return body;
}

function getFiles(req: Request) {
  return (req.files as any[]) || [];
}

function getContext(req: Request) {
  const user = (req as any).user;

  return {
    user,
    actorId: user?._id || user?.id || user?.userId || null,
  };
}

function getRemarks(req: Request) {
  return (
    (req.body?.remarks ?? req.body?.note ?? req.body?.reason ?? null) || null
  );
}

async function handleStatusTransition(
  req: Request,
  res: Response,
  next: NextFunction,
  nextStatus: string,
) {
  try {
    const data = await collectionService.transitionCollectionStatus(
      req.params.id,
      nextStatus,
      getContext(req),
      getRemarks(req),
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export const collectionController = {
  ...base,

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await collectionService.listCollections(req.query);

      res.json({
        success: true,
        ...data,
      });
    } catch (error) {
      next(error);
    }
  },

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await collectionService.getCollectionById(req.params.id);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await collectionService.createCollection(
        getPayload(req),
        getContext(req),
        getFiles(req),
      );

      res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await collectionService.updateCollection(
        req.params.id,
        getPayload(req),
        getContext(req),
        getFiles(req),
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async checkOnlineCopyNo(req: Request, res: Response, next: NextFunction) {
    try {
      const no = String(req.query.no ?? "").trim();
      const excludeId = req.query.excludeId
        ? String(req.query.excludeId).trim()
        : undefined;

      const available = await collectionService.checkOnlineCopyNoAvailable(
        no,
        excludeId,
      );

      res.json({
        success: true,
        data: { available },
      });
    } catch (error) {
      next(error);
    }
  },

  async submit(req: Request, res: Response, next: NextFunction) {
    return handleStatusTransition(req, res, next, "SUBMITTED");
  },

  async underReview(req: Request, res: Response, next: NextFunction) {
    return handleStatusTransition(req, res, next, "UNDER_REVIEW");
  },

  async approve(req: Request, res: Response, next: NextFunction) {
    return handleStatusTransition(req, res, next, "APPROVED");
  },

  async hold(req: Request, res: Response, next: NextFunction) {
    return handleStatusTransition(req, res, next, "HOLD");
  },

  async dispute(req: Request, res: Response, next: NextFunction) {
    return handleStatusTransition(req, res, next, "DISPUTED");
  },

  async cancel(req: Request, res: Response, next: NextFunction) {
    return handleStatusTransition(req, res, next, "CANCELLED");
  },
};

export type CollectionController = typeof collectionController;
