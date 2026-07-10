// Server-only. Sends via Resend's REST API. Without RESEND_API_KEY the app
// still works — sends are skipped and a warning is logged.
const FROM = process.env.EMAIL_FROM || "Ignite Seminary <seminary@ignitemb.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://seminary.ignitemb.com";

export async function sendEmail(to: string[], subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("RESEND_API_KEY not set — skipping email:", subject);
    return;
  }
  if (to.length === 0) return;
  try {
    // One request per recipient so addresses aren't exposed to each other.
    await Promise.all(
      to.map((addr) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: FROM, to: [addr], subject, html }),
        })
      )
    );
  } catch (e) {
    console.error("Email send failed:", e);
  }
}

export function courseEmail(opts: {
  heading: string;
  body: string;
  courseTitle: string;
  courseId: string;
}) {
  const link = `${APP_URL}/course/${opts.courseId}`;
  return `
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#241b35">
    <div style="background:#33125f;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
      <strong>Ignite Seminary</strong> — ${escapeHtml(opts.courseTitle)}
    </div>
    <div style="border:1px solid #e8e3dc;border-top:none;border-radius:0 0 10px 10px;padding:20px">
      <h2 style="margin-top:0">${escapeHtml(opts.heading)}</h2>
      <p style="white-space:pre-wrap;line-height:1.55">${escapeHtml(opts.body)}</p>
      <p style="margin-top:24px">
        <a href="${link}" style="background:#4c1d95;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Open the course</a>
      </p>
    </div>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
