const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) =>
    module._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      }).outputText,
      filename,
    );
}
const client = require("../utils/index.ts");
const { catalogHandler } = require("../utils/catalog-handler.ts");
function response() {
  return {
    headers: {},
    code: 200,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}
const track = {
  id: "t1",
  name: "A <song> & friends",
  artists: [{ name: "An artist" }],
  album: { images: [{ url: "https://example.com/cover.jpg" }] },
  external_urls: { spotify: "https://open.spotify.com/track/t1" },
};

test("catalog routes validate inputs, normalize data, render SVG, and report errors", async () => {
  const saved = client.spotifyRequest;
  const savedFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    headers: new Headers({ "content-type": "image/png" }),
    arrayBuffer: async () => Uint8Array.from([137, 80, 78, 71]).buffer,
  });
  const paths = [];
  client.spotifyRequest = async (path) => {
    paths.push(path);
    if (path.startsWith("me/player/recently-played"))
      return {
        items: [{ track: null }, { track, played_at: "2026-01-01T12:00:00Z" }],
      };
    if (path.startsWith("me/top/artists"))
      return {
        items: [
          {
            id: "a1",
            name: "Artist",
            genres: ["indie"],
            images: [],
            external_urls: { spotify: "javascript:alert(1)" },
          },
        ],
      };
    return { items: [track] };
  };
  try {
    for (const kind of ["recently-played", "top-tracks", "top-artists"]) {
      const res = response();
      await catalogHandler(kind)(
        { method: "GET", query: { limit: "3", range: "medium_term" } },
        res,
      );
      assert.equal(res.code, 200);
      assert.equal(res.headers["Cache-Control"], "no-store");
      assert.equal(res.body.items.length, 1);
      assert.ok(res.body.links.widget.startsWith(`/api/widgets/${kind}?`));
      assert.ok(res.body.links.widget.includes("theme=light"));
      assert.equal(
        res.body.range,
        kind === "recently-played" ? null : "medium_term",
      );
      if (kind === "recently-played")
        assert.equal(res.body.items[0].playedAt, "2026-01-01T12:00:00Z");
      if (kind === "top-artists") {
        assert.equal(res.body.items[0].url, null);
        assert.equal(res.body.items[0].image, null);
      }
    }
    assert.ok(paths.includes("me/top/tracks?limit=3&time_range=medium_term"));
    assert.ok(paths.includes("me/top/artists?limit=3&time_range=medium_term"));
    assert.ok(paths.includes("me/player/recently-played?limit=3"));
    for (const query of [
      { limit: "0" },
      { limit: "21" },
      { limit: "2.5" },
      { limit: ["1", "2"] },
      { range: "bad" },
      { range: ["short_term"] },
      { format: "html" },
    ]) {
      const res = response();
      await catalogHandler("top-tracks")({ method: "GET", query }, res);
      assert.equal(res.code, 400);
    }
    const method = response();
    await catalogHandler("top-tracks")({ method: "POST", query: {} }, method);
    assert.equal(method.code, 405);
    assert.equal(method.headers.Allow, "GET");
    for (const theme of ["light", "dark"]) {
      const svg = response();
      await catalogHandler("top-tracks")(
        { method: "GET", query: { format: "svg", theme } },
        svg,
      );
      assert.match(svg.headers["Content-Type"], /image\/svg/);
      assert.match(svg.body, /A &lt;song&gt; &amp; friends/);
      assert.ok(svg.body.includes(theme === "dark" ? "#151c18" : "#fff"));
      assert.doesNotMatch(svg.body, /undefined|NaN/);
      assert.match(svg.body, /<image[^>]+href="data:image\/png;base64,/);
      assert.doesNotMatch(svg.body, /href="https:\/\/example.com/);
    }
    client.spotifyRequest = async () => ({ items: [] });
    const empty = response();
    await catalogHandler("top-artists")(
      { method: "GET", query: { format: "svg" } },
      empty,
    );
    assert.match(empty.body, /No listening data/);
    for (const status of [403, 429, 503]) {
      client.spotifyRequest = async () => {
        throw new client.SpotifyError(
          status,
          "safe message",
          status === 429 ? "30" : undefined,
        );
      };
      const res = response();
      await catalogHandler("recently-played")(
        { method: "GET", query: {} },
        res,
      );
      assert.equal(res.code, status);
      if (status === 429) assert.equal(res.headers["Retry-After"], "30");
    }
    client.spotifyRequest = async () => {
      throw new Error("secret internal detail");
    };
    const unexpected = response();
    await catalogHandler("top-tracks")(
      { method: "GET", query: {} },
      unexpected,
    );
    assert.equal(unexpected.code, 502);
    assert.doesNotMatch(JSON.stringify(unexpected.body), /secret/);
  } finally {
    client.spotifyRequest = saved;
    global.fetch = savedFetch;
  }
});

test("Spotify client shares refresh requests, caches tokens, retries expired access, and handles rate limits", async () => {
  const savedFetch = global.fetch;
  const savedEnv = { ...process.env };
  try {
    delete process.env.SPOTIFY_REFRESH_TOKEN;
    await assert.rejects(
      client.spotifyRequest("me/top/tracks"),
      (error) => error.status === 503,
    );
    Object.assign(process.env, {
      SPOTIFY_CLIENT_ID: "test-client",
      SPOTIFY_CLIENT_SECRET: "test-secret",
      SPOTIFY_REFRESH_TOKEN: "test-refresh",
    });
    let tokenCalls = 0;
    let apiCalls = 0;
    global.fetch = async (url, options) => {
      if (url.includes("/api/token")) {
        tokenCalls++;
        assert.equal(options.body.get("refresh_token"), "test-refresh");
        return {
          ok: true,
          json: async () => ({ access_token: "test-access", expires_in: 3600 }),
        };
      }
      apiCalls++;
      assert.equal(options.headers.Authorization, "Bearer test-access");
      return { ok: true, status: 200, json: async () => ({ items: [] }) };
    };
    await Promise.all([
      client.spotifyRequest("me/top/tracks"),
      client.spotifyRequest("me/top/artists"),
      client.spotifyRequest("me/player/recently-played"),
    ]);
    assert.equal(tokenCalls, 1);
    assert.equal(apiCalls, 3);
    await client.spotifyRequest("me/top/tracks");
    assert.equal(tokenCalls, 1);
    const normalFetch = global.fetch;
    let first = true;
    global.fetch = async (url, options) => {
      if (!url.includes("/api/token") && first) {
        first = false;
        return { status: 401 };
      }
      return normalFetch(url, options);
    };
    await client.spotifyRequest("me/top/tracks");
    assert.equal(tokenCalls, 2);
    global.fetch = async () => ({
      ok: false,
      status: 429,
      headers: new Headers({ "retry-after": "15" }),
    });
    await assert.rejects(
      client.spotifyRequest("me/top/tracks"),
      (error) => error.status === 429 && error.retryAfter === "15",
    );
    global.fetch = async () => ({
      ok: false,
      status: 403,
      headers: new Headers(),
    });
    await assert.rejects(
      client.spotifyRequest("me/top/tracks"),
      (error) => error.status === 403 && error.message.includes("Reconnect"),
    );
    global.fetch = async () => ({ status: 204 });
    assert.deepEqual(await client.nowPlaying(), {});
  } finally {
    global.fetch = savedFetch;
    process.env = savedEnv;
  }
});

test("dashboard renders setup or listening panels without serializing credentials", async () => {
  const savedEnv = { ...process.env };
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const page = require("../pages/index.tsx");
  try {
    delete process.env.SPOTIFY_REFRESH_TOKEN;
    const setupProps = await page.getServerSideProps({ res: response() });
    assert.deepEqual(setupProps.props, { configured: false, initialTheme: "dark" });
    const setup = renderToStaticMarkup(
      React.createElement(page.default, setupProps.props),
    );
    assert.match(setup, /Your listening room is waiting/);
    assert.match(setup, /127.0.0.1:3000/);
    Object.assign(process.env, {
      SPOTIFY_CLIENT_ID: "private-client",
      SPOTIFY_CLIENT_SECRET: "private-secret",
      SPOTIFY_REFRESH_TOKEN: "private-refresh",
    });
    const configured = await page.getServerSideProps({ res: response() });
    assert.deepEqual(configured.props, { configured: true, initialTheme: "dark" });
    const dashboard = renderToStaticMarkup(
      React.createElement(page.default, configured.props),
    );
    for (const title of [
      "Recently played",
      "Top tracks",
      "Top artists",
      "Past 4 weeks",
      "Copy embed",
    ])
      assert.ok(dashboard.includes(title));
    assert.doesNotMatch(
      dashboard,
      /private-client|private-secret|private-refresh/,
    );
    assert.match(dashboard, /data-theme="dark"/);
    if (process.env.NODE_ENV !== "development") assert.doesNotMatch(dashboard, /href="\/login"/);
    const remembered = await page.getServerSideProps({ req: { cookies: { "listening-room-theme": "light" } }, res: response() });
    assert.equal(remembered.props.initialTheme, "light");
    assert.match(renderToStaticMarkup(React.createElement(page.default, remembered.props)), /data-theme="light"/);
    const invalidTheme = await page.getServerSideProps({ req: { cookies: { "listening-room-theme": "invalid" } }, res: response() });
    assert.equal(invalidTheme.props.initialTheme, "dark");
    for (const url of ['https://www.manjiltamang.com/', 'https://github.com/manjillama/spotify-now-playing-widget', 'https://patreon.com/xmarman', 'https://buymeacoffee.com/xmarman']) assert.ok(dashboard.includes(url));
    for (const kind of [
      "now-playing",
      "recently-played",
      "top-tracks",
      "top-artists",
    ]) {
      assert.match(
        dashboard,
        new RegExp(`<img[^>]+src="/api/widgets/${kind}\\?`),
      );
    }
    assert.doesNotMatch(dashboard, /class="track-list"|class="artist-grid"/);
  } finally {
    process.env = savedEnv;
  }
});

test("now-playing survives null items and artwork failures, and returns safe auth errors", async () => {
  const savedNowPlaying = client.nowPlaying;
  const savedFetch = global.fetch;
  const handler = require("../pages/api/widgets/now-playing.ts").default;
  try {
    client.nowPlaying = async () => ({
      item: null,
      is_playing: false,
      progress_ms: 0,
    });
    const idle = response();
    await handler({ query: {} }, idle);
    assert.equal(idle.code, 200);
    assert.match(idle.body, /Nothing playing/);
    const lightArtwork = fs
      .readFileSync(
        require("node:path").join(
          __dirname,
          "../public/assets/default-artwork.jpg",
        ),
      )
      .toString("base64");
    const darkArtwork = fs
      .readFileSync(
        require("node:path").join(
          __dirname,
          "../public/assets/default-artwork-dark.jpg",
        ),
      )
      .toString("base64");
    assert.ok(idle.body.includes(lightArtwork));
    const darkIdle = response();
    await handler({ query: { theme: "dark" } }, darkIdle);
    assert.ok(darkIdle.body.includes(darkArtwork));
    assert.equal(
      darkIdle.headers.Link,
      '</api/widgets/now-playing?theme=dark>; rel="alternate"; type="image/svg+xml"',
    );
    client.nowPlaying = async () => ({
      item: track,
      is_playing: true,
      progress_ms: 0,
    });
    global.fetch = async () => {
      throw new Error("art unavailable");
    };
    const artFailed = response();
    await handler({ query: { theme: "dark" } }, artFailed);
    assert.equal(artFailed.code, 200);
    assert.match(artFailed.body, /A &lt;song&gt; &amp; friends/);
    client.nowPlaying = async () => {
      throw new client.SpotifyError(503, "Finish Spotify setup");
    };
    const authFailed = response();
    await handler({ query: {} }, authFailed);
    assert.equal(authFailed.code, 503);
    assert.equal(authFailed.headers["Cache-Control"], "no-store");
  } finally {
    client.nowPlaying = savedNowPlaying;
    global.fetch = savedFetch;
  }
});

test("dedicated catalog widget routes always return SVG in either theme", async () => {
  const saved = client.spotifyRequest;
  client.spotifyRequest = async () => ({ items: [] });
  try {
    for (const kind of ["recently-played", "top-tracks", "top-artists"]) {
      const handler = require(`../pages/api/widgets/${kind}.ts`).default;
      for (const theme of [undefined, "light", "dark"]) {
        const res = response();
        await handler({ method: "GET", query: { theme, format: "json" } }, res);
        assert.equal(res.code, 200);
        assert.match(res.headers["Content-Type"], /image\/svg/);
        assert.ok(res.body.includes(theme === "dark" ? "#151c18" : "#fff"));
        assert.doesNotMatch(res.body, /foreignObject/);
      }
    }

  } finally {
    client.spotifyRequest = saved;
  }
});

test('now-playing API returns JSON with normalized playback and a dedicated widget link', async () => {
  const saved = client.nowPlaying;
  const handler = require('../pages/api/now-playing.ts').default;
  try {
    client.nowPlaying = async () => ({ item: { ...track, duration_ms: 180000 }, is_playing: true, progress_ms: 1000 });
    const playing = response();
    await handler({ method: 'GET', query: { theme: 'dark' } }, playing);
    assert.equal(playing.code, 200);
    assert.equal(playing.body.item.id, track.id);
    assert.equal(playing.body.isPlaying, true);
    assert.equal(playing.body.duration, 180000);
    assert.equal(playing.body.progress, 1000);
    assert.equal(playing.body.links.widget, '/api/widgets/now-playing?theme=dark');
    client.nowPlaying = async () => ({});
    const idle = response();
    await handler({ method: 'GET', query: {} }, idle);
    assert.equal(idle.body.item, null);
    assert.equal(idle.body.isPlaying, false);
    assert.equal(idle.body.links.widget, '/api/widgets/now-playing?theme=light');
    const invalid = response();
    await handler({ method: 'POST', query: {} }, invalid);
    assert.equal(invalid.code, 405);
    client.nowPlaying = async () => { throw new client.SpotifyError(429, 'Rate limited', '15'); };
    const failed = response();
    await handler({ method: 'GET', query: {} }, failed);
    assert.equal(failed.code, 429);
    assert.equal(failed.headers['Retry-After'], '15');
  } finally { client.nowPlaying = saved; }
});

test('now-playing design supports both sizes and intentional playback states', () => {
  const Player = require('../components/player.tsx').default;
  const { renderToStaticMarkup } = require('react-dom/server');
  const props = { artist: 'Artist', track: 'Track', progress: 65000, duration: 180000, isPlaying: true };
  const large = renderToStaticMarkup(Player({ ...props, size: "large" }));
  assert.match(large, /width="320" height="88"/);
  assert.match(large, /1:05/);
  assert.match(large, /3:00/);
  assert.match(large, /animation: playback 115000ms/);
  const compact = renderToStaticMarkup(Player(props));
  assert.match(compact, /width="256" height="64"/);
  assert.doesNotMatch(compact, /class="player-times"/);
  const paused = renderToStaticMarkup(Player({ ...props, isPlaying: false, theme: 'dark' }));
  assert.match(paused, /PAUSED/);
  assert.doesNotMatch(paused, /animation: playback/);
  const idle = renderToStaticMarkup(Player({ artist: '', progress: NaN, isPlaying: false }));
  assert.match(idle, /NOTHING ON AIR/);
  assert.doesNotMatch(idle, /NaN|undefined/);
});
