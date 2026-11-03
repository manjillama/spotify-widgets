const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(
      fs.readFileSync(filename, "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      },
    );
    module._compile(outputText, filename);
  };
}
const login = require("../pages/login.tsx").getServerSideProps;
const callback = require("../pages/callback.tsx").getServerSideProps;
function context(query = {}, cookies = {}) {
  const headers = {};
  return {
    query,
    req: { cookies },
    res: {
      setHeader: (key, value) => {
        headers[key] = value;
      },
    },
    headers,
  };
}
test("authorization flow validates state and exchanges codes without exposing credentials", async () => {
  const savedEnv = { ...process.env };
  const savedFetch = global.fetch;
  try {
    process.env.SPOTIFY_CLIENT_ID = "test-client";
    process.env.SPOTIFY_CLIENT_SECRET = "test-secret";
    delete process.env.SPOTIFY_REDIRECT_URI;
    const start = context();
    const result = await login(start);
    const url = new URL(result.redirect.destination);
    assert.equal(url.origin, "https://accounts.spotify.com");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "http://127.0.0.1:3000/callback",
    );
    assert.equal(
      url.searchParams.get("scope"),
      "user-read-playback-state user-read-currently-playing user-read-recently-played user-top-read",
    );
    const state = url.searchParams.get("state");
    assert.match(
      start.headers["Set-Cookie"],
      new RegExp(`spotify_auth_state=${state};.*HttpOnly; SameSite=Lax`),
    );
    let calls = 0;
    global.fetch = async (endpoint, options) => {
      calls++;
      assert.equal(endpoint, "https://accounts.spotify.com/api/token");
      assert.equal(
        options.headers.Authorization,
        `Basic ${Buffer.from("test-client:test-secret").toString("base64")}`,
      );
      assert.equal(
        options.body.get("redirect_uri"),
        url.searchParams.get("redirect_uri"),
      );
      assert.equal(options.body.get("grant_type"), "authorization_code");
      assert.equal(options.body.get("code"), "test-code");
      return {
        ok: true,
        json: async () => ({
          refresh_token: "test-refresh",
          access_token: "never-display",
        }),
      };
    };
    for (const query of [
      { code: "test-code" },
      { state: "bad", code: "test-code" },
      { state: [state], code: "test-code" },
    ]) {
      const invalid = context(query, { spotify_auth_state: state });
      assert.ok((await callback(invalid)).props.error);
      assert.equal(invalid.res.statusCode, 400);
    }
    assert.ok(
      (
        await callback(
          context(
            { state, error: "access_denied" },
            { spotify_auth_state: state },
          ),
        )
      ).props.error,
    );
    assert.ok(
      (await callback(context({ state }, { spotify_auth_state: state }))).props
        .error,
    );
    assert.equal(calls, 0);
    const finish = context(
      { state, code: "test-code" },
      { spotify_auth_state: state },
    );
    assert.deepEqual((await callback(finish)).props, {
      refreshToken: "test-refresh",
      error: null,
    });
    assert.equal(calls, 1);
    assert.equal(finish.headers["Cache-Control"], "private, no-store");
    assert.match(finish.headers["Set-Cookie"], /Max-Age=0/);
    for (const response of [
      { ok: false },
      { ok: true, json: async () => ({}) },
    ]) {
      global.fetch = async () => response;
      const failed = context(
        { state, code: "test-code" },
        { spotify_auth_state: state },
      );
      assert.equal((await callback(failed)).props.refreshToken, null);
      assert.equal(failed.res.statusCode, 502);
    }
    global.fetch = async () => {
      throw new Error("network failure");
    };
    assert.ok(
      (
        await callback(
          context({ state, code: "test-code" }, { spotify_auth_state: state }),
        )
      ).props.error,
    );
    process.env.SPOTIFY_REDIRECT_URI = "https://example.com/callback";
    const hosted = context();
    await login(hosted);
    assert.match(hosted.headers["Set-Cookie"], /; Secure$/);
    process.env.SPOTIFY_REDIRECT_URI = "http://localhost:3000/callback";
    const invalidConfig = context();
    await login(invalidConfig);
    assert.equal(invalidConfig.res.statusCode, 500);
    delete process.env.SPOTIFY_CLIENT_SECRET;
    const missing = context();
    await login(missing);
    assert.equal(missing.res.statusCode, 500);
  } finally {
    process.env = savedEnv;
    global.fetch = savedFetch;
  }
});
