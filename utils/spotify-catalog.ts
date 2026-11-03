export type CatalogItem = {
  id: string;
  name: string;
  subtitle: string;
  image: string | null;
  url: string | null;
  playedAt: string | null;
};
export type CatalogKind = "recently-played" | "top-tracks" | "top-artists";
export type TimeRange = "short_term" | "medium_term" | "long_term";
export type CatalogResponse = {
  title: string;
  items: CatalogItem[];
  range: TimeRange | null;
};
export const titles: Record<CatalogKind, string> = {
  "recently-played": "Recently played",
  "top-tracks": "Top tracks",
  "top-artists": "Top artists",
};

export function normalizeItem(
  item: any,
  artist = false,
  playedAt: string | null = null,
): CatalogItem {
  const images = artist ? item.images : item.album?.images;
  const image = images?.[1]?.url || images?.[0]?.url;
  const url = item.external_urls?.spotify;
  return {
    id: item.id || item.uri || item.name || "unknown",
    name: item.name || "Unavailable item",
    subtitle: artist
      ? (item.genres || []).slice(0, 2).join(" · ") || "Artist"
      : (item.artists || []).map((a: any) => a.name).join(", ") ||
        "Unknown artist",
    image:
      typeof image === "string" && image.startsWith("https://") ? image : null,
    url:
      typeof url === "string" && url.startsWith("https://open.spotify.com/")
        ? url
        : null,
    playedAt,
  };
}
