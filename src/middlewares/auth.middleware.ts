import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    roleId: string;
    email: string;
  };
}

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "Missing Authorization header" });
  const token = authHeader.split(" ")[1];
  try {
    const payload: any = verifyAccessToken(token);
    // req.user = payload; // payload.sub, payload.email, etc.
    req.user = {
      userId: payload.sub,
      roleId: payload.role,
      email: payload.email,
    }; // payload.sub, payload.email, etc.
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
