import { createCrudController } from "./crud.controller";
import { financialNoteService } from "../services/financial-note.service";

export const financialNoteController =
  createCrudController(financialNoteService);
