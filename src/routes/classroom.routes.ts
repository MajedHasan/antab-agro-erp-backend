import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import * as classroomCtrl from "../controllers/classroom.controller";

const router = Router();

// Only teacher and admin can access the classrooms list
router.get(
  "/",
  requireAuth,
  requireRole("teacher", "admin"),
  classroomCtrl.listClassrooms
);

export default router;
