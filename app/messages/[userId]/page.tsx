import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { sendMessage } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: { userId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (params.userId === user.id) redirect("/messages");

  const [{ data: partner }, { data: msgs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role").eq("id", params.userId).maybeSingle(),
    supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, created_at, read_at")
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${params.userId}),and(sender_id.eq.${params.userId},recipient_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  // Partner profile may be RLS-hidden (student↔student); still show the thread
  // if messages exist, otherwise 404.
  if (!partner && (msgs ?? []).length === 0) notFound();
  const partnerName = partner?.full_name || partner?.email || "Member";

  // Viewing the thread marks their messages to me as read
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", params.userId)
    .eq("recipient_id", user.id)
    .is("read_at", null);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Link href="/messages" className="muted">← All messages</Link>
      <h1 style={{ marginTop: 8 }}>
        {partnerName}
        {partner?.role && partner.role !== "student" && (
          <span className="pill" style={{ marginLeft: 10, verticalAlign: "middle" }}>{partner.role}</span>
        )}
      </h1>

      <div className="card">
        {(msgs ?? []).length === 0 && <p className="muted" style={{ margin: 0 }}>No messages yet — say hello.</p>}
        {(msgs ?? []).map((m: any) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={mine ? "msg msg-mine" : "msg"}>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.body}</p>
              <p className="who" style={{ marginTop: 4 }}>
                {mine ? "You" : partnerName} ·{" "}
                {new Date(m.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          );
        })}
      </div>

      <div className="card">
        <form action={sendMessage} className="stack">
          <input type="hidden" name="recipient_id" value={params.userId} />
          <div>
            <label htmlFor="body">Reply</label>
            <textarea id="body" name="body" required />
          </div>
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}
