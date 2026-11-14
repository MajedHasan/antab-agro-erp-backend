// src/routes/financial-note.routes.ts
import { Router } from "express";
import { financialNoteController } from "../controllers/financial-note.controller";

const router = Router();

// Non-id routes first
router.get("/", financialNoteController.list);
router.get("/next-number", financialNoteController.getNextNumber);
router.get("/account-tree", financialNoteController.getAccountTree);
router.post("/preview-rollup", financialNoteController.previewRollup);

// CRUD
router.post("/", financialNoteController.create);
router.get("/:id", financialNoteController.get);
router.put("/:id", financialNoteController.update);
router.delete("/:id", financialNoteController.delete);   // ← was `remove`, now `delete`

// Workflow
router.post("/:id/finalise", financialNoteController.finalise);
router.post("/:id/reopen", financialNoteController.reopen);
router.post("/:id/move", financialNoteController.move);

export default router;