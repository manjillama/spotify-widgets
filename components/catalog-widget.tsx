import React from "react";
import type { CatalogResponse } from "../utils/spotify-catalog";
import type { Theme } from "./player";

// Native SVG keeps these embeds portable across browsers and image renderers.
export default function CatalogWidget({ title, items, range, theme }: CatalogResponse & { theme: Theme }) {
  const dark = theme === "dark";
  const background = dark ? "#151c18" : "#fff";
  const ink = dark ? "#f2f3ea" : "#141710";
  const muted = dark ? "#a4b5aa" : "#64736a";
  const line = dark ? "#334239" : "#e5e9e1";
  const height = 114 + Math.max(items.length, 1) * 56;
  const period = range === "short_term" ? "PAST 4 WEEKS" : range === "medium_term" ? "PAST 6 MONTHS" : range === "long_term" ? "PAST YEAR" : "LISTENING HISTORY";
  const truncate = (text: string, max: number) => text.length > max ? `${text.slice(0, max - 1)}…` : text;
  return <svg width="360" height={height} viewBox={`0 0 360 ${height}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`${title} on Spotify`}>
    <title>{`${title} on Spotify`}</title>
    <rect x=".5" y=".5" width="359" height={height - 1} rx="14" fill={background} stroke={line} />
    <g fontFamily="Arial, Helvetica, sans-serif">
      <circle cx="24" cy="24" r="4" fill="#8eb835" />
      <text x="35" y="27" fill={muted} fontSize="9" letterSpacing="1.5">SPOTIFY / PERSONAL FREQUENCY</text>
      <text x="20" y="62" fill={ink} fontSize="28" fontWeight="800" letterSpacing="-1.3">{title}</text>
      <text x="20" y="83" fill={muted} fontSize="8" letterSpacing="1.5">{period}</text>
      <path d="M20 98H340" stroke={ink} />
      {!items.length && <text x="20" y="135" fill={muted} fontSize="12">No listening data available yet.</text>}
      {items.map((item, index) => {
        const y = 114 + index * 56;
        return <g key={`${item.id}-${index}`}>
          <text x="20" y={y + 26} fontSize="24" fontWeight="800" letterSpacing="-1" fill={muted}>{String(index + 1).padStart(2, "0")}</text>
          {item.image && <image href={item.image} x="61" y={y - 1} width="38" height="38" preserveAspectRatio="xMidYMid meet" />}
          <text x="110" y={y + 14} fill={ink} fontSize="12" fontWeight="600">{truncate(item.name, 29)}<title>{item.name}</title></text>
          <text x="110" y={y + 32} fill={muted} fontSize="10">{truncate(item.subtitle, 36)}<title>{item.subtitle}</title></text>
          {index < items.length - 1 && <path d={`M110 ${y + 44}H340`} stroke={line} />}
        </g>;
      })}
    </g>
  </svg>;
}
