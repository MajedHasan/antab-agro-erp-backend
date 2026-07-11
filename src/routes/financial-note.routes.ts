// src/routes/financial-note.routes.ts
import { Router } from "express";
import { financialNoteController } from "../controllers/financial-note.controller";

const router = Router();

// Standard CRUD
router.get("/", financialNoteController.list);
router.get("/:id", financialNoteController.get);
router.post("/", financialNoteController.create);
router.put("/:id", financialNoteController.update);
router.delete("/:id", financialNoteController.delete);

// Additional workflow
router.post("/:id/finalise", financialNoteController.finalise);

export default router;