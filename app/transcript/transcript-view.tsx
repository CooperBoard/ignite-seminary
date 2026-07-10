import { createClient } from "@/lib/supabase-server";
import { computeCourseGrade } from "@/lib/grades";

export default async function TranscriptView({
  studentId,
  studentName,
  studentEmail,
}: {
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
}) {
  const supabase = createClient();

  const [{ data: enrollments }, { data: certs }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("course_id, courses ( id, title, term, starts_on, ends_on, archived )")
      .eq("student_id", studentId),
    supabase.from("certificates").select("course_id, issued_at").eq("student_id", studentId),
  ]);

  const certByCourse = new Map((certs ?? []).map((c: any) => [c.course_id, c.issued_at]));
  const courses = (enrollments ?? [])
    .map((e: any) => e.courses)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.starts_on ?? "").localeCompare(b.starts_on ?? ""));

  const rows = await Promise.all(
    courses.map(async (c: any) => ({
      course: c,
      grade: await computeCourseGrade(supabase, c.id, studentId),
      certIssued: certByCourse.get(c.id) ?? null,
    }))
  );

  return (
    <div className="transcript">
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Ignite Seminary seal" width={90} height={90} style={{ margin: "0 auto 8px", display: "block" }} />
        <h1 style={{ margin: 0 }}>Academic Transcript</h1>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          {studentName || "Student"} · {studentEmail}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="notice">No course enrollments on record yet.</div>
      ) : (
        <table className="gradebook" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Course</th>
              <th>Term</th>
              <th>Dates</th>
              <th>Grade</th>
              <th>Certificate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ course, grade, certIssued }) => (
              <tr key={course.id}>
                <td>{course.title}</td>
                <td>{course.term ?? "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {course.starts_on ?? "?"} – {course.ends_on ?? "?"}
                </td>
                <td>
                  {grade.pct !== null ? (
                    <>
                      <strong>{grade.pct}%</strong>{" "}
                      <span className="muted">({grade.earned}/{grade.possible})</span>
                    </>
                  ) : (
                    <span className="muted">no graded work yet</span>
                  )}
                </td>
                <td>
                  {certIssued
                    ? `Issued ${new Date(certIssued).toLocaleDateString()}`
                    : course.archived
                      ? "—"
                      : "in progress"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="muted print-hide" style={{ marginTop: 16 }}>
        Grades reflect graded work to date. Quizzes weigh 100 points each.
      </p>
    </div>
  );
}
