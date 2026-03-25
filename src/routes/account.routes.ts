// src/routes/account.routes.ts
import { Router } from "express";
import { createCrudRouter } from "./crud.routes";
import { accountController } from "../controllers/account.controller";

const router = Router();

/**
 * ==========================================================
 * Custom Account Utilities
 * ==========================================================
 */

// Tree
router.get("/tree", accountController.tree);

// Summary
router.get("/summary", accountController.summary);

// Opening balance report
router.get("/opening-balance-summary", accountController.summaryOpeningBalance);

/**
 * ==========================================================
 * 🔥 NEW AUTO ENTITY ACCOUNT ENDPOINTS
 *
 * These allow manual triggering of:
 *  - Auto create account for Dealer / Supplier / Product
 *  - Sync account name with entity name
 * ==========================================================
 */

// Auto create account for entity
router.post("/auto-entity", accountController.autoCreateEntityAccount);

// Sync entity name with linked account
router.post("/sync-entity-name", accountController.syncEntityName);

/**
 * ==========================================================
 * Standard CRUD
 * ==========================================================
 */

router.use("/", createCrudRouter(accountController));

export default router;
