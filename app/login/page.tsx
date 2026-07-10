"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [linkError, setLinkError] = useState(false);

  useEffect(() => {
    // Surface why a clicked email link bounced back here instead of looping silently
    const err = new URLSearchParams(window.location.search).get("error");
    if (err) setLinkError(true);
  }, []);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto 0" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Ignite Seminary"
        width={110}
        height={110}
        style={{ margin: "0 auto 16px", display: "block" }}
      />
      <p className="eyebrow">Student &amp; instructor access</p>
      <h1 style={{ marginTop: 0 }}>Sign in</h1>
      {linkError && status !== "sent" && (
        <div className="notice" style={{ marginBottom: 14 }}>
          That sign-in link was already used or has expired — they only work once.
          Enter your email below and we&apos;ll send a fresh one.
        </div>
      )}
      {status === "sent" ? (
        <div className="notice">
          Check your email — we sent a sign-in link to <strong>{email}</strong>.
          You can open it on any device.
        </div>
      ) : (
        <form className="stack" onSubmit={sendLink}>
          <div>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <button type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending link…" : "Email me a sign-in link"}
          </button>
          {status === "error" && (
            <p className="muted" style={{ color: "#b91c1c" }}>{errorMsg}</p>
          )}
          <p className="muted">
            No password needed — we email you a one-time link each time you sign in.
          </p>
        </form>
      )}
    </div>
  );
}
