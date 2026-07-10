import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

// Token-hash sign-in: works regardless of which browser/device opens the
// email link (unlike the PKCE `code` flow, which requires the same browser
// that requested it — the cause of "the magic link goes in a circle").
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "email") as EmailOtpType;

  if (tokenHash) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert(
          { id: user.id, email: user.email ?? null },
          { onConflict: "id", ignoreDuplicates: true }
        );
      }
      return NextResponse.redirect(new URL("/dashboard", url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=expired", url.origin));
}
