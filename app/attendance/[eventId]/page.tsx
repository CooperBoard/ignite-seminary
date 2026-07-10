import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { markAttendance } from "@/app/actions";

export const dynamic = "force-dynamic";

const STATUSES = [
  { value: "present", label: "Present", icon: "✓" },
  { value: "excused", label: "Excused", icon: "—" },
  { value: "absent", label: "Absent", icon: "✗" },
] as const;

export default async function AttendancePage({ params }: { params: { eventId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isStaff = me?.role === "admin" || me?.role === "instructor";
  if (!isStaff) redirect("/calendar");

  const { data: event } = await supabase
    .from("events")
    .select("id, title, starts_at, course_id, courses ( id, title )")
    .eq("id", params.eventId)
    .maybeSingle();
  if (!event || !event.course_id) notFound();

  const [{ data: roster }, { data: marks }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("student_id, profiles!enrollments_student_id_fkey ( id, full_name, email )")
      .eq("course_id", event.course_id),
    supabase.from("event_attendance").select("student_id, status").eq("event_id", event.id),
  ]);

  const statusByStudent = new Map((marks ?? []).map((m: any) => [m.student_id, m.status]));
  const students = (roster ?? [])
    .map((r: any) => r.profiles)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""));

  const counts = { present: 0, excused: 0, absent: 0 } as Record<string, number>;
  for (const s of statusByStudent.values()) counts[s] = (counts[s] ?? 0) + 1;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Link href="/calendar" className="muted">← Calendar</Link>
      <h1 style={{ marginTop: 8 }}>Attendance</h1>
      <p className="muted">
        {event.title} · {(event as any).courses?.title} ·{" "}
        {new Date(event.starts_at).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
        })}
      </p>
      <p className="muted">
        ✓ {counts.present} present · — {counts.excused} excused · ✗ {counts.absent} absent ·{" "}
        {students.length - statusByStudent.size} unmarked
      </p>

      <div className="card">
        {students.length === 0 && <p className="muted" style={{ margin: 0 }}>Nobody enrolled in this course yet.</p>}
        {students.map((s: any) => {
          const current = statusByStudent.get(s.id);
          return (
            <div key={s.id} className="item-row">
              <div>{s.full_name || s.email}</div>
              <span style={{ display: "flex", gap: 6 }}>
                {STATUSES.map((st) => (
                  <form key={st.value} action={markAttendance}>
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="student_id" value={s.id} />
                    <input type="hidden" name="status" value={st.value} />
                    <button
                      type="submit"
                      className={current === st.value ? "att-btn att-active" : "att-btn"}
                      title={st.label}
                    >
                      {st.icon} {st.label}
                    </button>
                  </form>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
