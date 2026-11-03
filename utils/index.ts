export class SpotifyError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, SpotifyError.prototype);
  }
}

let cachedToken: { value: string; expires: number } | undefined;
let pendingToken: Promise<string> | undefined;

export function isSpotifyConfigured() {
  return Boolean(
    process.env.SPOTIFY_CLIENT_ID &&
    process.env.SPOTIFY_CLIENT_SECRET &&
    process.env.SPOTIFY_REFRESH_TOKEN,
  );
}

async function getAuthorizationToken(): Promise<string> {
  if (!isSpotifyConfigured())
    throw new SpotifyError(
      503,
      "Finish Spotify setup by saving your client credentials and refresh token, then restart the server.",
    );
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value;
  if (pendingToken) return pendingToken;
  pendingToken = (async () => {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: process.env.SPOTIFY_REFRESH_TOKEN!,
      }),
      cache: "no-store",
    });
    if (!response.ok)
      throw new SpotifyError(
        response.status === 429 ? 429 : 502,
        "Spotify could not refresh access. Reconnect Spotify and save the new refresh token.",
        response.headers.get("retry-after") || undefined,
      );
    const data = await response.json();
    if (typeof data.access_token !== "string")
      throw new SpotifyError(502, "Spotify returned an invalid access token.");
    cachedToken = {
      value: data.access_token,
      expires:
        Date.now() + Math.max(0, (Number(data.expires_in) || 3600) - 60) * 1000,
    };
    return data.access_token;
  })();
  try {
    return await pendingToken;
  } finally {
    pendingToken = undefined;
  }
}

export async function spotifyRequest(path: string, retry = true): Promise<any> {
  const token = await getAuthorizationToken();
  const response = await fetch(`https://api.spotify.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (response.status === 401 && retry) {
    cachedToken = undefined;
    return spotifyRequest(path, false);
  }
  if (response.status === 204) return null;
  if (!response.ok) {
    const message =
      response.status === 403
        ? "Spotify denied access. Reconnect Spotify to approve the new permissions, save the new refresh token, and restart. Also check your app's allowed users and account access."
        : response.status === 429
          ? "Spotify rate limit reached. Please try again later."
          : "Spotify is temporarily unavailable. Please try again.";
    throw new SpotifyError(
      response.status === 403 || response.status === 429
        ? response.status
        : 502,
      message,
      response.headers.get("retry-after") || undefined,
    );
  }
  return response.json();
}

export async function nowPlaying() {
  return (await spotifyRequest("me/player/currently-playing")) || {};
}
