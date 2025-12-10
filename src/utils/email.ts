// A very small "email" utility. In dev it logs the link; in prod replace with nodemailer/sendgrid/etc.
export async function sendVerificationEmail(to: string, token: string) {
  const link = `http://localhost:3000/api/auth/verify-email?token=${token}`;
  // In production you'd send this link in an email. For dev we return it.
  console.info(`VERIFICATION EMAIL -> to=${to} link=${link}`);
  return { to, link };
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `http://localhost:3000/api/auth/reset-password?token=${token}`;
  console.info(`PASSWORD RESET EMAIL -> to=${to} link=${link}`);
  return { to, link };
}
