import { redirect } from "next/navigation";
import { confirmSignIn } from "@/app/actions";

export const dynamic = "force-dynamic";

// Landing page for email sign-in links. Deliberately does NOT verify on
// load: corporate mail scanners (EdgePilot, Safe Links, etc.) pre-open
// links and would consume the one-time token. A human taps the button.
export default function ConfirmPage({
  searchParams,
}: {
  searchParams?: { token_hash?: string; type?: string };
}) {
  const tokenHash = searchParams?.token_hash;
  if (!tokenHash) redirect("/login?error=expired");

  return (
    <div style={{ maxWidth: 420, margin: "48px auto 0", textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Ignite Seminary"
        width={110}
        height={110}
        style={{ margin: "0 auto 16px", display: "block" }}
      />
      <p className="eyebrow">Almost there</p>
      <h1 style={{ marginTop: 0 }}>Finish signing in</h1>
      <p className="muted">One tap and you&apos;re in.</p>
      <form action={confirmSignIn} style={{ marginTop: 20 }}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={searchParams?.type ?? "email"} />
        <button type="submit" style={{ fontSize: "1.05rem", padding: "14px 32px" }}>
          Sign in to Ignite Seminary
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16, fontSize: "0.85rem" }}>
        Didn&apos;t request this? Just close this page.
      </p>
    </div>
  );
}
