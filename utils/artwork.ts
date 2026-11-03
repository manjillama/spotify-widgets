import { readFile } from "fs/promises";
import path from "path";
import type { Theme } from "../components/player";

/** SVGs used through <img> cannot load external artwork, so embed its bytes. */
export async function getArtwork(
  url: string | null | undefined,
  theme: Theme,
): Promise<string> {
  if (url) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error("Artwork unavailable");
      const mime =
        response.headers
          .get("content-type")
          ?.split(";")[0]
          .trim()
          .toLowerCase() || "image/jpeg";
      if (
        !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)
      )
        throw new Error("Unsupported artwork type");
      const bytes = await response.arrayBuffer();
      if (!bytes.byteLength) throw new Error("Empty artwork");
      return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
    } catch {
      // Use local artwork when Spotify's image CDN is unavailable.
    }
  }
  const filename =
    theme === "dark" ? "default-artwork-dark.jpg" : "default-artwork.jpg";
  const bytes = await readFile(
    path.join(process.cwd(), "public/assets", filename),
  );
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}
