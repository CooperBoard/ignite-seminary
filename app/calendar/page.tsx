import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { viewingAsStudent } from "@/lib/view-mode";
import { createEvent, deleteEvent } from "@/app/actions";

export const dynamic = "force-dynamic";

type AgendaItem = {
  date: string; // YYYY-MM-DD
  time: string | null;
  type: "class" | "event" | "assignment" | "quiz" | "course";
  label: string;
  detail: string | null;
  href: string | null;
  eventId?: string;
};

const TYPE_LABEL: Record<AgendaItem["type"], string> = {
  class: "Class",
  event: "Event",
  assignment: "Assignment due",
  quiz: "Quiz due",
  course: "Course",
};

function fmtDateHeading(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export default async function CalendarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isStaff =
    (profile?.role === "admin" || profile?.role === "instructor") && !viewingAsStudent();

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 183).toISOString();

  const [{ data: events }, { data: assignments }, { data: quizzes }, { data: courses }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, kind, title, description, location, starts_at, course_id, courses ( title )")
        .gte("starts_at", `${today}T00:00:00Z`)
        .lte("starts_at", horizon)
        .order("starts_at"),
      supabase
        .from("assignments")
        .select("id, title, due_on, modules!inner ( courses!inner ( id, title ) )")
        .gte("due_on", today),
      supabase
        .from("quizzes")
        .select("id, title, due_on, modules!inner ( courses!inner ( id, title ) )")
        .gte("due_on", today),
      supabase
        .from("courses")
        .select("id, title, starts_on, ends_on, archived")
        .eq("archived", false),
    ]);

  const items: AgendaItem[] = [];

  for (const e of events ?? []) {
    const dt = new Date(e.starts_at);
    items.push({
      date: e.starts_at.slice(0, 10),
      time: dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }),
      type: e.kind === "class" ? "class" : "event",
      label: e.title,
      detail: [
        (e as any).courses?.title,
        e.location,
        e.description,
      ]
        .filter(Boolean)
        .join(" · ") || null,
      href: e.course_id ? `/course/${e.course_id}` : null,
      eventId: e.id,
    });
  }
  for (const a of assignments ?? []) {
    const c = (a as any).modules?.courses;
    if (!a.due_on) continue;
    items.push({
      date: a.due_on,
      time: null,
      type: "assignment",
      label: a.title,
      detail: c?.title ?? null,
      href: c ? `/course/${c.id}` : null,
    });
  }
  for (const q of quizzes ?? []) {
    const c = (q as any).modules?.courses;
    if (!q.due_on) continue;
    items.push({
      date: q.due_on,
      time: null,
      type: "quiz",
      label: q.title,
      detail: c?.title ?? null,
      href: c ? `/course/${c.id}` : null,
    });
  }
  for (const c of courses ?? []) {
    if (c.starts_on && c.starts_on >= today) {
      items.push({ date: c.starts_on, time: null, type: "course", label: `${c.title} begins`, detail: null, href: `/course/${c.id}` });
    }
    if (c.ends_on && c.ends_on >= today) {
      items.push({ date: c.ends_on, time: null, type: "course", label: `${c.title} ends`, detail: null, href: `/course/${c.id}` });
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  const byDate = new Map<string, AgendaItem[]>();
  for (const it of items) {
    const arr = byDate.get(it.date) ?? [];
    arr.push(it);
    byDate.set(it.date, arr);
  }

  return (
    <div>
      <p className="eyebrow">Next six months</p>
      <h1 style={{ marginTop: 0 }}>Calendar</h1>

      {isStaff && (
        <div className="card">
          <details>
            <summary className="muted" style={{ cursor: "pointer" }}>＋ Add class session or special event</summary>
            <form action={createEvent} className="stack" style={{ marginTop: 10 }}>
              <div>
                <label>Title (e.g. “Hermeneutics — Week 1 class” or “Graduation Night”)</label>
                <input name="title" type="text" required className="text-input" />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label>Type</label>
                  <select name="kind" className="text-input">
                    <option value="class">Class session</option>
                    <option value="event">Special event</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label>Date &amp; time</label>
                  <input name="starts_at" type="datetime-local" required className="text-input" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label>Course (optional — blank = seminary-wide)</label>
                  <select name="course_id" className="text-input">
                    <option value="">Seminary-wide</option>
                    {(courses ?? []).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label>Location</label>
                  <input name="location" type="text" className="text-input" />
                </div>
              </div>
              <div>
                <label>Details</label>
                <textarea name="description" />
              </div>
              <button type="submit">Add to calendar</button>
            </form>
          </details>
        </div>
      )}

      {byDate.size === 0 && (
        <div className="notice">Nothing on the calendar yet.</div>
      )}

      {Array.from(byDate.entries()).map(([date, dayItems]) => (
        <section key={date} style={{ marginBottom: 4 }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: 6 }}>{fmtDateHeading(date)}</h2>
          <div className="card" style={{ paddingTop: 8, paddingBottom: 8 }}>
            {dayItems.map((it, i) => (
              <div key={i} className="item-row">
                <div>
                  {it.href ? <Link href={it.href}>{it.label}</Link> : <strong>{it.label}</strong>}
                  {it.detail && <p className="muted" style={{ margin: "2px 0 0" }}>{it.detail}</p>}
                </div>
                <span style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
                  {it.time && <span className="muted">{it.time}</span>}
                  <span className="pill">{TYPE_LABEL[it.type]}</span>
                  {isStaff && it.eventId && (
                    <form action={deleteEvent}>
                      <input type="hidden" name="event_id" value={it.eventId} />
                      <button type="submit" className="ghost-ink">✕</button>
                    </form>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
