import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { viewingAsStudent } from "@/lib/view-mode";
import { updateName, joinCourse } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams?: { join?: string };
}) {
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

  // Upcoming assignments across every course this user can see (RLS scopes
  // students to enrolled courses). Staff see everything, which is fine.
  const today = new Date().toISOString().slice(0, 10);
  const { data: upcoming } = await supabase
    .from("assignments")
    .select("id, title, due_on, points, modules!inner ( course_id, courses!inner ( id, title ) )")
    .gte("due_on", today)
    .order("due_on", { ascending: true })
    .limit(8);

  const upcomingIds = (upcoming ?? []).map((a: any) => a.id);
  const { data: mySubs } = upcomingIds.length
    ? await supabase
        .from("submissions")
        .select("assignment_id, graded_at")
        .in("assignment_id", upcomingIds)
        .eq("student_id", user!.id)
    : { data: [] as any[] };
  const subByAssignment = new Map((mySubs ?? []).map((s: any) => [s.assignment_id, s]));

  const firstName = profile?.full_name?.split(" ")[0];
  const studentView = viewingAsStudent();
  const isStudent = profile?.role === "student" || studentView;

  return (
    <div>
      <p className="eyebrow">
        {isStudent
          ? studentView
            ? "Student dashboard (viewing as student)"
            : "Student dashboard"
          : `${profile?.role ?? "Member"} dashboard`}
      </p>
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
              <input id="full_name" name="full_name" type="text" required className="text-input" />
            </div>
            <button type="submit">Save name</button>
          </form>
        </div>
      )}

      {(upcoming?.length ?? 0) > 0 && (
        <div className="card">
          <p className="eyebrow" style={{ marginTop: 0 }}>Due soon</p>
          {(upcoming ?? []).map((a: any) => {
            const sub = subByAssignment.get(a.id);
            const status = sub?.graded_at ? "graded" : sub ? "submitted" : null;
            return (
              <div key={a.id} className="item-row">
                <div>
                  <Link href={`/course/${a.modules?.courses?.id}`}>{a.title}</Link>
                  <span className="muted"> — {a.modules?.courses?.title}</span>
                </div>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {status && <span className="pill">{status}</span>}
                  <span className="muted">due {a.due_on}</span>
                </span>
              </div>
            );
          })}
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
          Enter your course code below to join your class.
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <p className="eyebrow" style={{ marginTop: 0 }}>Join a course</p>
        <p className="muted" style={{ marginTop: 0 }}>
          Your instructor will give you a course code.
        </p>
        {searchParams?.join === "invalid" && (
          <p style={{ color: "#b91c1c" }}>That code didn&apos;t match a course — double-check it and try again.</p>
        )}
        <form action={joinCourse} className="stack">
          <div>
            <label htmlFor="code">Course code</label>
            <input id="code" name="code" type="text" required placeholder="e.g. HERM2026" className="text-input" />
          </div>
          <button type="submit">Join course</button>
        </form>
      </div>
    </div>
  );
}
