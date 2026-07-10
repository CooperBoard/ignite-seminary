import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import {
  setUserRole,
  createCourse,
  updateCourse,
  addEnrollmentByEmail,
  removeEnrollment,
} from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: { enroll?: string; email?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();
  if (me?.role !== "admin") redirect("/dashboard");

  const [{ data: people }, { data: courses }, { data: enrollments }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, created_at").order("created_at"),
    supabase.from("courses").select("*").order("starts_on", { ascending: false }),
    supabase
      .from("enrollments")
      .select("id, course_id, profiles!enrollments_student_id_fkey ( id, full_name, email )"),
  ]);

  const staff = (people ?? []).filter((p: any) => p.role === "admin" || p.role === "instructor");
  const rosterByCourse = new Map<string, any[]>();
  for (const e of enrollments ?? []) {
    const arr = rosterByCourse.get(e.course_id) ?? [];
    arr.push(e);
    rosterByCourse.set(e.course_id, arr);
  }

  return (
    <div>
      <p className="eyebrow">Seminary administration</p>
      <h1 style={{ marginTop: 0 }}>Admin console</h1>

      <h2>People</h2>
      <div className="card">
        {(people ?? []).map((p: any) => (
          <div key={p.id} className="item-row">
            <div>
              <strong>{p.full_name || "(no name yet)"}</strong>
              <span className="muted"> — {p.email}</span>
              <p className="muted" style={{ margin: "2px 0 0" }}>
                <Link href={`/transcript/${p.id}`}>Transcript</Link>
              </p>
            </div>
            <form action={setUserRole} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="hidden" name="user_id" value={p.id} />
              <select name="role" defaultValue={p.role} className="text-input" style={{ width: 130, padding: "6px 8px" }}>
                <option value="student">student</option>
                <option value="instructor">instructor</option>
                <option value="admin">admin</option>
              </select>
              <button type="submit" className="ghost-ink">Save</button>
            </form>
          </div>
        ))}
      </div>

      <h2>Courses</h2>
      {(courses ?? []).map((c: any) => {
        const roster = (rosterByCourse.get(c.id) ?? []).sort((a: any, b: any) =>
          (a.profiles?.full_name || a.profiles?.email || "").localeCompare(
            b.profiles?.full_name || b.profiles?.email || ""
          )
        );
        return (
          <div key={c.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <h3 className="serif" style={{ margin: 0 }}>
                <Link href={`/course/${c.id}`}>{c.title}</Link>
                {c.archived && <span className="pill" style={{ marginLeft: 8 }}>archived</span>}
              </h3>
              <span className="muted">{roster.length} enrolled</span>
            </div>

            <details style={{ marginTop: 10 }}>
              <summary className="muted" style={{ cursor: "pointer" }}>Edit course</summary>
              <form action={updateCourse} className="stack" style={{ marginTop: 10 }}>
                <input type="hidden" name="course_id" value={c.id} />
                <div>
                  <label>Title</label>
                  <input name="title" type="text" required defaultValue={c.title} className="text-input" />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label>Term</label>
                    <input name="term" type="text" defaultValue={c.term ?? ""} className="text-input" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Enroll code</label>
                    <input name="enroll_code" type="text" defaultValue={c.enroll_code ?? ""} className="text-input" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label>Starts</label>
                    <input name="starts_on" type="date" defaultValue={c.starts_on ?? ""} className="text-input" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Ends</label>
                    <input name="ends_on" type="date" defaultValue={c.ends_on ?? ""} className="text-input" />
                  </div>
                </div>
                <div>
                  <label>Description</label>
                  <textarea name="description" defaultValue={c.description ?? ""} />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label>Instructor</label>
                    <select name="instructor_id" defaultValue={c.instructor_id ?? ""} className="text-input">
                      <option value="">— none —</option>
                      {staff.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Status</label>
                    <select name="archived" defaultValue={String(c.archived)} className="text-input">
                      <option value="false">active</option>
                      <option value="true">archived</option>
                    </select>
                  </div>
                </div>
                <button type="submit">Save course</button>
              </form>
            </details>

            <details style={{ marginTop: 8 }}>
              <summary className="muted" style={{ cursor: "pointer" }}>Roster ({roster.length})</summary>
              <div style={{ marginTop: 10 }}>
                {roster.map((e: any) => (
                  <div key={e.id} className="item-row">
                    <div>
                      {e.profiles?.full_name || e.profiles?.email}
                      <span className="muted"> — {e.profiles?.email}</span>
                    </div>
                    <form action={removeEnrollment}>
                      <input type="hidden" name="enrollment_id" value={e.id} />
                      <button type="submit" className="ghost-ink">Remove</button>
                    </form>
                  </div>
                ))}
                {roster.length === 0 && <p className="muted">Nobody enrolled yet.</p>}
                {searchParams?.enroll === "notfound" && (
                  <p style={{ color: "#b91c1c" }}>
                    No account found for {searchParams.email} — they need to sign in once first.
                  </p>
                )}
                <form action={addEnrollmentByEmail} className="stack" style={{ marginTop: 10 }}>
                  <input type="hidden" name="course_id" value={c.id} />
                  <div>
                    <label>Add student by email (must have signed in at least once)</label>
                    <input name="email" type="email" required className="text-input" placeholder="student@example.com" />
                  </div>
                  <button type="submit">Add to roster</button>
                </form>
              </div>
            </details>
          </div>
        );
      })}

      <h2>New course</h2>
      <div className="card">
        <form action={createCourse} className="stack">
          <div>
            <label>Title</label>
            <input name="title" type="text" required className="text-input" />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Term (e.g. Spring 2027)</label>
              <input name="term" type="text" className="text-input" />
            </div>
            <div style={{ flex: 1 }}>
              <label>Enroll code (e.g. GREEK2027)</label>
              <input name="enroll_code" type="text" className="text-input" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Starts</label>
              <input name="starts_on" type="date" className="text-input" />
            </div>
            <div style={{ flex: 1 }}>
              <label>Ends</label>
              <input name="ends_on" type="date" className="text-input" />
            </div>
          </div>
          <div>
            <label>Description</label>
            <textarea name="description" />
          </div>
          <button type="submit">Create course</button>
        </form>
      </div>
    </div>
  );
}
