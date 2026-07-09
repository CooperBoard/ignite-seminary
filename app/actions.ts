"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export async function submitAssignment(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const assignmentId = String(formData.get("assignment_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!assignmentId || !body) return;

  const { data: existing } = await supabase
    .from("submissions")
    .select("id, graded_at")
    .eq("assignment_id", assignmentId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (existing && !existing.graded_at) {
    await supabase
      .from("submissions")
      .update({ body, submitted_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else if (!existing) {
    await supabase.from("submissions").insert({
      assignment_id: assignmentId,
      student_id: user.id,
      body,
    });
  }
  revalidatePath(`/course/${courseId}`);
}

export async function postToThread(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const threadId = String(formData.get("thread_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!threadId || !body) return;

  await supabase.from("discussion_posts").insert({
    thread_id: threadId,
    author_id: user.id,
    body,
  });
  revalidatePath(`/course/${courseId}`);
}

export async function updateName(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return;
  await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
  revalidatePath("/dashboard");
}
