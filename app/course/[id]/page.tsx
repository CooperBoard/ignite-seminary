import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { viewingAsStudent } from "@/lib/view-mode";
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
  createQuiz,
  deleteQuiz,
  addQuizQuestion,
  deleteQuizQuestion,
  submitQuiz,
  toggleMaterialDone,
} from "@/app/actions";

export const dynamic = "force-dynamic";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

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
  const isStaffRole = profile?.role === "admin" || profile?.role === "instructor";
  const isStaff = isStaffRole && !viewingAsStudent();

  const [{ data: modules }, { data: announcements }] = await Promise.all([
    supabase
      .from("modules")
      .select(`
        id, position, title, subtitle,
        materials ( id, position, title, kind, url, body ),
        assignments ( id, title, instructions, points, due_on ),
        quizzes ( id, title, description, due_on ),
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
  const quizIds = modules?.flatMap((m: any) => (m.quizzes ?? []).map((q: any) => q.id)) ?? [];
  const materialIds =
    modules?.flatMap((m: any) => (m.materials ?? []).map((mat: any) => mat.id)) ?? [];

  const [{ data: mySubs }, { data: questions }, { data: myAttempts }, { data: myDone }] =
    await Promise.all([
      assignmentIds.length
        ? supabase
            .from("submissions")
            .select("assignment_id, body, submitted_at, grade, feedback, graded_at")
            .in("assignment_id", assignmentIds)
            .eq("student_id", user!.id)
        : Promise.resolve({ data: [] as any[] }),
      quizIds.length
        ? supabase
            .from(isStaff ? "quiz_questions" : "quiz_questions_student")
            .select("*")
            .in("quiz_id", quizIds)
            .order("position", { ascending: true })
            .order("id", { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
      quizIds.length
        ? supabase
            .from("quiz_attempts")
            .select("quiz_id, answers, correct, score, max_score, submitted_at")
            .in("quiz_id", quizIds)
            .eq("student_id", user!.id)
        : Promise.resolve({ data: [] as any[] }),
      materialIds.length
        ? supabase
            .from("material_completions")
            .select("material_id")
            .in("material_id", materialIds)
            .eq("student_id", user!.id)
        : Promise.resolve({ data: [] as any[] }),
    ]);

  const subByAssignment = new Map((mySubs ?? []).map((s: any) => [s.assignment_id, s]));
  const questionsByQuiz = new Map<string, any[]>();
  for (const q of questions ?? []) {
    const arr = questionsByQuiz.get(q.quiz_id) ?? [];
    arr.push(q);
    questionsByQuiz.set(q.quiz_id, arr);
  }
  const attemptByQuiz = new Map((myAttempts ?? []).map((a: any) => [a.quiz_id, a]));
  const doneMaterials = new Set((myDone ?? []).map((d: any) => d.material_id));

  // Progress: materials checked + assignments submitted + quizzes attempted
  const totalItems = materialIds.length + assignmentIds.length + quizIds.length;
  const doneItems =
    doneMaterials.size +
    new Set((mySubs ?? []).map((s: any) => s.assignment_id)).size +
    (myAttempts ?? []).length;
  const progressPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  const complete = totalItems > 0 && doneItems >= totalItems;

  return (
    <div>
      <p className="eyebrow">{course.term ?? "Course"}</p>
      <h1 style={{ marginTop: 0 }}>{course.title}</h1>
      {course.description && <p className="muted">{course.description}</p>}

      {isStaff ? (
        <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>Instructor tools</p>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Course code for students to join: <strong>{course.enroll_code ?? "—"}</strong>
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={`/course/${course.id}/gradebook`} className="btn" style={{ display: "inline-block" }}>
              Gradebook
            </Link>
            <Link href={`/course/${course.id}/grade`} className="btn" style={{ display: "inline-block" }}>
              Grading queue
            </Link>
          </div>
        </div>
      ) : (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <p className="eyebrow" style={{ margin: 0 }}>Your progress</p>
            <span className="muted">{doneItems} of {totalItems} items · {progressPct}%</span>
          </div>
          <div className="progress-track" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          {complete && (
            <p style={{ margin: "10px 0 0" }}>
              🎓 Course complete!{" "}
              <Link href={`/course/${course.id}/certificate`}>View your certificate</Link>
            </p>
          )}
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
              <summary className="muted" style={{ cursor: "pointer" }}>＋ Post announcement (emails the class)</summary>
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
                <button type="submit">Post &amp; email class</button>
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
                .map((mat: any) => {
                  const done = doneMaterials.has(mat.id);
                  return (
                    <div key={mat.id} className="item-row">
                      <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                        {!isStaff && (
                          <form action={toggleMaterialDone}>
                            <input type="hidden" name="material_id" value={mat.id} />
                            <input type="hidden" name="course_id" value={course.id} />
                            <input type="hidden" name="done" value={String(done)} />
                            <button
                              type="submit"
                              className="check-btn"
                              title={done ? "Mark as not done" : "Mark as done"}
                              aria-label={done ? "Mark as not done" : "Mark as done"}
                            >
                              {done ? "✓" : "○"}
                            </button>
                          </form>
                        )}
                        <div>
                          {mat.url ? (
                            <a href={mat.url} target="_blank" rel="noreferrer">{mat.title}</a>
                          ) : (
                            <strong>{mat.title}</strong>
                          )}
                          {mat.body && <p className="muted" style={{ margin: "4px 0 0" }}>{mat.body}</p>}
                        </div>
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
                  );
                })}
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
                      <button type="submit">Save</button>
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

          {m.quizzes?.map((qz: any) => {
            const qs = questionsByQuiz.get(qz.id) ?? [];
            const attempt = attemptByQuiz.get(qz.id);
            return (
              <div key={qz.id} className="card">
                <p className="eyebrow" style={{ marginTop: 0 }}>
                  Quiz · {qs.length} question{qs.length === 1 ? "" : "s"}
                  {qz.due_on ? ` · due ${qz.due_on}` : ""}
                </p>
                <h3 style={{ margin: "0 0 6px" }}>{qz.title}</h3>
                {qz.description && <p className="muted">{qz.description}</p>}

                {isStaff ? (
                  <>
                    {qs.map((q: any, qi: number) => (
                      <div key={q.id} className="item-row">
                        <div>
                          <strong>{qi + 1}. {q.prompt}</strong>
                          <p className="muted" style={{ margin: "4px 0 0" }}>
                            {(q.options as string[])
                              .map((o, oi) => `${LETTERS[oi]}) ${o}`)
                              .join("   ")}
                          </p>
                        </div>
                        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span className="pill">answer: {LETTERS[q.correct_index]}</span>
                          <form action={deleteQuizQuestion}>
                            <input type="hidden" name="question_id" value={q.id} />
                            <input type="hidden" name="course_id" value={course.id} />
                            <button type="submit" className="ghost-ink">✕</button>
                          </form>
                        </span>
                      </div>
                    ))}
                    <details style={{ marginTop: 10 }}>
                      <summary className="muted" style={{ cursor: "pointer" }}>＋ Add question</summary>
                      <form action={addQuizQuestion} className="stack" style={{ marginTop: 10 }}>
                        <input type="hidden" name="quiz_id" value={qz.id} />
                        <input type="hidden" name="course_id" value={course.id} />
                        <input type="hidden" name="position" value={qs.length + 1} />
                        <div>
                          <label>Question</label>
                          <textarea name="prompt" required />
                        </div>
                        {[0, 1, 2, 3].map((oi) => (
                          <div key={oi}>
                            <label>Option {LETTERS[oi]}{oi < 2 ? "" : " (optional)"}</label>
                            <input name={`option_${oi}`} type="text" required={oi < 2} className="text-input" />
                          </div>
                        ))}
                        <div>
                          <label>Correct answer</label>
                          <select name="correct_index" className="text-input">
                            {[0, 1, 2, 3].map((oi) => (
                              <option key={oi} value={oi}>{LETTERS[oi]}</option>
                            ))}
                          </select>
                        </div>
                        <button type="submit">Add question</button>
                      </form>
                    </details>
                    <form action={deleteQuiz} style={{ marginTop: 8 }}>
                      <input type="hidden" name="quiz_id" value={qz.id} />
                      <input type="hidden" name="course_id" value={course.id} />
                      <button type="submit" className="ghost-ink">Delete quiz</button>
                    </form>
                  </>
                ) : attempt ? (
                  <div>
                    <div className="notice">
                      <span className="grade">Score: {attempt.score} / {attempt.max_score}</span>
                      <span className="muted"> · submitted {new Date(attempt.submitted_at).toLocaleDateString()}</span>
                    </div>
                    {qs.map((q: any, qi: number) => {
                      const chosen = (attempt.answers as number[])[qi];
                      const right = (attempt.correct as boolean[])[qi];
                      return (
                        <div key={q.id} className="post">
                          <p style={{ margin: 0 }}>
                            <strong>{qi + 1}. {q.prompt}</strong>
                          </p>
                          <p className="muted" style={{ margin: "4px 0 0" }}>
                            Your answer: {LETTERS[chosen]}) {(q.options as string[])[chosen]}{" "}
                            {right ? <span className="grade">✓ correct</span> : <span>✗ incorrect</span>}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : qs.length === 0 ? (
                  <p className="muted">This quiz isn&apos;t ready yet — check back soon.</p>
                ) : (
                  <form action={submitQuiz} className="stack">
                    <input type="hidden" name="quiz_id" value={qz.id} />
                    <input type="hidden" name="course_id" value={course.id} />
                    <input type="hidden" name="question_count" value={qs.length} />
                    {qs.map((q: any, qi: number) => (
                      <fieldset key={q.id} style={{ border: "none", padding: 0, margin: 0 }}>
                        <legend style={{ fontWeight: 600, marginBottom: 6 }}>
                          {qi + 1}. {q.prompt}
                        </legend>
                        {(q.options as string[]).map((o, oi) => (
                          <label key={oi} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400, marginBottom: 4 }}>
                            <input type="radio" name={`q_${qi}`} value={oi} required />
                            {LETTERS[oi]}) {o}
                          </label>
                        ))}
                      </fieldset>
                    ))}
                    <button type="submit">Submit quiz (one attempt)</button>
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

                  <form action={createQuiz} className="stack">
                    <input type="hidden" name="module_id" value={m.id} />
                    <input type="hidden" name="course_id" value={course.id} />
                    <p className="eyebrow" style={{ margin: 0 }}>New quiz</p>
                    <div>
                      <label>Title</label>
                      <input name="title" type="text" required className="text-input" />
                    </div>
                    <div>
                      <label>Description</label>
                      <input name="description" type="text" className="text-input" />
                    </div>
                    <div>
                      <label>Due date</label>
                      <input name="due_on" type="date" className="text-input" />
                    </div>
                    <button type="submit">Create quiz (add questions after)</button>
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
