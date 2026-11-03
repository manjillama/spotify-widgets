import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isSpotifyConfigured } from "../utils";
import type { CatalogKind, TimeRange } from "../utils/spotify-catalog";
import { titles } from "../utils/spotify-catalog";

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  res.setHeader("Cache-Control", "private, no-store");
  const initialTheme = req?.cookies?.["listening-room-theme"] === "light" ? "light" : "dark";
  return { props: { configured: isSpotifyConfigured(), initialTheme } };
};

function ListeningPanel({ kind, range, refresh, theme }: { kind: CatalogKind; range: TimeRange; refresh: number; theme: "light" | "dark" }) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // A server-rendered image can finish before hydration attaches onLoad/onError.
    const image = imageRef.current;
    if (image?.complete) {
      setLoading(false);
      setError(image.naturalWidth === 0);
    }
  }, []);
  const path = `/api/${kind}?limit=5${kind === "recently-played" ? "" : `&range=${range}`}`;
  const svgPath = `/api/widgets/${kind}?limit=5&theme=${theme}${kind === "recently-played" ? "" : `&range=${range}`}`;
  async function copyEmbed() {
    try {
      await navigator.clipboard.writeText(`<img src="${window.location.origin}${svgPath.replace(/&/g, "&amp;")}" width="360" alt="${titles[kind]} on Spotify" />`);
      setCopied("Embed copied");
    } catch { setCopied("Copy the SVG URL from the link below."); }
  }
  return <section className="listening-panel" id={kind} aria-busy={loading}>
    <div className="panel-heading"><div><p className="eyebrow">{kind === "recently-played" ? "02 / THE RECENT ROTATION" : kind === "top-tracks" ? "03 / HEAVY ROTATION" : "04 / THE MAIN CHARACTERS"}</p><h2>{titles[kind]}</h2></div></div>
    <div className="widget-preview" data-loading={loading && !error}>
      {loading && !error && <p className="widget-loading" role="status">Loading widget…</p>}
      {error ? <div className="panel-message error" role="alert"><p>Could not load this widget. Try Refresh. If you recently added permissions, reconnect Spotify and save the new refresh token.</p>{process.env.NODE_ENV === "development" && <Link href="/login">Reconnect Spotify →</Link>}</div> : <a href={svgPath} aria-label={`Open ${titles[kind]} widget`}><img
        ref={imageRef}
        src={`${svgPath}&refresh=${refresh}`}
        alt={`${titles[kind]} on Spotify`}
        width="360"
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true); }}
      /></a>}
    </div>
    <div className="panel-footer"><a href={svgPath}>Widget ↗</a><a href={path}>JSON ↗</a><button onClick={copyEmbed}>Copy embed</button></div><p className="copy-status" role="status">{copied}</p>
  </section>;
}

