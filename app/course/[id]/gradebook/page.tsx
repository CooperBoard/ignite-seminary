import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function GradebookPage({ params }: { params: { id: string } }) {
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

  const [{ data: modules }, { data: enrollments }] = await Promise.all([
    supabase
      .from("modules")
      .select("id, position, assignments ( id, title, points ), quizzes ( id, title )")
      .eq("course_id", course.id)
      .order("position", { ascending: true }),
    supabase
      .from("enrollments")
      .select("student_id, profiles!enrollments_student_id_fkey ( id, full_name, email )")
      .eq("course_id", course.id),
  ]);

  const assignments = (modules ?? []).flatMap((m: any) => m.assignments ?? []);
  const quizzes = (modules ?? []).flatMap((m: any) => m.quizzes ?? []);
  const students = (enrollments ?? [])
    .map((e: any) => e.profiles)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""));

  const assignmentIds = assignments.map((a: any) => a.id);
  const quizIds = quizzes.map((q: any) => q.id);

  const [{ data: subs }, { data: attempts }] = await Promise.all([
    assignmentIds.length
      ? supabase.from("submissions").select("assignment_id, student_id, grade, graded_at").in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [] as any[] }),
    quizIds.length
      ? supabase.from("quiz_attempts").select("quiz_id, student_id, score, max_score").in("quiz_id", quizIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const subKey = new Map((subs ?? []).map((s: any) => [`${s.assignment_id}:${s.student_id}`, s]));
  const attKey = new Map((attempts ?? []).map((a: any) => [`${a.quiz_id}:${a.student_id}`, a]));

  return (
    <div>
      <Link href={`/course/${course.id}`} className="muted">← {course.title}</Link>
      <h1 style={{ marginTop: 8 }}>Gradebook</h1>
      <p className="muted">{students.length} enrolled · {assignments.length} assignments · {quizzes.length} quizzes</p>

      {students.length === 0 ? (
        <div className="notice">No students enrolled yet — share the course code from the course page.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="gradebook">
            <thead>
              <tr>
                <th>Student</th>
                {assignments.map((a: any) => (
                  <th key={a.id} title={a.title}>{a.title.length > 14 ? a.title.slice(0, 13) + "…" : a.title}<br /><span className="muted">/{a.points}</span></th>
                ))}
                {quizzes.map((q: any) => (
                  <th key={q.id} title={q.title}>{q.title.length > 14 ? q.title.slice(0, 13) + "…" : q.title}<br /><span className="muted">quiz</span></th>
                ))}
                <th>Total<br /><span className="muted">graded</span></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s: any) => (
                <tr key={s.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{s.full_name || s.email}</td>
                  {assignments.map((a: any) => {
                    const sub = subKey.get(`${a.id}:${s.id}`);
                    return (
                      <td key={a.id}>
                        {sub?.graded_at ? `${sub.grade}` : sub ? "submitted" : "—"}
                      </td>
                    );
                  })}
                  {quizzes.map((q: any) => {
                    const at = attKey.get(`${q.id}:${s.id}`);
                    return <td key={q.id}>{at ? `${at.score}/${at.max_score}` : "—"}</td>;
                  })}
                  <td>
                    {(() => {
                      let earned = 0;
                      let possible = 0;
                      for (const a of assignments as any[]) {
                        const sub = subKey.get(`${a.id}:${s.id}`);
                        if (sub?.graded_at && typeof sub.grade === "number") {
                          earned += sub.grade;
                          possible += a.points ?? 100;
                        }
                      }
                      for (const q of quizzes as any[]) {
                        const at = attKey.get(`${q.id}:${s.id}`);
                        if (at && at.max_score > 0) {
                          earned += (at.score / at.max_score) * 100;
                          possible += 100;
                        }
                      }
                      return possible > 0 ? <strong>{Math.round((earned / possible) * 100)}%</strong> : "—";
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
