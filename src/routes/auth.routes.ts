import { Router } from "express";
import * as authCtrl from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

// router.post("/register", requireAuth, requireRole("admin"), authCtrl.register);
router.post("/register", authCtrl.register);
router.post("/login", authCtrl.login);
router.post("/refresh", authCtrl.refresh); // body: { refreshToken }
router.get("/me", requireAuth, authCtrl.me);
router.post("/logout", requireAuth, authCtrl.logout);
router.post("/request-password-reset", authCtrl.requestPasswordReset);
router.post("/reset-password", authCtrl.resetPassword);

export default router;
