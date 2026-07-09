import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div style={{ maxWidth: 560, margin: "48px auto 0", textAlign: "center" }}>
      <p className="eyebrow">Ignite Church</p>
      <h1 style={{ fontSize: "2.4rem", margin: "0 0 12px" }}>
        Study the Word. Fan the flame.
      </h1>
      <p className="muted" style={{ fontSize: "1.05rem" }}>
        Course materials, assignments, and class discussion for Ignite Seminary
        students — all in one place.
      </p>
      <p style={{ marginTop: 28 }}>
        <Link href="/login" className="btn" style={{ display: "inline-block" }}>
          Sign in to your courses
        </Link>
      </p>
    </div>
  );
}
