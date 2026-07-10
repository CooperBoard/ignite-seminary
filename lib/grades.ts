import type { SupabaseClient } from "@supabase/supabase-js";

export type CourseGrade = {
  earned: number;
  possible: number; // graded work only — ungraded submissions don't count against you
  pct: number | null;
  gradedCount: number;
};

// Grade-so-far for one student in one course: graded assignment points +
// quiz scores (quizzes scale to 100 points each so they carry real weight).
const QUIZ_WEIGHT = 100;

export async function computeCourseGrade(
  supabase: SupabaseClient,
  courseId: string,
  studentId: string
): Promise<CourseGrade> {
  const { data: modules } = await supabase
    .from("modules")
    .select("id, assignments ( id, points ), quizzes ( id )")
    .eq("course_id", courseId);

  const assignments = (modules ?? []).flatMap((m: any) => m.assignments ?? []);
  const quizIds = (modules ?? []).flatMap((m: any) => (m.quizzes ?? []).map((q: any) => q.id));
  const assignmentIds = assignments.map((a: any) => a.id);
  const pointsByAssignment = new Map(assignments.map((a: any) => [a.id, a.points ?? 100]));

  const [{ data: subs }, { data: attempts }] = await Promise.all([
    assignmentIds.length
      ? supabase
          .from("submissions")
          .select("assignment_id, grade, graded_at")
          .in("assignment_id", assignmentIds)
          .eq("student_id", studentId)
      : Promise.resolve({ data: [] as any[] }),
    quizIds.length
      ? supabase
          .from("quiz_attempts")
          .select("quiz_id, score, max_score")
          .in("quiz_id", quizIds)
          .eq("student_id", studentId)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  let earned = 0;
  let possible = 0;
  let gradedCount = 0;

  for (const s of subs ?? []) {
    if (s.graded_at && typeof s.grade === "number") {
      earned += s.grade;
      possible += pointsByAssignment.get(s.assignment_id) ?? 100;
      gradedCount++;
    }
  }
  for (const a of attempts ?? []) {
    if (a.max_score > 0) {
      earned += (a.score / a.max_score) * QUIZ_WEIGHT;
      possible += QUIZ_WEIGHT;
      gradedCount++;
    }
  }

  return {
    earned: Math.round(earned),
    possible,
    pct: possible > 0 ? Math.round((earned / possible) * 100) : null,
    gradedCount,
  };
}
