import type { GetServerSideProps } from "next";
import Link from "next/link";
import { randomBytes } from "crypto";
import { getSpotifyConfig, privateResponse, stateCookie } from "../utils/spotify-auth";

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  privateResponse(res);
  if (process.env.NODE_ENV !== "development") return { notFound: true };
  try {
    const { clientId, redirectUri } = getSpotifyConfig();
    const state = randomBytes(32).toString("hex");
    res.setHeader("Set-Cookie", stateCookie(state, redirectUri, 600));
    const query = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: "user-read-playback-state user-read-currently-playing user-read-recently-played user-top-read",
    });
    return { redirect: { destination: `https://accounts.spotify.com/authorize?${query}`, permanent: false } };
  } catch {
    res.statusCode = 500;
    return { props: {} };
  }
};

export default function Login() {
  return <main style={{ padding: "2rem" }}><h1>Spotify setup</h1><p>Check SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REDIRECT_URI in .env.local, then restart the server.</p><Link href="/login">Try again</Link></main>;
}
