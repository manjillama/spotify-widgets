import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useState } from "react";
import { timingSafeEqual } from "crypto";
import { getSpotifyConfig, privateResponse, STATE_COOKIE, stateCookie } from "../utils/spotify-auth";

type Props = { refreshToken: string | null; error: string | null };

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, res, query }) => {
  privateResponse(res);
  const fail = (error: string, status = 400) => {
    res.statusCode = status;
    return { props: { refreshToken: null, error } };
  };
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:3000/callback";
  res.setHeader("Set-Cookie", stateCookie("", redirectUri, 0));
  const expected = req.cookies[STATE_COOKIE];
  const state = query.state;
  if (typeof state !== "string" || !expected || !/^[a-f0-9]{64}$/.test(state) || !/^[a-f0-9]{64}$/.test(expected) || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) {
    return fail("Authorization state did not match or expired. Start again from /login using 127.0.0.1.");
  }
  if (query.error) return fail("Spotify authorization was declined or failed. Please try again.");
  if (typeof query.code !== "string" || !query.code) return fail("Spotify did not return an authorization code. Please try again.");
  try {
    const { clientId, clientSecret, redirectUri } = getSpotifyConfig();
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code: query.code, redirect_uri: redirectUri }),
      cache: "no-store",
    });
    if (!response.ok) return fail("Spotify could not exchange the code. Check your credentials and registered redirect URI, then start again.", 502);
    const data = await response.json();
    if (typeof data.refresh_token !== "string" || !data.refresh_token) return fail("Spotify did not return a refresh token. Please authorize again.", 502);
    return { props: { refreshToken: data.refresh_token, error: null } };
  } catch {
    return fail("Unable to finish Spotify setup. Check your environment variables and connection, then try again.", 502);
  }
};

export default function Callback({ refreshToken, error }: Props) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(`SPOTIFY_REFRESH_TOKEN=${refreshToken}`);
      setMessage("Copied.");
    } catch {
      setMessage("Select and copy the value above.");
    }
  }
  return (
    <main style={{ padding: "2rem", maxWidth: "48rem", margin: "auto" }}>
      <h1>Spotify setup</h1>
      {error ? <><p role="alert">{error}</p><Link href="/login">Try again</Link></> : <>
        <p>Copy this line into .env.local, then restart the development server. For deployment, add the same environment variable and redeploy.</p>
        <textarea aria-label="Spotify refresh token environment variable" readOnly value={`SPOTIFY_REFRESH_TOKEN=${refreshToken}`} rows={5} style={{ width: "100%", margin: "1rem 0" }} />
        <button onClick={copy}>Copy refresh token</button><p role="status">{message}</p>
        <p>Keep this token private. It grants access to your Spotify playback data.</p>
        <Link href="/">Open your listening dashboard</Link>
      </>}
    </main>
  );
}
