This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

**Now Playing on Spotify**

<a href="https://github.com/manjillama/spotify-now-playing-widget">
    <img src="https://spotify-playing-badge.vercel.app/api/now-playing" width="256" height="64" alt="Now Playing">
</a>

<hr/>

## Spotify Setup

Register `http://127.0.0.1:3000/callback` as a redirect URI in your [Spotify app dashboard](https://developer.spotify.com/dashboard/). Set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in `.env.local`, start the app, then visit [Connect Spotify](http://127.0.0.1:3000/login). After approving access, copy the displayed `SPOTIFY_REFRESH_TOKEN` into `.env.local` and restart the server.

`SPOTIFY_REDIRECT_URI` defaults to `http://127.0.0.1:3000/callback`. If you change the port or use a hosted callback, set this variable to the exact URI registered with Spotify. Open `/login` on the same host as the callback so the authorization state cookie is available. Hosted callbacks require HTTPS.

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
