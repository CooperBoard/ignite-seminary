import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { gradeSubmission } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function GradeQueuePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();
  const isStaff = profile?.role === "admin" || profile?.role === "instructor";
  if (!isStaff) redirect(`/course/${params.id}`);

  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!course) notFound();

  const { data: modules } = await supabase
    .from("modules")
    .select("id, assignments ( id, title, points )")
    .eq("course_id", course.id);

  const assignments = (modules ?? []).flatMap((m: any) => m.assignments ?? []);
  const assignmentById = new Map(assignments.map((a: any) => [a.id, a]));
  const assignmentIds = assignments.map((a: any) => a.id);

  const { data: subs } = assignmentIds.length
    ? await supabase
        .from("submissions")
        .select("id, assignment_id, body, submitted_at, grade, feedback, graded_at, profiles!submissions_student_id_fkey ( full_name, email )")
        .in("assignment_id", assignmentIds)
        .order("submitted_at", { ascending: true })
    : { data: [] as any[] };

  const ungraded = (subs ?? []).filter((s: any) => !s.graded_at);
  const graded = (subs ?? []).filter((s: any) => s.graded_at);

  return (
    <div>
      <Link href={`/course/${course.id}`} className="muted">← {course.title}</Link>
      <h1 style={{ marginTop: 8 }}>Grading queue</h1>
      <p className="muted">
        {ungraded.length} awaiting grades · {graded.length} graded
      </p>

      {ungraded.length === 0 && (
        <div className="notice">Nothing waiting — every submission has been graded. 🎉</div>
      )}

      {ungraded.map((s: any) => {
        const a = assignmentById.get(s.assignment_id);
        return (
          <div key={s.id} className="card">
            <p className="eyebrow" style={{ marginTop: 0 }}>
              {a?.title ?? "Assignment"} · {s.profiles?.full_name || s.profiles?.email || "Student"}
              {" · "}submitted {new Date(s.submitted_at).toLocaleDateString()}
            </p>
            <p style={{ whiteSpace: "pre-wrap" }}>{s.body}</p>
            <form action={gradeSubmission} className="stack">
              <input type="hidden" name="submission_id" value={s.id} />
              <input type="hidden" name="course_id" value={course.id} />
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                <div style={{ width: 130 }}>
                  <label>Grade / {a?.points ?? 100}</label>
                  <input name="grade" type="number" min={0} max={a?.points ?? 100} required className="text-input" />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Feedback</label>
                  <input name="feedback" type="text" className="text-input" placeholder="Optional comment for the student" />
                </div>
              </div>
              <button type="submit">Save grade</button>
            </form>
          </div>
        );
      })}

      {graded.length > 0 && (
        <>
          <h2>Graded</h2>
          {graded.map((s: any) => {
            const a = assignmentById.get(s.assignment_id);
            return (
              <div key={s.id} className="item-row">
                <div>
                  <strong>{s.profiles?.full_name || s.profiles?.email}</strong>
                  <span className="muted"> — {a?.title}</span>
                  {s.feedback && <p className="muted" style={{ margin: "2px 0 0" }}>{s.feedback}</p>}
                </div>
                <span className="grade">{s.grade} / {a?.points ?? 100}</span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
