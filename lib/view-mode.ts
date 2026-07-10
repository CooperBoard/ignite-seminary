import { cookies } from "next/headers";

// Staff can flip into "student view" to see courses exactly as students do.
// Stored in a cookie so it follows them across pages until they switch back.
export const VIEW_MODE_COOKIE = "ignite_view_mode";

export function viewingAsStudent(): boolean {
  return cookies().get(VIEW_MODE_COOKIE)?.value === "student";
}
