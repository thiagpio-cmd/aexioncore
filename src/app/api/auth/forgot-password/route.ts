import { prisma } from "@/lib/db";
import { Resend } from "resend";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/utils/base-url";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({
        message: "If an account exists, a reset link has been sent.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (user && resend) {
      // Invalidate previous tokens
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.create({
        data: { token, userId: user.id, expiresAt },
      });

      const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`;

      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Aexion Core <noreply@aexioncore.com>",
        to: user.email,
        subject: "Reset your password — Aexion Core",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #1a1a2e; margin-bottom: 16px;">Reset your password</h2>
            <p style="color: #444; line-height: 1.6;">Hi ${user.name || ""},</p>
            <p style="color: #444; line-height: 1.6;">You requested a password reset for your Aexion Core account. Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="background: #2457FF; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Reset Password</a>
            </div>
            <p style="color: #888; font-size: 14px; line-height: 1.5;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #aaa; font-size: 12px;">Aexion Core — Revenue Operating System</p>
          </div>
        `,
      });
    }

    // Always return 200 to not reveal if email exists
    return NextResponse.json({
      message: "If an account exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("[Auth] Password reset error:", error);
    return NextResponse.json({
      message: "If an account exists, a reset link has been sent.",
    });
  }
}
