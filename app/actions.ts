"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

// ── Enrollment ──────────────────────────────────────────────────

export async function joinCourse(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return;
  const { data: courseId, error } = await supabase.rpc("enroll_with_code", { code });
  if (error || !courseId) {
    redirect("/dashboard?join=invalid");
  }
  revalidatePath("/dashboard");
  redirect(`/course/${courseId}`);
}

// ── Instructor: course content ──────────────────────────────────
// RLS (is_staff) is the real gate on all of these.

export async function addModule(formData: FormData) {
  const supabase = createClient();
  const courseId = String(formData.get("course_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!courseId || !title) return;
  const position = Number(formData.get("position") ?? 0);
  const subtitle = String(formData.get("subtitle") ?? "").trim() || null;
  await supabase.from("modules").insert({ course_id: courseId, title, subtitle, position });
  revalidatePath(`/course/${courseId}`);
}

export async function updateModule(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("module_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!id || !title) return;
  const subtitle = String(formData.get("subtitle") ?? "").trim() || null;
  const position = Number(formData.get("position") ?? 0);
  await supabase.from("modules").update({ title, subtitle, position }).eq("id", id);
  revalidatePath(`/course/${courseId}`);
}

export async function deleteModule(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("module_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  if (!id) return;
  await supabase.from("modules").delete().eq("id", id);
  revalidatePath(`/course/${courseId}`);
}

export async function addMaterial(formData: FormData) {
  const supabase = createClient();
  const moduleId = String(formData.get("module_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!moduleId || !title) return;
  const kind = String(formData.get("kind") ?? "link");
  const url = String(formData.get("url") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim() || null;
  const position = Number(formData.get("position") ?? 0);
  await supabase.from("materials").insert({ module_id: moduleId, title, kind, url, body, position });
  revalidatePath(`/course/${courseId}`);
}

export async function deleteMaterial(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("material_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  if (!id) return;
  await supabase.from("materials").delete().eq("id", id);
  revalidatePath(`/course/${courseId}`);
}

export async function addAssignment(formData: FormData) {
  const supabase = createClient();
  const moduleId = String(formData.get("module_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!moduleId || !title) return;
  const instructions = String(formData.get("instructions") ?? "").trim() || null;
  const points = Number(formData.get("points") ?? 100) || 100;
  const dueOn = String(formData.get("due_on") ?? "").trim() || null;
  await supabase
    .from("assignments")
    .insert({ module_id: moduleId, title, instructions, points, due_on: dueOn });
  revalidatePath(`/course/${courseId}`);
}

export async function updateAssignment(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("assignment_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!id || !title) return;
  const instructions = String(formData.get("instructions") ?? "").trim() || null;
  const points = Number(formData.get("points") ?? 100) || 100;
  const dueOn = String(formData.get("due_on") ?? "").trim() || null;
  await supabase
    .from("assignments")
    .update({ title, instructions, points, due_on: dueOn })
    .eq("id", id);
  revalidatePath(`/course/${courseId}`);
}

export async function deleteAssignment(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("assignment_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  if (!id) return;
  await supabase.from("assignments").delete().eq("id", id);
  revalidatePath(`/course/${courseId}`);
}

export async function addThread(formData: FormData) {
  const supabase = createClient();
  const moduleId = String(formData.get("module_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!moduleId || !title) return;
  const prompt = String(formData.get("prompt") ?? "").trim() || null;
  await supabase.from("discussion_threads").insert({ module_id: moduleId, title, prompt });
  revalidatePath(`/course/${courseId}`);
}

export async function deleteThread(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("thread_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  if (!id) return;
  await supabase.from("discussion_threads").delete().eq("id", id);
  revalidatePath(`/course/${courseId}`);
}

// ── Instructor: announcements + grading ─────────────────────────

export async function postAnnouncement(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const courseId = String(formData.get("course_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!courseId || !title) return;
  const body = String(formData.get("body") ?? "").trim() || null;
  await supabase
    .from("announcements")
    .insert({ course_id: courseId, author_id: user.id, title, body });
  revalidatePath(`/course/${courseId}`);
}

export async function deleteAnnouncement(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("announcement_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  if (!id) return;
  await supabase.from("announcements").delete().eq("id", id);
  revalidatePath(`/course/${courseId}`);
}

export async function gradeSubmission(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const id = String(formData.get("submission_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const grade = Number(formData.get("grade"));
  if (!id || Number.isNaN(grade)) return;
  const feedback = String(formData.get("feedback") ?? "").trim() || null;
  await supabase
    .from("submissions")
    .update({ grade, feedback, graded_at: new Date().toISOString(), graded_by: user.id })
    .eq("id", id);
  revalidatePath(`/course/${courseId}/grade`);
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
