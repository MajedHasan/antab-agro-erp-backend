import { Router } from "express";
import { createCrudRouter } from "./crud.routes";
import { supplierController } from "../controllers/supplier.controller";

const router = Router();

router.use("/", createCrudRouter(supplierController));

export default router;
