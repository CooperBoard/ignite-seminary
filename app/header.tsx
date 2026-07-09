import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

export default async function Header() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="site-header">
      <div className="inner">
        <Link href={user ? "/dashboard" : "/"} className="brand">
          <span className="mark">IS</span>
          <span>Ignite Seminary</span>
        </Link>
        {user ? (
          <div className="header-user">
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
