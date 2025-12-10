import { Request, Response, NextFunction } from "express";
import User from "../models/user.model";
import Role from "../models/role.model";
import Permission from "../models/permission.model";
import { getEffectivePermissions } from "../services/roles.service";

export function authorize(
  requiredPermissions: string[] = [],
  options: {
    requireAny?: boolean;
    allowedDepartments?: string[];
    allowOwner?: (req: Request, userId: string) => Promise<boolean> | boolean;
  } = {}
) {
  const { requireAny = false, allowedDepartments, allowOwner } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = (req as any).user;
      if (!authUser)
        return res.status(401).json({ message: "Unauthenticated" });

      const user = await User.findById(authUser.userId).populate({
        path: "role",
        populate: { path: "permissions", model: "Permission" },
      });

      if (!user) return res.status(401).json({ message: "User not found" });
      const role = user.role as any;
      if (!role) return res.status(403).json({ message: "Role missing" });

      // Department check
      if (allowedDepartments) {
        const userDept = role.department || user.department || "";
        if (!allowedDepartments.includes(userDept)) {
          return res.status(403).json({ message: "Department not allowed" });
        }
      }

      // Owner override
      if (allowOwner) {
        const isOwner = await allowOwner(req, user._id.toString());
        if (isOwner) return next();
      }

      // Permissions (flattened with inheritance)
      const perms = await getEffectivePermissions(role._id); // returns string[]
      if (perms.includes("*")) return next(); // wildcard Super Admin

      if (requiredPermissions.length === 0) return next();

      const check = requiredPermissions.map((p) => perms.includes(p));
      const ok = requireAny ? check.some(Boolean) : check.every(Boolean);
      if (!ok) return res.status(403).json({ message: "Access denied" });

      next();
    } catch (err) {
      console.error("Authorization error", err);
      res.status(500).json({ message: "Server error" });
    }
  };
}
