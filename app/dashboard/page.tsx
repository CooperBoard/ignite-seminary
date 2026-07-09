import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { updateName } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user!.id)
    .maybeSingle();

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, term, description, starts_on, ends_on")
    .order("starts_on", { ascending: true });

  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <div>
      <p className="eyebrow">{profile?.role === "student" ? "Student dashboard" : `${profile?.role ?? "Member"} dashboard`}</p>
      <h1 style={{ marginTop: 0 }}>
        {firstName ? `Welcome back, ${firstName}` : "Welcome"}
      </h1>

      {!profile?.full_name && (
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            Add your name so instructors and classmates know who you are.
          </p>
          <form action={updateName} className="stack">
            <div>
              <label htmlFor="full_name">Full name</label>
              <input id="full_name" name="full_name" type="text" required
                style={{ width: "100%", padding: "11px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: "0.95rem", fontFamily: "inherit" }} />
            </div>
            <button type="submit">Save name</button>
          </form>
        </div>
      )}

      <h2>Your courses</h2>
      {courses && courses.length > 0 ? (
        courses.map((c) => (
          <Link key={c.id} href={`/course/${c.id}`} style={{ display: "block", color: "inherit" }}>
            <div className="card" style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <h3 className="serif" style={{ margin: 0 }}>{c.title}</h3>
                {c.term && <span className="pill">{c.term}</span>}
              </div>
              {c.description && <p className="muted" style={{ marginBottom: 0 }}>{c.description}</p>}
            </div>
          </Link>
        ))
      ) : (
        <div className="notice">
          You&apos;re signed in, but you aren&apos;t enrolled in any courses yet.
          Contact the seminary office and they&apos;ll add you to your class roster —
          your courses will appear here automatically.
        </div>
      )}
    </div>
  );
}
