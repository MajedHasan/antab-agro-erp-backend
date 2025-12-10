// middlewares/role.middleware.ts
import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import roleModel from "../models/role.model";

export function requireRole(...allowedRoles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Not authenticated" });

    // Fetch role document
    const userRole = await roleModel.findById(user.role);
    if (!userRole)
      return res.status(400).json({ message: "User role not found" });

    console.log("User Role:", userRole.name);

    // ✅ Compare role NAME, not ObjectId
    if (!allowedRoles.includes(userRole.name))
      return res.status(403).json({ message: "Forbidden: insufficient role" });

    next();
  };
}
