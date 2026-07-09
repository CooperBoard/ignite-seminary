import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { submitAssignment, postToThread } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, term, description, starts_on, ends_on")
    .eq("id", params.id)
    .maybeSingle();

  if (!course) notFound();

  const { data: modules } = await supabase
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
    .order("position", { ascending: true });

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
                    <span className="pill">{mat.kind}</span>
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

                {sub?.graded_at ? (
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
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
