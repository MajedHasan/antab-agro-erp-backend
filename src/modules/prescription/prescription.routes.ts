// src/modules/prescription/prescription.routes.ts
import { Router } from "express";
import { createCrudRouter } from "../../routes/crud.routes";
import { prescriptionController } from "./prescription.controller";

const router = Router();

/* =====================================================
   CUSTOM PRESCRIPTION ROUTES
===================================================== */
router.post("/preview", prescriptionController.preview);
router.get("/my", prescriptionController.getMy);
router.get("/all", prescriptionController.getAll);

/* =====================================================
   CRUD ROUTES
===================================================== */

const crudRouter = createCrudRouter(prescriptionController);

router.use("/", crudRouter);

// /* =====================================================
//    MOUNT
// ===================================================== */
// router.use("/prescriptions", prescriptionRouter);

export default router;
