import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin" && me?.role !== "instructor") {
    return NextResponse.json({ error: "Staff only" }, { status: 403 });
  }

  const { data: course } = await supabase.from("courses").select("id, title, term").eq("id", params.id).maybeSingle();
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: modules }, { data: enrollments }] = await Promise.all([
    supabase
      .from("modules")
      .select("id, position, assignments ( id, title, points ), quizzes ( id, title )")
      .eq("course_id", course.id)
      .order("position"),
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

  const header = [
    "Student",
    "Email",
    ...assignments.map((a: any) => `${a.title} (/${a.points})`),
    ...quizzes.map((q: any) => `${q.title} (quiz)`),
    "Total %",
  ];
  const rows = students.map((s: any) => {
    let earned = 0;
    let possible = 0;
    const cells: (string | number)[] = [s.full_name || "", s.email || ""];
    for (const a of assignments as any[]) {
      const sub = subKey.get(`${a.id}:${s.id}`);
      if (sub?.graded_at && typeof sub.grade === "number") {
        cells.push(sub.grade);
        earned += sub.grade;
        possible += a.points ?? 100;
      } else {
        cells.push(sub ? "submitted" : "");
      }
    }
    for (const q of quizzes as any[]) {
      const at = attKey.get(`${q.id}:${s.id}`);
      if (at && at.max_score > 0) {
        cells.push(`${at.score}/${at.max_score}`);
        earned += (at.score / at.max_score) * 100;
        possible += 100;
      } else {
        cells.push("");
      }
    }
    cells.push(possible > 0 ? Math.round((earned / possible) * 100) : "");
    return cells;
  });

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const filename = `${course.title.replace(/[^\w]+/g, "-")}-gradebook.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
