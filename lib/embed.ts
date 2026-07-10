// Turn YouTube / Vimeo share links into embeddable player URLs.
// We embed rather than host: video files are large, and storage + bandwidth
// for self-hosted video gets expensive fast, while YouTube/Vimeo serve it
// free on better CDNs. Photos and documents are small — those we do host.

export function toEmbedUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube-nocookie.com/embed/${v}`;
      const shorts = u.pathname.match(/^\/shorts\/([\w-]+)/);
      if (shorts) return `https://www.youtube-nocookie.com/embed/${shorts[1]}`;
      const live = u.pathname.match(/^\/live\/([\w-]+)/);
      if (live) return `https://www.youtube-nocookie.com/embed/${live[1]}`;
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (host === "vimeo.com") {
      const m = u.pathname.match(/^\/(\d+)/);
      if (m) return `https://player.vimeo.com/video/${m[1]}`;
    }
  } catch {
    return null;
  }
  return null;
}
