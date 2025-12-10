import { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, password, name, roleId, department } = req.body;
    const result = await authService.registerUser({
      email,
      password,
      name,
      roleId,
      department,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser({ email, password });
    res.json(result);
  } catch (err: any) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ success: false });

    const result = await authService.me(userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new Error("Missing refreshToken");
    const result = await authService.rotateRefreshToken(refreshToken);
    res.json(result);
  } catch (err: any) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    const userId = (req as any).user?.sub;
    await authService.logoutByRefreshToken(refreshToken, userId);
    res.json({ ok: true });
  } catch (err: any) {
    next(err);
  }
}

export async function requestPasswordReset(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email } = req.body;
    if (!email) throw new Error("Missing email");
    const result = await authService.requestPasswordReset(email);
    res.json(result); // dev: contains resetLink
  } catch (err: any) {
    next(err);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { token, password } = req.body;
    if (!token || !password) throw new Error("Missing token or password");
    await authService.resetPassword(token, password);
    res.json({ ok: true });
  } catch (err: any) {
    next(err);
  }
}
