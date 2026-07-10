import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TranscriptView from "../transcript-view";

export const dynamic = "force-dynamic";

export default async function StudentTranscriptPage({
  params,
}: {
  params: { studentId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isStaff = me?.role === "admin" || me?.role === "instructor";
  if (!isStaff && params.studentId !== user.id) redirect("/transcript");

  const { data: student } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", params.studentId)
    .maybeSingle();
  if (!student) notFound();

  return (
    <TranscriptView
      studentId={student.id}
      studentName={student.full_name}
      studentEmail={student.email}
    />
  );
}
