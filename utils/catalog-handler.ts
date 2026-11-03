import type { NextApiRequest, NextApiResponse } from "next";
import { renderToStaticMarkup } from "react-dom/server";
import { getArtwork } from "./artwork";
import CatalogWidget from "../components/catalog-widget";
import { spotifyRequest, SpotifyError } from "./index";
import {
  CatalogKind,
  CatalogResponse,
  normalizeItem,
  TimeRange,
  titles,
} from "./spotify-catalog";

export function catalogHandler(kind: CatalogKind, widget = false) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }
    const limit = req.query.limit === undefined ? 5 : Number(req.query.limit);
    const range =
      req.query.range === undefined ? "short_term" : req.query.range;
    if (
      Array.isArray(req.query.limit) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 20
    )
      return res
        .status(400)
        .json({ error: "limit must be an integer from 1 to 20." });
    if (
      kind !== "recently-played" &&
      (typeof range !== "string" ||
        !["short_term", "medium_term", "long_term"].includes(range))
    )
      return res.status(400).json({
        error: "range must be short_term, medium_term, or long_term.",
      });
    if (
      req.query.format !== undefined &&
      !["json", "svg"].includes(req.query.format as string)
    )
      return res.status(400).json({ error: "format must be json or svg." });
    try {
      const path =
        kind === "recently-played"
          ? `me/player/recently-played?limit=${limit}`
          : `me/top/${kind === "top-artists" ? "artists" : "tracks"}?limit=${limit}&time_range=${range}`;
      const data = await spotifyRequest(path);
      const payload: CatalogResponse = {
        title: titles[kind],
        range: kind === "recently-played" ? null : (range as TimeRange),
        items: (data?.items || [])
          .filter((entry: any) =>
            kind === "recently-played" ? entry?.track : entry,
          )
          .slice(0, limit)
          .map((entry: any) =>
            normalizeItem(
              kind === "recently-played" ? entry.track : entry,
              kind === "top-artists",
              kind === "recently-played" ? entry.played_at || null : null,
            ),
          ),
      };
      if (widget || req.query.format === "svg") {
        const theme = req.query.theme === "dark" ? "dark" : "light";
        const artwork = new Map<string | null, Promise<string>>();
        const items = await Promise.all(
          payload.items.map(async (item) => {
            if (!artwork.has(item.image))
              artwork.set(item.image, getArtwork(item.image, theme));
            return { ...item, image: await artwork.get(item.image)! };
          }),
        );
        res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
        return res
          .status(200)
          .send(
            renderToStaticMarkup(CatalogWidget({ ...payload, items, theme })),
          );
      }
      const widgetQuery = new URLSearchParams({
        limit: String(limit),
        theme: req.query.theme === "dark" ? "dark" : "light",
      });
      if (payload.range) widgetQuery.set("range", payload.range);
      return res.status(200).json({
        ...payload,
        links: { widget: `/api/widgets/${kind}?${widgetQuery}` },
      });
    } catch (error) {
      if (error instanceof SpotifyError) {
        if (error.retryAfter) res.setHeader("Retry-After", error.retryAfter);
        return res.status(error.status).json({ error: error.message });
      }
      return res
        .status(502)
        .json({ error: "Unable to reach Spotify. Please try again." });
    }
  };
}
