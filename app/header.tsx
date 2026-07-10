import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { viewingAsStudent } from "@/lib/view-mode";
import { setViewMode } from "@/app/actions";

export default async function Header() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isStaffRole = false;
  let unread = 0;
  if (user) {
    const [{ data: profile }, { count }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null),
    ]);
    isStaffRole = profile?.role === "admin" || profile?.role === "instructor";
    unread = count ?? 0;
  }
  const studentView = viewingAsStudent();

  return (
    <header className="site-header">
      <div className="inner">
        <Link href={user ? "/dashboard" : "/"} className="brand">
          <span className="mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark.png" alt="" width={30} height={30} />
          </span>
          <span style={{ whiteSpace: "nowrap" }}>Ignite Seminary</span>
        </Link>
        {user ? (
          <div className="header-user">
            <Link href="/messages" style={{ color: "#e6ddf7", display: "flex", gap: 6, alignItems: "center" }}>
              ✉ Messages
              {unread > 0 && <span className="msg-badge">{unread}</span>}
            </Link>
            {isStaffRole && (
              <form action={setViewMode}>
                <input type="hidden" name="mode" value={studentView ? "staff" : "student"} />
                <button
                  className="ghost"
                  type="submit"
                  style={{ whiteSpace: "nowrap" }}
                  title="Toggle between the staff view and what students see"
                >
                  {studentView ? "⇄ Staff view" : "⇄ Student view"}
                </button>
              </form>
            )}
            <span className="user-email">{user.email}</span>
            <form action="/signout" method="post">
              <button className="ghost" type="submit">Sign out</button>
            </form>
          </div>
        ) : (
          <div className="header-user">
            <Link href="/login" style={{ color: "#e6ddf7" }}>Sign in</Link>
          </div>
        )}
      </div>
    </header>
  );
}
