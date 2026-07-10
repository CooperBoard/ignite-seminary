import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { sendMessage } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: me }, { data: msgs }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, created_at, read_at")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  const isStaff = me?.role === "admin" || me?.role === "instructor";

  // People I can start a conversation with
  const { data: contacts } = isStaff
    ? await supabase.from("profiles").select("id, full_name, email, role").neq("id", user.id).order("full_name")
    : await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("role", ["admin", "instructor"])
        .neq("id", user.id)
        .order("full_name");

  const nameById = new Map((contacts ?? []).map((c: any) => [c.id, c.full_name || c.email]));

  // Group into conversations by the other participant
  type Convo = { partnerId: string; last: any; unread: number };
  const convos = new Map<string, Convo>();
  for (const m of msgs ?? []) {
    const partnerId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
    const existing = convos.get(partnerId);
    const unreadInc = m.recipient_id === user.id && !m.read_at ? 1 : 0;
    if (!existing) {
      convos.set(partnerId, { partnerId, last: m, unread: unreadInc });
    } else {
      existing.unread += unreadInc;
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <p className="eyebrow">Private messages</p>
      <h1 style={{ marginTop: 0 }}>Messages</h1>

      {convos.size === 0 ? (
        <div className="notice">No conversations yet — start one below.</div>
      ) : (
        <div className="card" style={{ paddingTop: 8, paddingBottom: 8 }}>
          {Array.from(convos.values()).map((c) => (
            <Link key={c.partnerId} href={`/messages/${c.partnerId}`} style={{ display: "block", color: "inherit" }}>
              <div className="item-row">
                <div style={{ minWidth: 0 }}>
                  <strong>{nameById.get(c.partnerId) || "Member"}</strong>
                  <p className="muted" style={{ margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.last.sender_id === user.id ? "You: " : ""}
                    {c.last.body}
                  </p>
                </div>
                <span style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
                  {c.unread > 0 && <span className="pill">{c.unread} new</span>}
                  <span className="muted">{new Date(c.last.created_at).toLocaleDateString()}</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <h2>New message</h2>
      <div className="card">
        <form action={sendMessage} className="stack">
          <div>
            <label>To</label>
            <select name="recipient_id" required className="text-input">
              <option value="">Choose…</option>
              {(contacts ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.full_name || c.email}
                  {c.role !== "student" ? ` — ${c.role}` : ""}
                </option>
              ))}
            </select>
            {!isStaff && (
              <p className="muted" style={{ margin: "6px 0 0" }}>
                Students can message seminary staff. Class-wide conversation happens in
                the course discussion boards.
              </p>
            )}
          </div>
          <div>
            <label>Message</label>
            <textarea name="body" required />
          </div>
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}
