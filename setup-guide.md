# Spotify setup

1. Create an app in the [Spotify developer dashboard](https://developer.spotify.com/dashboard/).
2. Add `http://127.0.0.1:3000/callback` to its Redirect URIs. Spotify no longer permits `localhost` redirect URIs.
3. Copy `.env.local.example` to `.env.local` and set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` from your dashboard. Leave `SPOTIFY_REFRESH_TOKEN` empty for now.
4. Run `npm install` and `npm run dev`.
5. Open [http://127.0.0.1:3000/login](http://127.0.0.1:3000/login) and approve playback access. The app validates the authorization state and exchanges the code server-side.
6. On the callback page, copy the displayed `SPOTIFY_REFRESH_TOKEN=...` line into `.env.local`. Keep the token and client secret private.
7. Restart the server and open [your widget](http://127.0.0.1:3000/api/now-playing).

**`http://localhost:3000` will not work for Spotify login. Always open the app at [http://127.0.0.1:3000](http://127.0.0.1:3000), even if the development server prints a localhost URL.** The login and callback must use the same host for authorization state validation.

You do not need to construct authorization URLs, encode credentials, or run curl commands.

## Different ports or hosted setup

Set `SPOTIFY_REDIRECT_URI` to the exact callback URI registered in your dashboard. It defaults to `http://127.0.0.1:3000/callback`. Open `/login` on that same host, using the same scheme. State cookies expire after ten minutes; if setup fails or you reload a completed callback, start again at `/login`.

Spotify requires HTTPS for hosted redirects and permits HTTP for explicit loopback IP addresses. See [Spotify redirect requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri) and the [authorization code flow](https://developer.spotify.com/documentation/web-api/tutorials/code-flow).

## Deploy on Vercel

1. Import your repository into [Vercel](https://vercel.com/new).
2. Add `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and the generated `SPOTIFY_REFRESH_TOKEN` as environment variables.
3. Deploy or redeploy after saving the variables.
4. Use `https://YOUR_DEPLOYMENT/api/now-playing` as your widget image URL:

```html
<img src="https://YOUR_DEPLOYMENT/api/now-playing" width="256" height="64" alt="Now Playing on Spotify">
```

The refresh token generated locally also works in your deployment with the same client credentials. You only need a hosted `SPOTIFY_REDIRECT_URI` if you want to run the login flow on the deployed app.
