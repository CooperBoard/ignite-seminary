"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type Mode = "signin" | "signup" | "forgot" | "magic";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "sent">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [linkError, setLinkError] = useState(false);

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (err) setLinkError(true);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setStatus("busy");
    const supabase = createClient();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/dashboard";
        return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          window.location.href = "/dashboard";
          return;
        }
        setStatus("sent"); // email confirmation required
        return;
      }
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setStatus("sent");
        return;
      }
      // magic link fallback
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setStatus("sent");
    } catch (err: any) {
      setErrorMsg(
        err?.message === "Invalid login credentials"
          ? "Wrong email or password. If you signed in with email links before, use “Forgot password” to set a password."
          : err?.message || "Something went wrong"
      );
      setStatus("idle");
    }
  }

  const headline =
    mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Sign in";

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
      <h1 style={{ marginTop: 0 }}>{headline}</h1>

      {linkError && status !== "sent" && (
        <div className="notice" style={{ marginBottom: 14 }}>
          That email link was already used or has expired. Sign in with your password below,
          or use &quot;Forgot password&quot; to set a new one.
        </div>
      )}

      {status === "sent" ? (
        <div className="notice">
          Check your email — we sent {mode === "forgot" ? "a password-reset link" : mode === "signup" ? "a confirmation link" : "a sign-in link"} to{" "}
          <strong>{email}</strong>. You can open it on any device.
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
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
          {(mode === "signin" || mode === "signup") && (
            <div>
              <label htmlFor="password">Password{mode === "signup" ? " (8+ characters)" : ""}</label>
              <input
                id="password"
                type="password"
                required
                minLength={mode === "signup" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}
          <button type="submit" disabled={status === "busy"}>
            {status === "busy"
              ? "Working…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Email me a sign-in link"}
          </button>
          {errorMsg && <p className="muted" style={{ color: "#b91c1c" }}>{errorMsg}</p>}

          <p className="muted" style={{ textAlign: "center" }}>
            {mode === "signin" && (
              <>
                <a href="#" onClick={(e) => { e.preventDefault(); setMode("signup"); setErrorMsg(""); }}>New student? Create an account</a>
                {" · "}
                <a href="#" onClick={(e) => { e.preventDefault(); setMode("forgot"); setErrorMsg(""); }}>Forgot password?</a>
              </>
            )}
            {mode !== "signin" && (
              <a href="#" onClick={(e) => { e.preventDefault(); setMode("signin"); setErrorMsg(""); }}>← Back to sign in</a>
            )}
          </p>
        </form>
      )}
    </div>
  );
}
