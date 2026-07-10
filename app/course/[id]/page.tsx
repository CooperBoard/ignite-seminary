import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import {
  submitAssignment,
  postToThread,
  addModule,
  updateModule,
  deleteModule,
  addMaterial,
  deleteMaterial,
  addAssignment,
  updateAssignment,
  deleteAssignment,
  addThread,
  deleteThread,
  postAnnouncement,
  deleteAnnouncement,
} from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: course }, { data: profile }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, term, description, starts_on, ends_on, enroll_code")
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user!.id).maybeSingle(),
  ]);

  if (!course) notFound();
  const isStaff = profile?.role === "admin" || profile?.role === "instructor";

  const [{ data: modules }, { data: announcements }] = await Promise.all([
    supabase
      .from("modules")
      .select(`
        id, position, title, subtitle,
        materials ( id, position, title, kind, url, body ),
        assignments ( id, title, instructions, points, due_on ),
        discussion_threads (
          id, title, prompt,
          discussion_posts ( id, body, created_at, author_id, profiles ( full_name, email ) )
        )
      `)
      .eq("course_id", course.id)
      .order("position", { ascending: true }),
    supabase
      .from("announcements")
      .select("id, title, body, created_at")
      .eq("course_id", course.id)
      .order("created_at", { ascending: false }),
  ]);

  const assignmentIds =
    modules?.flatMap((m: any) => (m.assignments ?? []).map((a: any) => a.id)) ?? [];
  const { data: mySubs } = assignmentIds.length
    ? await supabase
        .from("submissions")
        .select("assignment_id, body, submitted_at, grade, feedback, graded_at")
        .in("assignment_id", assignmentIds)
        .eq("student_id", user!.id)
    : { data: [] as any[] };

  const subByAssignment = new Map((mySubs ?? []).map((s: any) => [s.assignment_id, s]));

  return (
    <div>
      <p className="eyebrow">{course.term ?? "Course"}</p>
      <h1 style={{ marginTop: 0 }}>{course.title}</h1>
      {course.description && <p className="muted">{course.description}</p>}

      {isStaff && (
        <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>Instructor tools</p>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Course code for students to join: <strong>{course.enroll_code ?? "—"}</strong>
            </p>
          </div>
          <Link href={`/course/${course.id}/grade`} className="btn" style={{ display: "inline-block" }}>
            Grading queue
          </Link>
        </div>
      )}

      {(announcements?.length || isStaff) && (
        <div className="card">
          <p className="eyebrow" style={{ marginTop: 0 }}>Announcements</p>
          {(announcements ?? []).map((a: any) => (
            <div key={a.id} className="post">
              <p className="who">{new Date(a.created_at).toLocaleDateString()}</p>
              <p style={{ margin: 0 }}><strong>{a.title}</strong></p>
              {a.body && <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{a.body}</p>}
              {isStaff && (
                <form action={deleteAnnouncement} style={{ marginTop: 4 }}>
                  <input type="hidden" name="announcement_id" value={a.id} />
                  <input type="hidden" name="course_id" value={course.id} />
                  <button type="submit" className="ghost-ink">Delete</button>
                </form>
              )}
            </div>
          ))}
          {!announcements?.length && <p className="muted" style={{ margin: 0 }}>No announcements yet.</p>}
          {isStaff && (
            <details style={{ marginTop: 12 }}>
              <summary className="muted" style={{ cursor: "pointer" }}>＋ Post announcement</summary>
              <form action={postAnnouncement} className="stack" style={{ marginTop: 10 }}>
                <input type="hidden" name="course_id" value={course.id} />
                <div>
                  <label>Title</label>
                  <input name="title" type="text" required className="text-input" />
                </div>
                <div>
                  <label>Message</label>
                  <textarea name="body" />
                </div>
                <button type="submit">Post</button>
              </form>
            </details>
          )}
        </div>
      )}

      {(modules ?? []).map((m: any) => (
        <section key={m.id} className="module">
          <h2 style={{ marginBottom: 2 }}>{m.title}</h2>
          {m.subtitle && <p className="muted" style={{ marginTop: 0 }}>{m.subtitle}</p>}

          {m.materials?.length > 0 && (
            <div className="card">
              <p className="eyebrow" style={{ marginTop: 0 }}>Materials</p>
              {[...m.materials]
                .sort((a: any, b: any) => a.position - b.position)
                .map((mat: any) => (
                  <div key={mat.id} className="item-row">
                    <div>
                      {mat.url ? (
                        <a href={mat.url} target="_blank" rel="noreferrer">{mat.title}</a>
                      ) : (
                        <strong>{mat.title}</strong>
                      )}
                      {mat.body && <p className="muted" style={{ margin: "4px 0 0" }}>{mat.body}</p>}
                    </div>
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="pill">{mat.kind}</span>
                      {isStaff && (
                        <form action={deleteMaterial}>
                          <input type="hidden" name="material_id" value={mat.id} />
                          <input type="hidden" name="course_id" value={course.id} />
                          <button type="submit" className="ghost-ink">✕</button>
                        </form>
                      )}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {m.assignments?.map((a: any) => {
            const sub = subByAssignment.get(a.id);
            return (
              <div key={a.id} className="card">
                <p className="eyebrow" style={{ marginTop: 0 }}>Assignment · {a.points} pts{a.due_on ? ` · due ${a.due_on}` : ""}</p>
                <h3 style={{ margin: "0 0 6px" }}>{a.title}</h3>
                {a.instructions && <p className="muted">{a.instructions}</p>}

                {isStaff ? (
                  <details>
                    <summary className="muted" style={{ cursor: "pointer" }}>Edit assignment</summary>
                    <form action={updateAssignment} className="stack" style={{ marginTop: 10 }}>
                      <input type="hidden" name="assignment_id" value={a.id} />
                      <input type="hidden" name="course_id" value={course.id} />
                      <div>
                        <label>Title</label>
                        <input name="title" type="text" required defaultValue={a.title} className="text-input" />
                      </div>
                      <div>
                        <label>Instructions</label>
                        <textarea name="instructions" defaultValue={a.instructions ?? ""} />
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <label>Points</label>
                          <input name="points" type="number" defaultValue={a.points} className="text-input" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label>Due date</label>
                          <input name="due_on" type="date" defaultValue={a.due_on ?? ""} className="text-input" />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button type="submit">Save</button>
                      </div>
                    </form>
                    <form action={deleteAssignment} style={{ marginTop: 8 }}>
                      <input type="hidden" name="assignment_id" value={a.id} />
                      <input type="hidden" name="course_id" value={course.id} />
                      <button type="submit" className="ghost-ink">Delete assignment</button>
                    </form>
                  </details>
                ) : sub?.graded_at ? (
                  <div className="notice">
                    <span className="grade">Grade: {sub.grade} / {a.points}</span>
                    {sub.feedback && <p style={{ margin: "6px 0 0" }}>{sub.feedback}</p>}
                  </div>
                ) : (
                  <form action={submitAssignment} className="stack">
                    <input type="hidden" name="assignment_id" value={a.id} />
                    <input type="hidden" name="course_id" value={course.id} />
                    <div>
                      <label htmlFor={`sub-${a.id}`}>
                        {sub ? "Your submission (you can revise until it's graded)" : "Your submission"}
                      </label>
                      <textarea id={`sub-${a.id}`} name="body" required defaultValue={sub?.body ?? ""} />
                    </div>
                    <button type="submit">{sub ? "Update submission" : "Submit assignment"}</button>
                    {sub && (
                      <p className="muted" style={{ margin: 0 }}>
                        Submitted {new Date(sub.submitted_at).toLocaleString()}
                      </p>
                    )}
                  </form>
                )}
              </div>
            );
          })}

          {m.discussion_threads?.map((t: any) => (
            <div key={t.id} className="card">
              <p className="eyebrow" style={{ marginTop: 0 }}>Discussion</p>
              <h3 style={{ margin: "0 0 6px" }}>{t.title}</h3>
              {t.prompt && <p className="muted">{t.prompt}</p>}

              {[...(t.discussion_posts ?? [])]
                .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
                .map((p: any) => (
                  <div key={p.id} className="post">
                    <p className="who">
                      {p.profiles?.full_name || p.profiles?.email || "Classmate"} ·{" "}
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                    <p style={{ margin: 0 }}>{p.body}</p>
                  </div>
                ))}

              <form action={postToThread} className="stack" style={{ marginTop: 14 }}>
                <input type="hidden" name="thread_id" value={t.id} />
                <input type="hidden" name="course_id" value={course.id} />
                <div>
                  <label htmlFor={`post-${t.id}`}>Add to the discussion</label>
                  <textarea id={`post-${t.id}`} name="body" required />
                </div>
                <button type="submit">Post reply</button>
              </form>
              {isStaff && (
                <form action={deleteThread} style={{ marginTop: 8 }}>
                  <input type="hidden" name="thread_id" value={t.id} />
                  <input type="hidden" name="course_id" value={course.id} />
                  <button type="submit" className="ghost-ink">Delete discussion</button>
                </form>
              )}
            </div>
          ))}

          {isStaff && (
            <div className="card">
              <details>
                <summary className="muted" style={{ cursor: "pointer" }}>＋ Add to “{m.title}”</summary>
                <div style={{ marginTop: 12 }}>
                  <form action={addMaterial} className="stack">
                    <input type="hidden" name="module_id" value={m.id} />
                    <input type="hidden" name="course_id" value={course.id} />
                    <p className="eyebrow" style={{ margin: 0 }}>New material</p>
                    <div>
                      <label>Title</label>
                      <input name="title" type="text" required className="text-input" />
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label>Type</label>
                        <select name="kind" className="text-input">
                          <option value="link">link</option>
                          <option value="pdf">pdf</option>
                          <option value="video">video</option>
                          <option value="text">text</option>
                        </select>
                      </div>
                      <div style={{ flex: 2 }}>
                        <label>URL (for link/pdf/video)</label>
                        <input name="url" type="url" className="text-input" />
                      </div>
                    </div>
                    <div>
                      <label>Notes / text body</label>
                      <textarea name="body" />
                    </div>
                    <button type="submit">Add material</button>
                  </form>

                  <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "16px 0" }} />

                  <form action={addAssignment} className="stack">
                    <input type="hidden" name="module_id" value={m.id} />
                    <input type="hidden" name="course_id" value={course.id} />
                    <p className="eyebrow" style={{ margin: 0 }}>New assignment</p>
                    <div>
                      <label>Title</label>
                      <input name="title" type="text" required className="text-input" />
                    </div>
                    <div>
                      <label>Instructions</label>
                      <textarea name="instructions" />
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label>Points</label>
                        <input name="points" type="number" defaultValue={100} className="text-input" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label>Due date</label>
                        <input name="due_on" type="date" className="text-input" />
                      </div>
                    </div>
                    <button type="submit">Add assignment</button>
                  </form>

                  <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "16px 0" }} />

                  <form action={addThread} className="stack">
                    <input type="hidden" name="module_id" value={m.id} />
                    <input type="hidden" name="course_id" value={course.id} />
                    <p className="eyebrow" style={{ margin: 0 }}>New discussion</p>
                    <div>
                      <label>Title</label>
                      <input name="title" type="text" required className="text-input" />
                    </div>
                    <div>
                      <label>Prompt</label>
                      <textarea name="prompt" />
                    </div>
                    <button type="submit">Add discussion</button>
                  </form>

                  <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "16px 0" }} />

                  <form action={updateModule} className="stack">
                    <input type="hidden" name="module_id" value={m.id} />
                    <input type="hidden" name="course_id" value={course.id} />
                    <p className="eyebrow" style={{ margin: 0 }}>Edit module</p>
                    <div>
                      <label>Title</label>
                      <input name="title" type="text" required defaultValue={m.title} className="text-input" />
                    </div>
                    <div>
                      <label>Subtitle</label>
                      <input name="subtitle" type="text" defaultValue={m.subtitle ?? ""} className="text-input" />
                    </div>
                    <div>
                      <label>Position</label>
                      <input name="position" type="number" defaultValue={m.position} className="text-input" />
                    </div>
                    <button type="submit">Save module</button>
                  </form>
                  <form action={deleteModule} style={{ marginTop: 8 }}>
                    <input type="hidden" name="module_id" value={m.id} />
                    <input type="hidden" name="course_id" value={course.id} />
                    <button type="submit" className="ghost-ink">Delete module (and its contents)</button>
                  </form>
                </div>
              </details>
            </div>
          )}
        </section>
      ))}

      {isStaff && (
        <div className="card">
          <details>
            <summary className="muted" style={{ cursor: "pointer" }}>＋ Add module</summary>
            <form action={addModule} className="stack" style={{ marginTop: 10 }}>
              <input type="hidden" name="course_id" value={course.id} />
              <div>
                <label>Title (e.g. “Week 3 — Context is King”)</label>
                <input name="title" type="text" required className="text-input" />
              </div>
              <div>
                <label>Subtitle</label>
                <input name="subtitle" type="text" className="text-input" />
              </div>
              <div>
                <label>Position (order on page)</label>
                <input name="position" type="number" defaultValue={(modules?.length ?? 0) + 1} className="text-input" />
              </div>
              <button type="submit">Add module</button>
            </form>
          </details>
        </div>
      )}
    </div>
  );
}
