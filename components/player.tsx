import React from "react";
import ReadmeImg from "./readme-img";

export type Theme = "light" | "dark";

export interface Props {
  cover?: string;
  track?: string;
  artist: string;
  progress: number;
  duration?: number;
  isPlaying: boolean;
  theme?: Theme;
  size?: "default" | "compact" | "large";
}

const palettes = {
  light: { background: "#ffffff", border: "#e2e8e4", text: "#18251e", muted: "#64736a", rail: "#e5ece7", accent: "#16833e" },
  dark: { background: "#151c18", border: "#303d34", text: "#f0f6f2", muted: "#a4b5aa", rail: "#334239", accent: "#1ed760" },
};

const Player = ({ cover, track, artist, progress, duration, isPlaying, theme = "light", size = "default" }: Props) => {
  const colors = palettes[theme];
  const compact = size !== "large";
  const width = compact ? 256 : 320;
  const height = compact ? 64 : 88;
  const artworkSize = compact ? 48 : 64;
  const time = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
  const total = duration && Number.isFinite(duration) && duration > 0 ? duration : 0;
  const elapsed = Number.isFinite(progress) ? Math.min(total, Math.max(0, progress)) : 0;
  const fraction = total ? elapsed / total : 0;
  const playing = Boolean(track && isPlaying);
  const status = playing ? "NOW PLAYING" : track ? "PAUSED" : "NOTHING ON AIR";

  return (
    <ReadmeImg width={width} height={height}>
      <style>{`
        .player {
          display: flex; align-items: center; gap: ${compact ? 10 : 14}px;
          width: ${width}px; height: ${height}px; padding: ${compact ? 7 : 11}px;
          border: 1px solid ${colors.border}; border-radius: ${compact ? 12 : 16}px;
          background: ${colors.background}; color: ${colors.text};
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        }
        .player-cover { flex: 0 0 ${artworkSize}px; width: ${artworkSize}px; height: ${artworkSize}px; object-fit: cover; border-radius: ${compact ? 7 : 10}px; background: ${colors.rail}; }
        .player-details { flex: 1; min-width: 0; }
        .player-status { display: flex; align-items: center; gap: 5px; color: ${playing ? colors.accent : colors.muted}; font-size: 7px; font-weight: 600; letter-spacing: 1.1px; line-height: 9px; }
        .player-dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
        .player-track, .player-artist { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .player-track { margin-top: ${compact ? 2 : 3}px; font-size: ${compact ? 12 : 14}px; font-weight: 650; line-height: ${compact ? 15 : 18}px; letter-spacing: -.3px; }
        .player-artist { color: ${colors.muted}; font-size: ${compact ? 10 : 11}px; line-height: 14px; }
        .player-rail { height: 2px; margin-top: ${compact ? 3 : 5}px; overflow: hidden; border-radius: 3px; background: ${colors.rail}; }
        .player-progress { height: 100%; background: ${colors.accent}; transform-origin: left; transform: scaleX(${fraction}); ${playing && total ? `animation: playback ${total - elapsed}ms linear forwards;` : ""} }
        .player-times { display: flex; justify-content: space-between; color: ${colors.muted}; margin-top: 3px; font-size: 8px; line-height: 9px; font-variant-numeric: tabular-nums; }
        .player-idle { margin-top: 5px; color: ${colors.muted}; font-size: 8px; letter-spacing: .4px; }
        @keyframes playback { from { transform: scaleX(${fraction}); } to { transform: scaleX(1); } }
        @media (prefers-reduced-motion: reduce) { .player-progress { animation: none; } }
      `}</style>
      <div className="player" role="img" aria-label={track ? `${playing ? "Now playing" : "Paused"}: ${track}${artist ? ` by ${artist}` : ""}` : "Spotify: Nothing playing"}>
        {cover ? <img className="player-cover" src={cover} alt="" /> : <div className="player-cover" />}
        <div className="player-details">
          <div className="player-status"><span className="player-dot" />{status}</div>
          <p className="player-track" title={track}>{track || "Nothing playing"}</p>
          <p className="player-artist" title={artist}>{artist || (track ? "Unknown artist" : "No active listening session")}</p>
          {track && total > 0 && <>
            <div className="player-rail"><div className="player-progress" /></div>
            {!compact && <div className="player-times" aria-label="Playback time at image load"><span>{time(elapsed)}</span><span>{time(total)}</span></div>}
          </>}
          {!track && !compact && <p className="player-idle">Updates when playback resumes.</p>}
        </div>
      </div>
    </ReadmeImg>
  );
};

export default Player;
