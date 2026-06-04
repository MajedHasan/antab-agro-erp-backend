import bcrypt from "bcrypt";
import UserModel from "../models/user.model";
import UserLocationAccess from "../models/userLocationAccess.model";
import { RefreshTokenModel } from "../models/refreshToken.model";
import { VerificationTokenModel } from "../models/verificationToken.model";
import { PasswordResetTokenModel } from "../models/passwordResetToken.model";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import config from "../config";
import mongoose, { ObjectId } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/email";
import { AppError } from "../utils/appError";
import { de } from "date-fns/locale";

/**
 * Helper parse durations like "7d", "15m", "1h"
 */
function parseExpiryToMs(str: string) {
  const re = /^(\d+)([smhd])?$/i;
  const match = re.exec(str);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = (match[2] || "d").toLowerCase();
  switch (unit) {
    case "s":
      return n * 1000;
    case "m":
      return n * 60 * 1000;
    case "h":
      return n * 60 * 60 * 1000;
    case "d":
      return n * 24 * 60 * 60 * 1000;
    default:
      return n * 24 * 60 * 60 * 1000;
  }
}

export async function registerUser(payload: {
  email: string;
  password: string;
  name: string;
  roleId: string; // ObjectId from Role collection
  department?: string;
}) {
  const existing = await UserModel.findOne({ email: payload.email });
  if (existing) throw new Error("Email already taken");

  const hashed = await bcrypt.hash(payload.password, 10);

  const user = await UserModel.create({
    email: payload.email,
    password: hashed,
    name: payload.name,
    role: new mongoose.Types.ObjectId(payload.roleId), // ✅ IMPORTANT
    department: payload.department || null,
  });

  return {
    id: user._id,
    email: user.email,
    name: user.name,
  };
}

export async function loginUser(payload: { email: string; password: string }) {
  try {
    const user = await UserModel.findOne({ email: payload.email }).populate({
      path: "role",
      populate: {
        path: "permissions",
      },
    });
    if (!user) throw new AppError("Invalid email or password", 401);

    const ok = await bcrypt.compare(payload.password, user.password);
    if (!ok) throw new AppError("Invalid email or password", 401);

    const userLocationAccessDoc = await UserLocationAccess.findOne({
      user: user._id,
    })
      .populate("access.zone")
      .populate("access.regions.region")
      .populate("access.regions.areas.area")
      .populate("access.regions.areas.territories");

    function safeId(value: any) {
      if (!value) return null;
      if (typeof value === "string") return value;
      return value._id?.toString?.() || value.id?.toString?.() || null;
    }

    function safeName(value: any) {
      if (!value) return null;
      if (typeof value === "string") return value;
      return value.name || null;
    }

    const ula = userLocationAccessDoc;

    const userLocationAccess = ula
      ? {
          zone: ula.access?.zone
            ? {
                id: safeId(ula.access.zone),
                name: safeName(ula.access.zone),
              }
            : null,

          regions: (ula.access?.regions || []).map((r: any) => ({
            id: safeId(r.region),
            name: safeName(r.region),

            areas: (r.areas || []).map((a: any) => ({
              id: safeId(a.area),
              name: safeName(a.area),

              territories: (a.territories || []).map((t: any) => ({
                id: safeId(t),
                name: safeName(t),
              })),
            })),
          })),
        }
      : null;

    // issue access token & refresh token...
    const accessToken = signAccessToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const jti = uuidv4();
    const refreshToken = signRefreshToken({ sub: user._id.toString(), jti });
    const expiresInMs = parseExpiryToMs(config.jwt.refreshExpiresIn);
    const expiresAt = new Date(Date.now() + expiresInMs);

    await RefreshTokenModel.create({
      jti,
      token: refreshToken,
      user: user._id,
      expiresAt,
      revoked: false,
      replacedBy: null,
    });

    // Transform role and permissions to a friendly JS object:
    let roleObj: any = null;
    if (user.role) {
      // role may be populated document or ObjectId
      // if populated:
      const populatedRole: any = (user as any).role;
      roleObj = {
        id: populatedRole._id?.toString?.() ?? populatedRole.toString?.(),
        name: populatedRole.name,
        permissions: Array.isArray(populatedRole.permissions)
          ? populatedRole.permissions.map((p: any) =>
              p?.name ? p.name : p.toString(),
            )
          : [],
        isSystem: populatedRole.isSystem ?? false,
      };
    }

    // return user payload (don't include password)
    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        profileImageUrl: user.profileImageUrl,
        role: roleObj,
        department: user.department,
        userLocationAccess,
      },
    };
  } catch (err: any) {
    // convert unknown errors to AppError
    if (!(err instanceof AppError))
      throw new AppError("Internal server error", 500);
    throw err;
  }
}

