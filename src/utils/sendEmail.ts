export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email is not configured");
    }
    console.log(`[dev] Password reset link for ${to}: ${resetUrl}`);
    return;
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Trackr", email: from },
      to: [{ email: to }],
      subject: "Reset your Trackr password",
      htmlContent: `<p>You asked to reset your Trackr password.</p>
        <p><a href="${resetUrl}">Choose a new password</a></p>
        <p>This link expires in 30 minutes. If you didn't ask for this, ignore this email.</p>`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Email provider responded ${res.status}: ${await res.text()}`);
  }
}