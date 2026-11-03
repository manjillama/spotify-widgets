import type { NextApiRequest, NextApiResponse } from "next";
import Player from "../../../components/player";
import { nowPlaying, SpotifyError } from "../../../utils";
import { getArtwork } from "../../../utils/artwork";
import { renderToString } from "react-dom/server";

type SpotifyAPI = {
  item: {
    name?: string;
    duration_ms?: number;
    duration?: number;
    album?: {
      images?: { url: string }[];
    };
    artists?: { name: string }[];
  };
  is_playing: boolean;
  progress_ms: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const theme = req.query.theme === "dark" ? "dark" : "light";
    const {
      item = {},
      is_playing: isPlaying = false,
      progress_ms: progress = 0,
    }: SpotifyAPI = await nowPlaying();

    const { duration_ms: duration, name: track } = item || {};
    const { images = [] } = item?.album || {};

    const coverImg = await getArtwork(images[images.length - 1]?.url, theme);
    const artist = (item?.artists || []).map(({ name }) => name).join(", ");

    const text = renderToString(
      Player({
        cover: coverImg,
        artist,
        track,
        isPlaying,
        progress,
        duration,
        theme,
        size: req.query.size === "large" ? "large" : "compact",
      }),
    );

    res.setHeader(
      "Link",
      `</api/widgets/now-playing?theme=${theme}>; rel="alternate"; type="image/svg+xml"`,
    );
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "s-maxage=1, stale-while-revalidate");
    return res.status(200).send(text);
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    if (error instanceof SpotifyError) {
      if (error.retryAfter) res.setHeader("Retry-After", error.retryAfter);
      return res.status(error.status).json({ error: error.message });
    }
    return res
      .status(502)
      .json({ error: "Unable to load Spotify playback. Please try again." });
  }
}