export default function Home({ configured, initialTheme = "dark" }: { configured: boolean; initialTheme?: "light" | "dark" }) {
  const [range, setRange] = useState<TimeRange>("short_term");
  const [refresh, setRefresh] = useState(0);
  const [playbackError, setPlaybackError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);
  useEffect(() => { setPlaybackError(false); }, [theme, refresh]);
  useEffect(() => {
    if (!configured) { setIsPlaying(false); return; }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function updatePlayback() {
      let delay = 30000;
      try {
        if (document.visibilityState !== "hidden") {
          const response = await fetch("/api/now-playing", { signal: controller.signal });
          if (response.status === 429) {
            const retryAfter = Number(response.headers.get("Retry-After"));
            if (Number.isFinite(retryAfter)) delay = Math.max(delay, retryAfter * 1000);
          }
          const data = response.ok ? await response.json() : null;
          if (!controller.signal.aborted) setIsPlaying(data?.isPlaying === true);
        }
      } catch {
        if (!controller.signal.aborted) setIsPlaying(false);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(updatePlayback, delay);
      }
    }
    updatePlayback();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [configured, refresh]);
  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.cookie = `listening-room-theme=${nextTheme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  return <div className="dashboard" data-theme={theme}>
    <Head><title>Listening room · Spotify dashboard</title><meta name="description" content="A personal listening room with recent Spotify plays, favorite tracks, and top artists." /></Head>
    <aside className="sidebar"><Link href="/" className="brand"><span className="brand-mark" data-playing={isPlaying} aria-hidden="true">♫</span> listening room<span className="brand-dot">.</span></Link><p className="nav-label">THE INDEX</p><nav aria-label="Dashboard"><a href="#overview" className="nav-active"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="2" /></svg><span>Overview</span></a><a href="#recently-played"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 4v4l3 2" /></svg><span>Recently played</span></a><a href="#top-tracks"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 4h12M2 8h9M2 12h6" /></svg><span>Top tracks</span></a><a href="#top-artists"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="5" r="3" /><path d="M2.5 14v-1a5.5 5.5 0 0 1 11 0v1" /></svg><span>Top artists</span></a></nav><div className="sidebar-bottom"><span className="connection-dot" />{configured ? "Account configured" : "Setup needed"}<p>Made for the music you love.</p>{process.env.NODE_ENV === "development" && <Link href="/login">{configured ? "Reconnect Spotify ↗" : "Connect Spotify ↗"}</Link>}</div></aside>
    <main className="dashboard-main" id="overview">
      <header className="topbar"><span>PERSONAL FREQUENCY / VOL. 01</span><div className="topbar-actions"><a className="github-link" href="https://github.com/manjillama/spotify-now-playing-widget" target="_blank" rel="noreferrer" aria-label="View this open-source project on GitHub"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.104.769-.244.769-.542 0-.267-.01-.975-.015-1.913-3.13.68-3.79-1.508-3.79-1.508-.512-1.3-1.25-1.646-1.25-1.646-1.022-.698.078-.684.078-.684 1.13.08 1.724 1.16 1.724 1.16 1.004 1.72 2.634 1.223 3.276.935.102-.727.393-1.223.715-1.505-2.498-.284-5.124-1.249-5.124-5.563 0-1.23.44-2.234 1.16-3.022-.117-.285-.503-1.43.11-2.98 0 0 .945-.302 3.094 1.155A10.78 10.78 0 0 1 12 6.182c.956.005 1.918.13 2.817.378 2.148-1.457 3.091-1.155 3.091-1.155.615 1.55.229 2.695.112 2.98.722.788 1.158 1.793 1.158 3.022 0 4.325-2.63 5.276-5.136 5.554.404.35.764 1.042.764 2.1 0 1.516-.014 2.74-.014 3.112 0 .3.203.65.774.54A11.252 11.252 0 0 0 12 .75Z" /></svg><span>GitHub ↗</span></a><button className="theme-button" onClick={toggleTheme}>{theme === "light" ? "☾ Dark mode" : "☀ Light mode"}</button></div></header>
      <div className="page-heading"><div><p className="eyebrow">GOOD MUSIC. NO SMALL TALK.</p><h1>Less noise.<br /><span>More music.</span></h1><p>A live collection of the tracks and artists you keep coming back to.</p></div>{configured && <button className="refresh-button" onClick={() => setRefresh(n => n + 1)}>↻ Refresh</button>}</div>
      {!configured ? <section className="setup-card"><span className="setup-icon">♫</span><p className="eyebrow">LET’S SET THE MOOD</p><h2>Your listening room is waiting.</h2><p>Set your Spotify client ID and secret in <code>.env.local</code>, then connect your account. Save the refresh token from the callback page and restart the server to bring your dashboard to life.</p>{process.env.NODE_ENV === "development" && <Link className="primary-button" href="/login">Connect Spotify →</Link>}<p className="setup-note">For local setup, open this app at <strong>http://127.0.0.1:3000</strong>. Spotify login will not work from localhost.</p></section> : <>
        <section className="hero-card"><div className="hero-copy"><span className="live-label"><span /> 01 / ON AIR</span><h2>Currently in orbit.</h2><p>A tiny window into what’s playing.</p><a href={`/api/widgets/now-playing?theme=${theme}`}>Open widget ↗</a></div><div className="hero-widget"><div className="record" aria-hidden="true"><span /></div>{playbackError ? <p role="status">Playback unavailable. Try Refresh or reconnect Spotify.</p> : <img onError={() => setPlaybackError(true)} key={`${theme}-${refresh}`} src={`/api/widgets/now-playing?theme=${theme}&refresh=${refresh}`} alt="Current Spotify playback widget" width="256" height="64" />}<p>Playback updates when you refresh.</p></div></section>
        <div className="section-toolbar"><p>02—04 / THE ROTATION</p><label>Top items from <select value={range} onChange={event => setRange(event.target.value as TimeRange)}><option value="short_term">Past 4 weeks</option><option value="medium_term">Past 6 months</option><option value="long_term">Past year</option></select></label></div>
        <div className="panel-grid"><ListeningPanel key={`recently-played-${theme}-${refresh}`} kind="recently-played" range={range} refresh={refresh} theme={theme} /><ListeningPanel key={`top-tracks-${range}-${theme}-${refresh}`} kind="top-tracks" range={range} refresh={refresh} theme={theme} /><ListeningPanel key={`top-artists-${range}-${theme}-${refresh}`} kind="top-artists" range={range} refresh={refresh} theme={theme} /></div>
        <p className="dashboard-note">Top items reflect Spotify’s listening affinity, rather than exact play counts.{process.env.NODE_ENV === "development" && <> Missing data? <Link href="/login">Reconnect</Link> to approve listening history and top-item permissions, then save the new refresh token and restart.</>}</p>
      </>}
      <section className="widget-directory" aria-labelledby="widget-heading"><div><p className="eyebrow">TAKE THE MUSIC WITH YOU</p><h2 id="widget-heading">Small widgets.<br />Big personality.</h2><p>Drop a live image into your site or README. Choose a theme, open a widget, copy its URL.</p></div><div className="widget-links">{(["now-playing", "recently-played", "top-tracks", "top-artists"] as const).map((kind, index) => <div key={kind}><span>0{index + 1}</span><strong>{kind === "now-playing" ? "Now playing" : titles[kind]}</strong><a href={`/api/${kind}`}>JSON ↗</a><a href={`/api/widgets/${kind}?theme=${theme}${kind === "now-playing" ? "" : `&limit=5${kind === "recently-played" ? "" : `&range=${range}`}`}`}>Widget ↗</a></div>)}</div></section>
      <footer className="dashboard-footer">
        <div className="footer-credits"><span>LISTENING ROOM</span><span>Created by <a href="https://www.manjiltamang.com/" target="_blank" rel="noreferrer">Manjil Tamang ↗</a></span><span>Listening data & artwork from <a href="https://open.spotify.com" target="_blank" rel="noreferrer">Spotify ↗</a></span></div>
        <div className="footer-links" aria-label="Project and support links"><a href="https://patreon.com/xmarman" target="_blank" rel="noreferrer">Patreon ↗</a><a href="https://buymeacoffee.com/xmarman" target="_blank" rel="noreferrer">Buy me a coffee ↗</a></div>
      </footer>
    </main>
  </div>;
}
