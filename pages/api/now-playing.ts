import type { NextApiRequest, NextApiResponse } from "next";
import { nowPlaying, SpotifyError } from "../../utils";
import { normalizeItem } from "../../utils/spotify-catalog";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const data = await nowPlaying();
    const theme = req.query.theme === "dark" ? "dark" : "light";
    return res.status(200).json({
      title: "Now playing",
      item: data.item ? normalizeItem(data.item) : null,
      isPlaying: Boolean(data.item && data.is_playing),
      progress: data.progress_ms ?? 0,
      duration: data.item?.duration_ms ?? null,
      links: { widget: `/api/widgets/now-playing?theme=${theme}` },
    });
  } catch (error) {
    if (error instanceof SpotifyError) {
      if (error.retryAfter) res.setHeader("Retry-After", error.retryAfter);
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(502).json({ error: "Unable to load Spotify playback. Please try again." });
  }
}
