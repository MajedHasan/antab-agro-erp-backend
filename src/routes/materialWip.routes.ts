import { Router } from "express";
import { materialWipController } from "../controllers/materialWip.controller";

const router = Router();

router.post("/start", materialWipController.start);

router.get("/products/:rawMaterialId", materialWipController.getProducts);

router.post("/convert", materialWipController.convert);

router.post("/complete", materialWipController.complete);

router.get("/", materialWipController.list);

export default router;
