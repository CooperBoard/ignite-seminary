"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { sendEmail, courseEmail } from "@/lib/email";

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

  let isNew = false;
  if (existing && !existing.graded_at) {
    await supabase
      .from("submissions")
      .update({ body, submitted_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else if (!existing) {
    isNew = true;
    await supabase.from("submissions").insert({
      assignment_id: assignmentId,
      student_id: user.id,
      body,
    });
  }

  // Tell the instructor fresh work arrived (first submission only, not revisions)
  if (isNew) {
    const [{ data: course }, { data: student }] = await Promise.all([
      supabase
        .from("courses")
        .select("id, title, instructor:profiles!courses_instructor_id_fkey ( email, full_name )")
        .eq("id", courseId)
        .maybeSingle(),
      supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    ]);
    const instructorEmail = (course as any)?.instructor?.email;
    if (instructorEmail && course) {
      const who = student?.full_name || student?.email || "A student";
      await sendEmail(
        [instructorEmail],
        `New submission — ${course.title}`,
        courseEmail({
          heading: `${who} submitted work`,
          body: `A new submission is waiting in the grading queue for ${course.title}.`,
          courseTitle: course.title,
          courseId: course.id,
        })
      );
    }
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

// ── Admin console ───────────────────────────────────────────────
// RLS (is_admin / is_staff) is the real gate on all of these.

export async function setUserRole(formData: FormData) {
  const supabase = createClient();
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || !["admin", "instructor", "student"].includes(role)) return;
  await supabase.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/admin");
}

export async function createCourse(formData: FormData) {
  const supabase = createClient();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const term = String(formData.get("term") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const startsOn = String(formData.get("starts_on") ?? "").trim() || null;
  const endsOn = String(formData.get("ends_on") ?? "").trim() || null;
  const enrollCode = String(formData.get("enroll_code") ?? "").trim().toUpperCase() || null;
  await supabase.from("courses").insert({
    title,
    term,
    description,
    starts_on: startsOn,
    ends_on: endsOn,
    enroll_code: enrollCode,
  });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function updateCourse(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("course_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!id || !title) return;
  const term = String(formData.get("term") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const startsOn = String(formData.get("starts_on") ?? "").trim() || null;
  const endsOn = String(formData.get("ends_on") ?? "").trim() || null;
  const enrollCode = String(formData.get("enroll_code") ?? "").trim().toUpperCase() || null;
  const instructorId = String(formData.get("instructor_id") ?? "").trim() || null;
  const archived = String(formData.get("archived") ?? "") === "true";
  await supabase
    .from("courses")
    .update({
      title,
      term,
      description,
      starts_on: startsOn,
      ends_on: endsOn,
      enroll_code: enrollCode,
      instructor_id: instructorId,
      archived,
    })
    .eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath(`/course/${id}`);
}

export async function addEnrollmentByEmail(formData: FormData) {
  const supabase = createClient();
  const courseId = String(formData.get("course_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!courseId || !email) return;
  const { data: person } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (!person) {
    redirect(`/admin?enroll=notfound&email=${encodeURIComponent(email)}`);
  }
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", courseId)
    .eq("student_id", person!.id)
    .maybeSingle();
  if (!existing) {
    await supabase.from("enrollments").insert({ course_id: courseId, student_id: person!.id });
  }
  revalidatePath("/admin");
}

export async function removeEnrollment(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("enrollment_id") ?? "");
  if (!id) return;
  await supabase.from("enrollments").delete().eq("id", id);
  revalidatePath("/admin");
}

// ── Private messages ────────────────────────────────────────────

export async function sendMessage(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const recipientId = String(formData.get("recipient_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!recipientId || !body || recipientId === user.id) return;

  const { error } = await supabase
    .from("messages")
    .insert({ sender_id: user.id, recipient_id: recipientId, body });
  if (error) return;

  // Nudge the recipient by email — the conversation itself lives in the app
  const [{ data: recipient }, { data: sender }] = await Promise.all([
    supabase.from("profiles").select("email, full_name").eq("id", recipientId).maybeSingle(),
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
  ]);
  if (recipient?.email) {
    const senderName = sender?.full_name || sender?.email || "A classmate";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://seminary.ignitemb.com";
    await sendEmail(
      [recipient.email],
      `New message from ${senderName}`,
      `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#241b35">
        <p><strong>${senderName}</strong> sent you a message on Ignite Seminary:</p>
        <blockquote style="border-left:3px solid #4c1d95;margin:12px 0;padding:6px 14px;white-space:pre-wrap">${body
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</blockquote>
        <p><a href="${appUrl}/messages/${user.id}" style="background:#4c1d95;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Reply in the app</a></p>
      </div>`
    );
  }

  revalidatePath(`/messages/${recipientId}`);
  revalidatePath("/messages");
}

// ── Tuition ─────────────────────────────────────────────────────

export async function addTuitionCharge(formData: FormData) {
  const supabase = createClient();
  const description = String(formData.get("description") ?? "").trim();
  const amount = Math.round(Number(formData.get("amount") ?? 0) * 100);
  if (!description || !amount || amount < 0) return;
  const dueOn = String(formData.get("due_on") ?? "").trim() || null;
  const courseId = String(formData.get("course_id") ?? "").trim() || null;
  const studentId = String(formData.get("student_id") ?? "").trim() || null;

  if (studentId) {
    await supabase.from("tuition_charges").insert({
      student_id: studentId,
      course_id: courseId,
      description,
      amount_cents: amount,
      due_on: dueOn,
    });
  } else if (courseId) {
    // Bill every enrolled student in the course
    const { data: roster } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("course_id", courseId);
    const rows = (roster ?? []).map((r: any) => ({
      student_id: r.student_id,
      course_id: courseId,
      description,
      amount_cents: amount,
      due_on: dueOn,
    }));
    if (rows.length) await supabase.from("tuition_charges").insert(rows);
  }
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function setTuitionStatus(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("charge_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["unpaid", "paid", "waived"].includes(status)) return;
  await supabase
    .from("tuition_charges")
    .update({ status, paid_on: status === "paid" ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function deleteTuitionCharge(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("charge_id") ?? "");
  if (!id) return;
  await supabase.from("tuition_charges").delete().eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

// ── Attendance ──────────────────────────────────────────────────

export async function markAttendance(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const eventId = String(formData.get("event_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!eventId || !studentId || !["present", "absent", "excused"].includes(status)) return;
  await supabase
    .from("event_attendance")
    .upsert(
      { event_id: eventId, student_id: studentId, status, marked_by: user.id, marked_at: new Date().toISOString() },
      { onConflict: "event_id,student_id" }
    );
  revalidatePath(`/attendance/${eventId}`);
}

// ── Calendar events ─────────────────────────────────────────────

export async function createEvent(formData: FormData) {
  const supabase = createClient();
  const title = String(formData.get("title") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  if (!title || !startsAt) return;
  const kind = String(formData.get("kind") ?? "event") === "class" ? "class" : "event";
  const courseId = String(formData.get("course_id") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  await supabase.from("events").insert({
    title,
    kind,
    course_id: courseId,
    location,
    description,
    starts_at: new Date(startsAt).toISOString(),
  });
  revalidatePath("/calendar");
}

export async function deleteEvent(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("event_id") ?? "");
  if (!id) return;
  await supabase.from("events").delete().eq("id", id);
  revalidatePath("/calendar");
}

// ── View mode (staff ⇄ student) ─────────────────────────────────

export async function setViewMode(formData: FormData) {
  const { cookies } = await import("next/headers");
  const mode = String(formData.get("mode") ?? "staff");
  const path = String(formData.get("path") ?? "/dashboard");
  cookies().set("ignite_view_mode", mode === "student" ? "student" : "staff", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath(path);
}

// ── Sign-in confirmation (token-hash flow) ──────────────────────
// Verification happens on a button press, not on page load, so email
// security scanners that pre-open links can't burn the one-time token.

export async function confirmSignIn(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "email");
  if (!tokenHash) redirect("/login?error=expired");

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: type as any,
    token_hash: tokenHash,
  });
  if (error) redirect("/login?error=expired");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").upsert(
      { id: user.id, email: user.email ?? null },
      { onConflict: "id", ignoreDuplicates: true }
    );
  }
  redirect("/dashboard");
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

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB — photos and documents only.
// Video files are intentionally NOT uploadable: hosting video is very costly
// (storage + bandwidth per view), while YouTube/Vimeo embed for free.

export async function addMaterial(formData: FormData) {
  const supabase = createClient();
  const moduleId = String(formData.get("module_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!moduleId || !title) return;
  const kind = String(formData.get("kind") ?? "link");
  let url = String(formData.get("url") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim() || null;
  const position = Number(formData.get("position") ?? 0);

  // Optional direct upload (photos, PDFs, docs) → public course-media bucket
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) return;
    const safeName = (file.name || "upload").replace(/[^\w.\- ]+/g, "_").slice(-120);
    const path = `${courseId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage
      .from("course-media")
      .upload(path, file, { contentType: file.type || undefined });
    if (error) return;
    url = supabase.storage.from("course-media").getPublicUrl(path).data.publicUrl;
  }

  await supabase.from("materials").insert({ module_id: moduleId, title, kind, url, body, position });
  revalidatePath(`/course/${courseId}`);
}

export async function deleteMaterial(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("material_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  if (!id) return;
  // If this material's file lives in our bucket, clean it up too
  const { data: mat } = await supabase.from("materials").select("url").eq("id", id).maybeSingle();
  const marker = "/object/public/course-media/";
  if (mat?.url && mat.url.includes(marker)) {
    const path = decodeURIComponent(mat.url.split(marker)[1] ?? "");
    if (path) await supabase.storage.from("course-media").remove([path]);
  }
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

  // Email every enrolled student (poster is staff, so RLS allows these reads)
  const [{ data: course }, { data: enrolled }] = await Promise.all([
    supabase.from("courses").select("title").eq("id", courseId).maybeSingle(),
    supabase
      .from("enrollments")
      .select("profiles!enrollments_student_id_fkey ( email )")
      .eq("course_id", courseId),
  ]);
  const emails = (enrolled ?? [])
    .map((e: any) => e.profiles?.email)
    .filter(Boolean) as string[];
  await sendEmail(
    emails,
    `${course?.title ?? "Course"} — ${title}`,
    courseEmail({
      heading: title,
      body: body ?? "",
      courseTitle: course?.title ?? "Course",
      courseId,
    })
  );

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

  // Notify the student their grade posted
  const { data: sub } = await supabase
    .from("submissions")
    .select(
      "assignment_id, profiles!submissions_student_id_fkey ( email ), assignments ( title, points, modules ( course_id, courses ( id, title ) ) )"
    )
    .eq("id", id)
    .maybeSingle();
  const studentEmail = (sub as any)?.profiles?.email;
  const a = (sub as any)?.assignments;
  const c = a?.modules?.courses;
  if (studentEmail && c) {
    await sendEmail(
      [studentEmail],
      `Grade posted — ${a.title}`,
      courseEmail({
        heading: `Grade posted: ${grade} / ${a.points}`,
        body: feedback ? `Feedback from your instructor:\n\n${feedback}` : "Sign in to review your graded work.",
        courseTitle: c.title,
        courseId: c.id,
      })
    );
  }

  revalidatePath(`/course/${courseId}/grade`);
  revalidatePath(`/course/${courseId}`);
}

// ── Quizzes ─────────────────────────────────────────────────────

export async function createQuiz(formData: FormData) {
  const supabase = createClient();
  const moduleId = String(formData.get("module_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!moduleId || !title) return;
  const description = String(formData.get("description") ?? "").trim() || null;
  const dueOn = String(formData.get("due_on") ?? "").trim() || null;
  await supabase.from("quizzes").insert({ module_id: moduleId, title, description, due_on: dueOn });
  revalidatePath(`/course/${courseId}`);
}

export async function deleteQuiz(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("quiz_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  if (!id) return;
  await supabase.from("quizzes").delete().eq("id", id);
  revalidatePath(`/course/${courseId}`);
}

export async function addQuizQuestion(formData: FormData) {
  const supabase = createClient();
  const quizId = String(formData.get("quiz_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!quizId || !prompt) return;
  const options = [
    String(formData.get("option_0") ?? "").trim(),
    String(formData.get("option_1") ?? "").trim(),
    String(formData.get("option_2") ?? "").trim(),
    String(formData.get("option_3") ?? "").trim(),
  ].filter(Boolean);
  if (options.length < 2) return;
  const correctIndex = Number(formData.get("correct_index") ?? 0);
  if (correctIndex < 0 || correctIndex >= options.length) return;
  const position = Number(formData.get("position") ?? 0);
  await supabase.from("quiz_questions").insert({
    quiz_id: quizId,
    prompt,
    options,
    correct_index: correctIndex,
    position,
  });
  revalidatePath(`/course/${courseId}`);
}

export async function deleteQuizQuestion(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("question_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  if (!id) return;
  await supabase.from("quiz_questions").delete().eq("id", id);
  revalidatePath(`/course/${courseId}`);
}

export async function submitQuiz(formData: FormData) {
  const supabase = createClient();
  const quizId = String(formData.get("quiz_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const count = Number(formData.get("question_count") ?? 0);
  if (!quizId || !count) return;
  const answers: number[] = [];
  for (let i = 0; i < count; i++) {
    const v = formData.get(`q_${i}`);
    if (v === null) return; // unanswered question — form requires all
    answers.push(Number(v));
  }
  await supabase.rpc("submit_quiz", { p_quiz_id: quizId, p_answers: answers });
  revalidatePath(`/course/${courseId}`);
}

// ── Completion tracking ─────────────────────────────────────────

export async function toggleMaterialDone(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const materialId = String(formData.get("material_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const done = String(formData.get("done") ?? "") === "true";
  if (!materialId) return;
  if (done) {
    await supabase
      .from("material_completions")
      .delete()
      .eq("material_id", materialId)
      .eq("student_id", user.id);
  } else {
    await supabase
      .from("material_completions")
      .insert({ material_id: materialId, student_id: user.id });
  }
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
