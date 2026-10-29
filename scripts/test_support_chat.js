/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like the other scripts/test_*.js */
/**
 * The support chat's non-React parts: where it may appear, the SSE parser,
 * error wording and link handling.
 *
 *   node scripts/test_support_chat.js
 *
 * No server needed: the modules are transpiled in place, like the calendar
 * unit tests do.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const root = path.join(__dirname, "..");

function load(file, requireFn = require) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function("exports", "require", "module", output)(mod.exports, requireFn, mod);
  return mod.exports;
}

const surface = load("lib/surface.ts");
const core = load("app/components/support/support-chat-core.ts", (id) =>
  id === "@/lib/surface" ? surface : require(id)
);

/* Where it shows. */
for (const p of ["/", "/membership", "/membership/plans", "/services", "/services/tv-mounting", "/projects", "/about", "/account", "/gift", "/locations/babylon", "/book/confirmation", "/signage"]) {
  assert.strictEqual(core.supportChatVisibleOn(p), true, `should show on ${p}`);
}
for (const p of ["/admin", "/admin/lab", "/event", "/sign/abc123", "/signin", "/signup", "/register", "/forgot-password", "/book", "/book/free", "/gift/claim/tok", "/review", "/tip", "/confirmationpage", "/m/abc", "/july4"]) {
  assert.strictEqual(core.supportChatVisibleOn(p), false, `should hide on ${p}`);
}
assert.strictEqual(core.supportChatVisibleOn(null), true);

/* SSE parsing across arbitrary chunk boundaries. */
const events = [];
const parser = core.createSseParser((e) => events.push(e));
parser.push('data: {"status":"typ');
parser.push('ing"}\n\ndata: {"token":"Hel"}\n\ndata: {"tok');
parser.push('en":"lo"}\r\n\r\ndata: not-json\n\n');
parser.push('data: {"done":true}');
parser.end();
assert.deepStrictEqual(events, [{ status: "typing" }, { token: "Hel" }, { token: "lo" }, { done: true }]);

/* Errors: the server's wording only for visitor-facing codes. */
const limited = { error: "You have sent a lot of messages in a short time.", code: "rate_limited" };
assert.strictEqual(core.friendlyError(limited), limited.error);
assert.ok(core.friendlyError({ error: "Chatbot failed" }).includes("631-599-1363"));
assert.ok(!core.friendlyError({ error: "Chatbot failed" }).includes("Chatbot failed"));
assert.ok(core.friendlyError(null).includes("try again"));

/* Links: Profixter links become relative, trailing punctuation stays text. */
const parts = core.splitLinks("Compare plans at https://profixter.com/membership/plans. Or https://www.profixter.com/book?visit=full-day, or https://example.com/x");
const links = parts.filter((p) => p.type === "link");
assert.deepStrictEqual(links.map((l) => l.href), ["/membership/plans", "/book?visit=full-day", "https://example.com/x"]);
assert.ok(parts.some((p) => p.type === "text" && p.value.startsWith(". Or")));
assert.deepStrictEqual(core.splitLinks("no links here"), [{ type: "text", value: "no links here" }]);

/* Never mounted from a retired page, and never links to one. */
const widget = fs.readFileSync(path.join(root, "app/components/support/SupportChat.tsx"), "utf8");
assert.ok(!/home-support|shower-studio/.test(widget));

console.log("support chat: all checks passed");
