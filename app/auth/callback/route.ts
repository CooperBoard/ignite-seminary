import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Ensure a profile row exists (RLS: profiles insert own)
        await supabase.from("profiles").upsert(
          { id: user.id, email: user.email ?? null },
          { onConflict: "id", ignoreDuplicates: true }
        );
      }
      return NextResponse.redirect(new URL("/dashboard", url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
