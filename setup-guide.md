# Spotify setup

1. Create an app in the [Spotify developer dashboard](https://developer.spotify.com/dashboard/).
2. Add `http://127.0.0.1:3000/callback` to its Redirect URIs. Spotify no longer permits `localhost` redirect URIs.
3. Copy `.env.local.example` to `.env.local` and set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` from your dashboard. Leave `SPOTIFY_REFRESH_TOKEN` empty for now.
4. Run `npm install` and `npm run dev`.
5. Open [http://127.0.0.1:3000/login](http://127.0.0.1:3000/login) and approve playback, recently played, and top-item access. The app validates the authorization state and exchanges the code server-side.
6. On the callback page, copy the displayed `SPOTIFY_REFRESH_TOKEN=...` line into `.env.local`. Keep the token and client secret private.
7. Restart the server and open [your listening dashboard](http://127.0.0.1:3000). Your now-playing widget is at [/api/widgets/now-playing](http://127.0.0.1:3000/api/widgets/now-playing).

**`http://localhost:3000` will not work for Spotify login. Always open the app at [http://127.0.0.1:3000](http://127.0.0.1:3000), even if the development server prints a localhost URL.** The login and callback must use the same host for authorization state validation.

You do not need to construct authorization URLs, encode credentials, or run curl commands.

## Different ports or hosted setup

Set `SPOTIFY_REDIRECT_URI` to the exact callback URI registered in your dashboard. It defaults to `http://127.0.0.1:3000/callback`. Open `/login` on that same host, using the same scheme. State cookies expire after ten minutes; if setup fails or you reload a completed callback, start again at `/login`.

Spotify requires HTTPS for hosted redirects and permits HTTP for explicit loopback IP addresses. See [Spotify redirect requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri) and the [authorization code flow](https://developer.spotify.com/documentation/web-api/tutorials/code-flow).

## Deploy on Vercel

1. Import your repository into [Vercel](https://vercel.com/new).
2. Add `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and the generated `SPOTIFY_REFRESH_TOKEN` as environment variables.
3. Deploy or redeploy after saving the variables.
4. Use `https://YOUR_DEPLOYMENT/api/widgets/now-playing` as your widget image URL:

```html
<img src="https://YOUR_DEPLOYMENT/api/widgets/now-playing" width="256" height="64" alt="Now Playing on Spotify">
```

The widget defaults to light mode. For dark mode, use `https://YOUR_DEPLOYMENT/api/widgets/now-playing?theme=dark` as the image URL. You can also specify `?theme=light` explicitly.

The refresh token generated locally also works in your deployment with the same client credentials. You only need a hosted `SPOTIFY_REDIRECT_URI` if you want to run the login flow on the deployed app.

## Upgrading an existing token

The dashboard’s recent-history and top-item panels need `user-read-recently-played` and `user-top-read`. If you connected before these features were added, run `/login` again, approve the new permissions, replace `SPOTIFY_REFRESH_TOKEN`, and restart or redeploy. A 403 can also indicate Spotify account or app access restrictions.

See the [README API reference](./README.md#listening-dashboard--apis) for JSON endpoints, SVG embeds, limits, and time-range options. Anyone who can access your deployment can view the configured account’s listening dashboard and API data.

## Dedicated widget URLs

Use `/api/widgets/now-playing`, `/api/widgets/recently-played`, `/api/widgets/top-tracks`, or `/api/widgets/top-artists` as an image URL. Append `?theme=dark` for dark mode; light mode is the default. The dashboard’s widget directory links to every endpoint, and each JSON API response includes its widget URL in `links.widget`.

```html
<img src="https://YOUR_DEPLOYMENT/api/widgets/top-artists?theme=dark&amp;limit=5" width="360" alt="Top artists on Spotify" />
```