export async function me(userId: string) {
  try {
    const user = await UserModel.findById({ id: userId }).populate({
      path: "role",
      populate: { path: "permissions" },
    });

    if (!user) return { success: false };

    const role = user.role
      ? {
          id: (user.role as any)._id?.toString?.(),
          name: (user.role as any).name,
          permissions: Array.isArray((user.role as any).permissions)
            ? (user.role as any).permissions.map((p: any) => p.name)
            : [],
        }
      : null;

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
        role,
      },
    };
  } catch (err) {
    if (!(err instanceof AppError))
      throw new AppError("Internal server error", 500);
    throw err;
  }
}

/**
 * Refresh token rotation:
 * - Verify signature and payload (get jti)
 * - Find stored token by jti and ensure not revoked and token string matches (prevent token substitution)
 * - Revoke the old token and set replacedBy = new jti
 * - Create & store new refresh token with new jti
 * - Return new access token + new refresh token
 */
export async function rotateRefreshToken(oldRefreshToken: string) {
  let payload: any;
  try {
    payload = verifyRefreshToken(oldRefreshToken) as any;
  } catch (err) {
    throw new Error("Invalid refresh token");
  }
  const { sub, jti: oldJti } = payload as { sub: string; jti: string };

  // find the stored token
  const stored = await RefreshTokenModel.findOne({ jti: oldJti });
  if (!stored) throw new Error("Refresh token not found (possibly revoked)");
  if (stored.revoked) {
    // Token was revoked — investigation: revoke all tokens for user to mitigate reuse
    await RefreshTokenModel.updateMany(
      { user: stored.user },
      { revoked: true },
    );
    throw new Error("Refresh token revoked");
  }
  if (stored.token !== oldRefreshToken) {
    // token mismatch (possible theft) — revoke all user tokens
    await RefreshTokenModel.updateMany(
      { user: stored.user },
      { revoked: true },
    );
    throw new Error("Refresh token mismatch - suspicious");
  }
  if (stored.expiresAt.getTime() < Date.now()) {
    throw new Error("Refresh token expired");
  }

  // create new refresh token
  const newJti = uuidv4();
  const newRefreshToken = signRefreshToken({ sub, jti: newJti });
  const expiresInMs = parseExpiryToMs(config.jwt.refreshExpiresIn);
  const expiresAt = new Date(Date.now() + expiresInMs);

  // save new token and mark old as replaced
  await RefreshTokenModel.create({
    jti: newJti,
    token: newRefreshToken,
    user: stored.user,
    expiresAt,
    revoked: false,
    replacedBy: null,
  });

  stored.revoked = true;
  stored.replacedBy = newJti;
  await stored.save();

  // new access token
  const user = await UserModel.findById(sub);
  if (!user) throw new Error("User not found");
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logoutByRefreshToken(
  refreshToken?: string,
  userId?: string,
) {
  if (refreshToken) {
    // revoke only that token
    const payload = (() => {
      try {
        return verifyRefreshToken(refreshToken) as any;
      } catch {
        return null;
      }
    })();
    if (payload?.jti) {
      await RefreshTokenModel.findOneAndUpdate(
        { jti: payload.jti },
        { revoked: true },
      );
    }
  } else if (userId) {
    await RefreshTokenModel.updateMany(
      { user: new mongoose.Types.ObjectId(userId) },
      { revoked: true },
    );
  }
}

/* Password reset flows */

export async function requestPasswordReset(email: string) {
  const user = await UserModel.findOne({ email });
  if (!user) throw new Error("User not found");

  const token = uuidv4();
  const expiresMs = parseExpiryToMs("1h"); // reset token valid 1 hour
  const expiresAt = new Date(Date.now() + expiresMs);

  await PasswordResetTokenModel.create({ token, user: user._id, expiresAt });

  // send dev email
  const emailResult = await sendPasswordResetEmail(user.email, token);
  return { resetLink: emailResult.link };
}

export async function resetPassword(token: string, newPassword: string) {
  const doc = await PasswordResetTokenModel.findOne({ token, used: false });
  if (!doc) throw new Error("Invalid or expired reset token");
  if (doc.expiresAt.getTime() < Date.now())
    throw new Error("Reset token expired");

  // set new password
  const hashed = await bcrypt.hash(newPassword, 10);
  await UserModel.findByIdAndUpdate(doc.user, { password: hashed });

  doc.used = true;
  await doc.save();

  // revoke all refresh tokens for the user (security)
  await RefreshTokenModel.updateMany({ user: doc.user }, { revoked: true });

  return true;
}
