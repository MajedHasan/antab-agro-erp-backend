// src/routes/user.routes.ts
import { Router } from "express";
import { createCrudRouter } from "./crud.routes";
import { userController } from "../controllers/user.controller";

const router = createCrudRouter(userController);

// ✅ Add custom route examples
// router.get("/active", async (req, res, next) => {
//   try {
//     const users = await userController.service.model.find({ isActive: true });
//     res.json({ success: true, data: users });
//   } catch (e) {
//     next(e);
//   }
// });

// router.post("/invite", async (req, res, next) => {
//   try {
//     const { email } = req.body;
//     // your custom invite logic here
//     res.json({ success: true, message: `Invite sent to ${email}` });
//   } catch (e) {
//     next(e);
//   }
// });

export default router;
