This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

**Now Playing on Spotify**

<a href="https://github.com/manjillama/spotify-now-playing-widget">
    <img src="https://spotify-playing-badge.vercel.app/api/widgets/now-playing" width="256" height="64" alt="Now Playing">
</a>

<hr/>

## Listening dashboard & APIs

All `/api/<name>` routes return JSON; `/api/widgets/<name>` routes return SVG images. **Breaking change:** existing now-playing image embeds must switch from `/api/now-playing` to `/api/widgets/now-playing`. The now-playing JSON response includes `title`, `item` (or `null` when idle), `isPlaying`, `progress` in milliseconds, `duration` in milliseconds (or `null`), and `links.widget`.

The homepage is a listening dashboard for the account configured in the server environment. The homepage defaults to dark mode and remembers your selection in a browser cookie for one year, including after refresh. Standalone widgets still default to light mode. All four previews use the same widget image endpoints that you can embed on your own site or README; the homepage does not render separate copies of the listening lists. It includes now playing, recent listening history, top tracks, and top artists, with light/dark mode, time-range filters, refresh, and copyable SVG embeds. Visitors see that configured account’s data; this is not a separate account session per visitor.

**Existing users:** visit `/login` again to approve `user-read-recently-played` and `user-top-read`. Replace `SPOTIFY_REFRESH_TOKEN` with the new token and restart (or redeploy). Existing playback-only tokens cannot access these new APIs.

| Endpoint | Data |
| --- | --- |
| `/api/recently-played` | Recent tracks, including play timestamps |
| `/api/top-tracks` | Top tracks by Spotify affinity |
| `/api/top-artists` | Top artists by Spotify affinity |

All three return JSON with a `links.widget` URL and `title`, `range`, and `items` (`id`, `name`, `subtitle`, `image`, `url`, `playedAt`). Use `limit=1` through `20` (default `5`). For top items, use `range=short_term` (default, about four weeks), `medium_term` (about six months), or `long_term` (about a year). These rankings are not exact play counts. Recently played does not include podcast episodes.

Each API has a dedicated image endpoint. All widgets default to light mode; append `?theme=dark` for dark mode or `?theme=light` explicitly.

| API | Widget image |
| --- | --- |
| `/api/now-playing` | `/api/widgets/now-playing` |
| `/api/recently-played` | `/api/widgets/recently-played` |
| `/api/top-tracks` | `/api/widgets/top-tracks` |
| `/api/top-artists` | `/api/widgets/top-artists` |

The dashboard links to each API and widget separately and copies an embed in the selected theme. Catalog widgets are 360px wide and support the same `limit` and `range` parameters as their APIs. Now playing defaults to 256 × 64px; add `size=large` for the optional 320 × 88px version. Idle playback uses `default-artwork.jpg` in light mode and `default-artwork-dark.jpg` in dark mode.

Example dark widget embed:

```html
<img src="https://YOUR_DEPLOYMENT/api/widgets/top-tracks?limit=5&amp;range=short_term&amp;theme=dark" width="360" alt="Top tracks on Spotify" />
```

`format=svg` on the original catalog APIs remains supported for existing embeds.

The JSON APIs return clear errors for missing configuration, insufficient permissions, unavailable Spotify responses, invalid parameters, and rate limits. Access tokens are cached server-side until shortly before expiry; secrets are never included in dashboard props or API responses. Dashboard data refreshes on page load, when changing the top-item range, or when pressing Refresh.

## Spotify Setup

The widget uses light mode by default. Use `/api/widgets/now-playing?theme=dark` for dark mode or `/api/widgets/now-playing?theme=light` for explicit light mode. Missing or unsupported theme values use light mode. The widget defaults to 256 × 64 pixels. Use `size=large` for 320 × 88 pixels.

Register `http://127.0.0.1:3000/callback` as a redirect URI in your [Spotify app dashboard](https://developer.spotify.com/dashboard/). Set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in `.env.local`, start the app, then visit [Connect Spotify](http://127.0.0.1:3000/login). After approving access, copy the displayed `SPOTIFY_REFRESH_TOKEN` into `.env.local` and restart the server.

`SPOTIFY_REDIRECT_URI` defaults to `http://127.0.0.1:3000/callback`. If you change the local port, set this variable to the exact loopback URI registered with Spotify. Open `/login` on the same host as the callback so the authorization state cookie is available. Login and callback are disabled in production; generate tokens locally.

See [setup-guide](./setup-guide.md) for deployment steps.

## Project Setup

1. **Clone the repository**

   ```bash
   # Clone with SSH
   $ git clone git@github.com:manjillama/spotify-now-playing-widget.git

   # Or with HTTPS
   $ git clone https://github.com/manjillama/spotify-now-playing-widget.git
   ```

2. **Install dependencies**
   Navigate into newly cloned folder and install dependencies.

   ```shell
   cd spotify-now-playing-widget/
   npm install
   ```

3. **Configuration**
   In the root project folder, copy the `.env.local.example` and save as `.env.local`. Update the variables.

4. **Start developing.**
   Run the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

   Open [http://127.0.0.1:3000](http://127.0.0.1:3000) with your browser to see the result.

   **`http://localhost:3000` will not work for Spotify login. Always use [http://127.0.0.1:3000](http://127.0.0.1:3000), even if the development server prints a localhost URL.** The login and callback must use the same host for authorization state validation.

   You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

   [API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://127.0.0.1:3000/api/now-playing](http://127.0.0.1:3000/api/now-playing). This endpoint can be edited in `pages/api/now-playing.ts`.

   The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

The larger now-playing widget includes elapsed and total time. Times reflect the moment the image loads; the progress bar animates while playing. Paused tracks hold their position. Both sizes support `theme=light` and `theme=dark`.

## Development-only authorization

`/login` and `/callback` are available only under `npm run dev` (`NODE_ENV=development`). Production builds, including Vercel deployments, return 404 for both routes. Production pages do not display connect or reconnect links. Generate the refresh token locally, then save it as a private deployment environment variable and redeploy. Never run a development server as your public production deployment.

Only the configured account’s listening data is public; credentials must stay in server environment variables. If a refresh token was exposed, revoke this app’s access in your Spotify account, authorize again locally, replace the deployment token, and redeploy.
