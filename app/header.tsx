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
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    isStaffRole = profile?.role === "admin" || profile?.role === "instructor";
  }
  const studentView = viewingAsStudent();

  return (
    <header className="site-header">
      <div className="inner">
        <Link href={user ? "/dashboard" : "/"} className="brand">
          <span className="mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width={30} height={30} />
          </span>
          <span>Ignite Seminary</span>
        </Link>
        {user ? (
          <div className="header-user">
            {isStaffRole && (
              <form action={setViewMode}>
                <input type="hidden" name="mode" value={studentView ? "staff" : "student"} />
                <button className="ghost" type="submit" title="Toggle between the staff view and what students see">
                  {studentView ? "⇄ Back to staff view" : "⇄ View as student"}
                </button>
              </form>
            )}
            <span>{user.email}</span>
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
