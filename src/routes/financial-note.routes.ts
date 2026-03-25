import { Router } from "express";
import { createCrudRouter } from "./crud.routes";
import { financialNoteController } from "../controllers/financial-note.controller";

const router = Router();

router.use("/", createCrudRouter(financialNoteController));

export default router;
