import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { updatePassword } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function PasswordPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div style={{ maxWidth: 420, margin: "40px auto 0" }}>
      <p className="eyebrow">{user.email}</p>
      <h1 style={{ marginTop: 0 }}>Set your password</h1>
      <p className="muted">
        You&apos;ll use this with your email to sign in from now on.
      </p>
      {searchParams?.error === "short" && (
        <div className="notice">Password needs at least 8 characters.</div>
      )}
      {searchParams?.error === "failed" && (
        <div className="notice">Couldn&apos;t update the password — try again.</div>
      )}
      <form action={updatePassword} className="stack" style={{ marginTop: 14 }}>
        <div>
          <label htmlFor="password">New password (8+ characters)</label>
          <input id="password" name="password" type="password" required minLength={8} />
        </div>
        <button type="submit">Save password</button>
      </form>
    </div>
  );
}
