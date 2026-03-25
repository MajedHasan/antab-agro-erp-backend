// src/routes/special-offer.routes.ts
import { Router } from "express";
import { specialOfferController } from "../controllers/special-offer.controller";
import { createCrudRouter } from "./crud.routes";

const router = Router();

/* ===============================
   Custom Offer Routes
================================ */

// Get progress for an offer
router.get("/:id/progress", specialOfferController.getProgress);

// Issue reward to a dealer
router.post("/:id/reward", specialOfferController.issueReward);

// List rewards for an offer
router.get("/:id/rewards", specialOfferController.listRewards);

// List rewards for a specific dealer under this offer
router.get("/:id/rewards/:dealerId", specialOfferController.listDealerRewards);

/* ===============================
   Attach Standard CRUD Routes
================================ */
const crudRouter = createCrudRouter(specialOfferController);
router.use("/", crudRouter);

export default router;
