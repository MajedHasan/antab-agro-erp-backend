import { Router } from "express";
import { collectionController } from "./collection.controller";

const router = Router();

/**
 * Utility APIs
 */
router.get("/check-online-copy-no", collectionController.checkOnlineCopyNo);

/**
 * CRUD APIs
 */
router.get("/", collectionController.list);
router.get("/:id", collectionController.get);
router.post("/", collectionController.create);
router.put("/:id", collectionController.update);

/**
 * Workflow APIs
 */
router.post("/:id/status/submit", collectionController.submit);
router.post("/:id/status/review", collectionController.underReview);
router.post("/:id/status/approve", collectionController.approve);
router.post("/:id/status/hold", collectionController.hold);
router.post("/:id/status/dispute", collectionController.dispute);
router.post("/:id/status/cancel", collectionController.cancel);

export default router;
