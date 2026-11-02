import type { ServerResponse } from "http";

export const STATE_COOKIE = "spotify_auth_state";

export function getSpotifyConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:3000/callback";
  if (!clientId || !clientSecret) {
    throw new Error("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local, then restart the server.");
  }
  const url = new URL(redirectUri);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new Error("SPOTIFY_REDIRECT_URI must use HTTPS or an HTTP loopback IP address.");
  }
  return { clientId, clientSecret, redirectUri };
}

export function stateCookie(value: string, redirectUri: string, maxAge: number) {
  return `${STATE_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${redirectUri.startsWith("https:") ? "; Secure" : ""}`;
}

export function privateResponse(res: ServerResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
}
