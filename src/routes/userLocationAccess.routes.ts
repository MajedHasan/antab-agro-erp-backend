// src/routes/userLocationAccess.routes.ts
import { Router } from "express";
import { createCrudRouter } from "./crud.routes";
import { userLocationAccessController } from "../controllers/userLocationAccess.controller";

const router = createCrudRouter(userLocationAccessController);

export default router;
