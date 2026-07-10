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
    .select("id, title, term, description, starts_on, ends_on, archived")
    .order("starts_on", { ascending: true });

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentCourses = (courses ?? []).filter(
    (c: any) => !c.archived && (!c.ends_on || c.ends_on >= todayStr)
  );
  const pastCourses = (courses ?? []).filter(
    (c: any) => c.archived || (c.ends_on && c.ends_on < todayStr)
  );

  // Upcoming assignments across every course this user can see (RLS scopes
  // students to enrolled courses). Staff see everything, which is fine.
  const today = new Date().toISOString().slice(0, 10);
  const { data: upcoming } = await supabase
    .from("assignments")
    .select("id, title, due_on, points, modules!inner ( course_id, courses!inner ( id, title ) )")
    .gte("due_on", today)
    .order("due_on", { ascending: true })
    .limit(8);

  const [{ data: tuition }, { data: giveCfg }] = await Promise.all([
    supabase
      .from("tuition_charges")
      .select("id, description, amount_cents, due_on, status, paid_on")
      .eq("student_id", user!.id)
      .order("due_on", { ascending: true }),
    supabase.from("app_config").select("value").eq("key", "subsplash_url").maybeSingle(),
  ]);
  const subsplashUrl = giveCfg?.value ?? "https://ignitemb.com/give";
  const unpaid = (tuition ?? []).filter((t: any) => t.status === "unpaid");
  const balanceCents = unpaid.reduce((sum: number, t: any) => sum + t.amount_cents, 0);

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

      {(tuition?.length ?? 0) > 0 && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <p className="eyebrow" style={{ margin: 0 }}>Tuition</p>
            {balanceCents > 0 ? (
              <span style={{ fontWeight: 700 }}>Balance: ${(balanceCents / 100).toFixed(2)}</span>
            ) : (
              <span className="pill">Paid in full</span>
            )}
          </div>
          {(tuition ?? []).map((t: any) => (
            <div key={t.id} className="item-row">
              <div>
                {t.description}
                {t.due_on && t.status === "unpaid" && (
                  <span className="muted"> — due {t.due_on}</span>
                )}
                {t.status === "paid" && t.paid_on && (
                  <span className="muted"> — paid {t.paid_on}</span>
                )}
              </div>
              <span style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
                <span>${(t.amount_cents / 100).toFixed(2)}</span>
                <span className="pill">{t.status}</span>
              </span>
            </div>
          ))}
          {balanceCents > 0 && (
            <div style={{ marginTop: 12 }}>
              <a href={subsplashUrl} target="_blank" rel="noreferrer" className="btn" style={{ display: "inline-block" }}>
                💜 Pay tuition via Subsplash
              </a>
              <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>
                Payments are processed through our church giving platform. Once your payment
                posts, the seminary office will mark it here — allow a day or two.
              </p>
            </div>
          )}
        </div>
      )}

      <h2>Your courses</h2>
      {currentCourses.length > 0 ? (
        currentCourses.map((c: any) => (
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

      {pastCourses.length > 0 && (
        <>
          <h2>Past courses</h2>
          {pastCourses.map((c: any) => (
            <Link key={c.id} href={`/course/${c.id}`} style={{ display: "block", color: "inherit" }}>
              <div className="card" style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <h3 className="serif" style={{ margin: 0 }}>{c.title}</h3>
                  <span className="pill">{c.term ?? "past"}</span>
                </div>
              </div>
            </Link>
          ))}
        </>
      )}

      <p className="muted" style={{ marginTop: 24, fontSize: "0.85rem" }}>
        📲 Tip: add this to your phone&apos;s home screen for one-tap access — in Safari or Chrome,
        tap Share, then &quot;Add to Home Screen.&quot;
      </p>

      <p style={{ marginTop: 12 }}>
        <Link href="/calendar">📅 Calendar</Link>
        {" · "}
        <Link href="/transcript">📜 View your transcript</Link>
        {" · "}
        <Link href="/account/password">🔑 Change password</Link>
        {profile?.role === "admin" && (
          <>
            {" · "}
            <Link href="/admin">⚙ Admin console</Link>
          </>
        )}
      </p>

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
