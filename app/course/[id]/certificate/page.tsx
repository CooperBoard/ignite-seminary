import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import PrintButton from "@/app/course/[id]/certificate/print-button";

export const dynamic = "force-dynamic";

export default async function CertificatePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: course }, { data: profile }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, term, starts_on, ends_on")
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("profiles").select("full_name, role").eq("id", user!.id).maybeSingle(),
  ]);
  if (!course) notFound();

  // Recompute completion server-side — the certificate is only for finishers
  const { data: modules } = await supabase
    .from("modules")
    .select("id, materials ( id ), assignments ( id ), quizzes ( id )")
    .eq("course_id", course.id);

  const materialIds = (modules ?? []).flatMap((m: any) => (m.materials ?? []).map((x: any) => x.id));
  const assignmentIds = (modules ?? []).flatMap((m: any) => (m.assignments ?? []).map((x: any) => x.id));
  const quizIds = (modules ?? []).flatMap((m: any) => (m.quizzes ?? []).map((x: any) => x.id));

  const [{ data: done }, { data: subs }, { data: attempts }] = await Promise.all([
    materialIds.length
      ? supabase.from("material_completions").select("material_id").in("material_id", materialIds).eq("student_id", user!.id)
      : Promise.resolve({ data: [] as any[] }),
    assignmentIds.length
      ? supabase.from("submissions").select("assignment_id").in("assignment_id", assignmentIds).eq("student_id", user!.id)
      : Promise.resolve({ data: [] as any[] }),
    quizIds.length
      ? supabase.from("quiz_attempts").select("quiz_id").in("quiz_id", quizIds).eq("student_id", user!.id)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const total = materialIds.length + assignmentIds.length + quizIds.length;
  const doneCount =
    (done ?? []).length + new Set((subs ?? []).map((s: any) => s.assignment_id)).size + (attempts ?? []).length;
  const complete = total > 0 && doneCount >= total;

  if (!complete) {
    return (
      <div style={{ maxWidth: 560, margin: "40px auto 0", textAlign: "center" }}>
        <h1>Not quite there yet</h1>
        <p className="muted">
          You&apos;ve completed {doneCount} of {total} items in {course.title}. Finish the rest and
          your certificate will be waiting.
        </p>
        <p><Link href={`/course/${course.id}`} className="btn" style={{ display: "inline-block" }}>Back to the course</Link></p>
      </div>
    );
  }

  // Record it (idempotent via unique constraint; ignore duplicate error)
  const { data: existing } = await supabase
    .from("certificates")
    .select("id, issued_at")
    .eq("course_id", course.id)
    .eq("student_id", user!.id)
    .maybeSingle();
  let issuedAt = existing?.issued_at;
  if (!existing) {
    const { data: created } = await supabase
      .from("certificates")
      .insert({ course_id: course.id, student_id: user!.id })
      .select("issued_at")
      .maybeSingle();
    issuedAt = created?.issued_at ?? new Date().toISOString();
  }

  const issued = new Date(issuedAt!).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div>
      <div className="print-hide" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Link href={`/course/${course.id}`} className="muted">← Back to the course</Link>
        <PrintButton />
      </div>

      <div className="certificate">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Ignite Seminary seal" width={130} height={130} style={{ margin: "0 auto 12px", display: "block" }} />
        <p className="cert-eyebrow">Ignite Seminary</p>
        <p className="cert-line">certifies that</p>
        <p className="cert-name">{profile?.full_name || "Student"}</p>
        <p className="cert-line">has successfully completed</p>
        <p className="cert-course">{course.title}</p>
        <p className="cert-line">
          {course.term ?? ""}
          {course.starts_on && course.ends_on ? ` · ${course.starts_on} to ${course.ends_on}` : ""}
        </p>
        <p className="cert-issued">Issued {issued}</p>
        <div className="cert-rule" />
        <p className="cert-footer">Biblical Training · Missions · Church Planting</p>
      </div>
    </div>
  );
}
