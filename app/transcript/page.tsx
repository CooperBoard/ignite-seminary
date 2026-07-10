import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TranscriptView from "./transcript-view";

export const dynamic = "force-dynamic";

export default async function MyTranscriptPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <TranscriptView
      studentId={user.id}
      studentName={profile?.full_name ?? null}
      studentEmail={profile?.email ?? user.email ?? null}
    />
  );
}
