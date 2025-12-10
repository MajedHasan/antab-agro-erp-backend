// utils/totp.ts
import speakeasy from "speakeasy";
import qrcode from "qrcode";

export function generateTOTPSecret({
  name = "CourseHub",
  userEmail = "",
}: {
  name?: string;
  userEmail?: string;
}) {
  const secret = speakeasy.generateSecret({
    name: `${name}:${userEmail}`,
    length: 20,
  });
  return secret; // contains ascii, hex, base32, otpauth_url
}

// generate QR data URL for otpauth_url
export async function getQRCodeDataUrl(otpauth_url: string) {
  return qrcode.toDataURL(otpauth_url);
}

export function verifyTOTP(token: string, base32Secret: string) {
  return speakeasy.totp.verify({
    secret: base32Secret,
    encoding: "base32",
    token,
    window: 1,
  });
}
