"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

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
      <p className="eyebrow">Student &amp; instructor access</p>
      <h1 style={{ marginTop: 0 }}>Sign in</h1>
      {status === "sent" ? (
        <div className="notice">
          Check your email — we sent a sign-in link to <strong>{email}</strong>.
          Open it on this device to finish signing in.
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
