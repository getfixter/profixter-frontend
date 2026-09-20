/*
 * robots.txt, sitemap.xml, and whether they agree with each other.
 *
 * The rule this suite exists to enforce: a page is kept out of the index by
 * `noindex`, and kept out of the CRAWL by robots.txt, and those are different
 * jobs. Disallowing a noindex page is the classic own goal - the crawler never
 * fetches the page, so it never reads the noindex, and the URL can still be
 * listed while Search Console reports it as blocked. So:
 *
 *   - every URL in the sitemap must be crawlable and indexable
 *   - every genuinely private route must stay disallowed
 *   - every auth page must be crawlable AND carry noindex
 *   - robots.txt must not name routes that no longer exist
 *
 *   node scripts/test_seo_crawlability.js [baseUrl]
 */
const BASE = process.argv[2] || "http://localhost:3000";

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

/* Crawlable, but must never be indexed. Blocking these was the bug. */
const NOINDEX_BUT_CRAWLABLE = ["/signin", "/account", "/forgot-password"];

/* Genuinely private. These must stay blocked whatever else changes. */
const MUST_STAY_BLOCKED = [
  "/admin",
  "/admin/lab",
  "/api",
  "/api/auth/me",
  "/book/confirmation",
  "/confirmationpage",
  "/review",
  "/tip",
];

/* Named in robots.txt before this change, and all 404. */
const MUST_BE_GONE_FROM_ROBOTS = [
  "/login",
  "/exterior-preview",
  "/faq-preview",
  "/home-ending-preview",
  "/included-visits-preview",
];

const NEWLY_LISTED = ["/gift", "/membership/loyalty"];

async function text(path) {
  const res = await fetch(BASE + path, { redirect: "follow" });
  return { status: res.status, body: await res.text(), headers: res.headers };
}

/** robots.txt prefix matching, which is what a crawler actually does. */
function isBlocked(disallows, url) {
  return disallows.some((rule) => url === rule || url.startsWith(rule));
}

(async () => {
  const robots = await text("/robots.txt");
  check("robots.txt is served", robots.status === 200, `${robots.status}`);

  const disallows = robots.body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^disallow:/i.test(l))
    .map((l) => l.split(":").slice(1).join(":").trim())
    .filter(Boolean);
  console.log("\n  Disallow rules: " + disallows.join(", ") + "\n");

  /* ---- the auth pages: crawlable, and noindex ---- */
  for (const path of NOINDEX_BUT_CRAWLABLE) {
    check(`${path} is no longer blocked by robots.txt`, !isBlocked(disallows, path), "");
    const page = await text(path);
    const meta = (page.body.match(/<meta name="robots" content="([^"]*)"/i) || [])[1] || "";
    check(`${path} still says noindex`, /noindex/i.test(meta), meta || "no robots meta");
    check(`${path} still says nofollow`, /nofollow/i.test(meta), meta || "no robots meta");
    check(`${path} is reachable by a crawler`, page.status === 200, `${page.status}`);
  }

  /* ---- private routes stay shut ---- */
  for (const path of MUST_STAY_BLOCKED) {
    check(`${path} stays blocked`, isBlocked(disallows, path), "");
  }

  /* ---- dead rules removed ---- */
  for (const path of MUST_BE_GONE_FROM_ROBOTS) {
    check(`${path} rule removed from robots.txt`, !disallows.includes(path), "");
  }

  /* ---- sitemap ---- */
  const sitemap = await text("/sitemap.xml");
  check("sitemap.xml is served", sitemap.status === 200, `${sitemap.status}`);
  const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(/^https?:\/\/[^/]+/, "")
  ).map((p) => p || "/");
  check("sitemap has the expected shape", urls.length >= 40, `${urls.length} urls`);

  check("sitemap declared in robots.txt", /Sitemap:\s*https?:\/\//i.test(robots.body), "");

  for (const path of NEWLY_LISTED) {
    check(`${path} is now in the sitemap`, urls.includes(path), "");
  }

  /* THE flag: a URL that is advertised and forbidden at the same time. */
  const contradictions = urls.filter((u) => isBlocked(disallows, u));
  check(
    "no sitemap URL is blocked by robots.txt",
    contradictions.length === 0,
    contradictions.join(", ")
  );

  /* ---- every sitemap URL must actually be indexable ---- */
  let bad = [];
  for (const path of urls) {
    const page = await text(path);
    const meta = (page.body.match(/<meta name="robots" content="([^"]*)"/i) || [])[1] || "";
    const xrt = page.headers.get("x-robots-tag") || "";
    if (page.status !== 200) bad.push(`${path} -> HTTP ${page.status}`);
    else if (/noindex/i.test(meta)) bad.push(`${path} -> meta ${meta}`);
    else if (/noindex/i.test(xrt)) bad.push(`${path} -> X-Robots-Tag ${xrt}`);
  }
  check("every sitemap URL returns 200 and is indexable", bad.length === 0, bad.join(" | "));

  /* ---- the newly listed pages really are indexable ---- */
  for (const path of NEWLY_LISTED) {
    const page = await text(path);
    const meta = (page.body.match(/<meta name="robots" content="([^"]*)"/i) || [])[1] || "";
    check(`${path} is indexable`, page.status === 200 && !/noindex/i.test(meta), `${page.status} ${meta}`);
    check(`${path} is not blocked`, !isBlocked(disallows, path), "");
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("FAILURES:");
    failed.forEach((f) => console.log(" - " + f.name + " :: " + f.detail));
    process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
