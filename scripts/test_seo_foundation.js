/*
 * The search foundation, checked from the served HTML - what a crawler or an AI
 * retrieval system actually receives, before any JavaScript runs.
 *
 * Written for the October 2026 search implementation. It encodes the defects
 * that audit found so they cannot quietly come back:
 *
 *   - every sitemap URL is 200, indexable, and canonical to ITSELF
 *     (/membership/plans pointed at /membership; /gift pointed at /)
 *   - no page inherits the homepage canonical
 *   - all four plan prices, monthly AND annual, are in /membership/plans HTML
 *   - the One-Time price is in /book HTML, and /book has one consistent H1
 *   - sitemap lastmod is a real content date, not "now"; no expired promos
 *   - every JSON-LD block parses, and the business node carries the entity
 *     fields (legalName, address, hours, sameAs, license)
 *   - forbidden membership wording never appears ("unlimited", "no monthly
 *     visit limit", "active booking"), and the license is never attributed to
 *     New York State
 *   - published fallback prices match the live booking settings
 *   - the protected marketing tags are present exactly once and unchanged:
 *     one base-pixel init with the known pixel id, the GTM container, no new pixel
 *     events added by SEO pages
 *
 *   node scripts/test_seo_foundation.js [baseUrl]
 */
const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const SITE = "https://www.profixter.com";
const API = "https://api.profixter.com";
/*
 * The pixel id is read from the one constant that defines it, never restated:
 * the backend guard (test_meta_pixel_guard) fails the build if the id or a
 * base-pixel init call appears anywhere else in application code.
 */
const PIXEL_ID = (require("fs").readFileSync(require("path").join(__dirname, "..", "lib", "meta-config.ts"), "utf8").match(/META_PIXEL_ID = "(\d+)"/) || [])[1];
const INIT_CALL = ["fbq(", "'init'"].join("");
const GTM_ID = "GTM-KFPSD2P6";

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

async function get(path) {
  const res = await fetch(BASE + path, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" } });
  const text = res.status === 200 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location"), html: text };
}

const attr = (html, re) => (html.match(re) || [])[1] || null;
const canonicalOf = (html) => attr(html, /<link rel="canonical" href="([^"]+)"/);
const robotsOf = (html) => attr(html, /<meta name="robots" content="([^"]+)"/);
const titleOf = (html) => attr(html, /<title>([^<]*)<\/title>/);
const h1s = (html) => [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
const visibleText = (html) =>
  html
    .replace(/<!-- -->/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ");
const jsonLd = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => {
    try {
      return { ok: true, data: JSON.parse(m[1]) };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
const toPath = (url) => url.replace(SITE, "") || "/";

(async () => {
  /* ---------------- sitemap ---------------- */
  const sm = await get("/sitemap.xml");
  const urls = [...sm.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const lastmods = [...sm.html.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1].slice(0, 10));
  check("sitemap lists pages", urls.length > 40, `${urls.length} URLs`);
  const rawLastmods = [...sm.html.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  const distinctDates = new Set(lastmods);
  /* "now" carries a time of day; a content date is midnight UTC. */
  const timestamped = rawLastmods.filter((v) => !/T00:00:00(\.000)?Z$/.test(v) && v.length > 10);
  check("sitemap lastmod is real content dates, not 'now'", distinctDates.size > 3 && timestamped.length === 0, `${distinctDates.size} distinct dates, ${timestamped.length} timestamped`);
  check("expired /july4 promotion is out of the sitemap", !urls.some((u) => u.endsWith("/july4")));
  for (const must of ["/membership/plans", "/handyman-membership", "/book/free", "/gift", "/guides", "/guides/handyman-for-small-jobs", "/locations/massapequa"]) {
    check(`sitemap includes ${must}`, urls.includes(SITE + must));
  }

  /* ---------------- every sitemap URL ---------------- */
  const pages = {};
  const titles = new Map();
  let ldErrors = 0;
  let selfCanonical = 0;
  for (const url of urls) {
    const path = toPath(url);
    const page = await get(path);
    pages[path] = page;
    const canonical = canonicalOf(page.html);
    const robots = robotsOf(page.html) || "";
    const ok = page.status === 200 && canonical === url && !/noindex/.test(robots);
    if (ok) selfCanonical += 1;
    else check(`sitemap page is 200, indexable, self-canonical: ${path}`, false, `status ${page.status}, canonical ${canonical}, robots ${robots}`);
    const title = titleOf(page.html);
    if (title) titles.set(title, [...(titles.get(title) || []), path]);
    for (const block of jsonLd(page.html)) if (!block.ok) ldErrors += 1;
    const pageH1s = h1s(page.html);
    if (pageH1s.length !== 1) check(`exactly one H1: ${path}`, false, `${pageH1s.length}: ${pageH1s.join(" | ").slice(0, 120)}`);
  }
  check("every sitemap page is 200, indexable and canonical to itself", selfCanonical === urls.length, `${selfCanonical}/${urls.length}`);
  const dupTitles = [...titles.entries()].filter(([, paths]) => paths.length > 1);
  check("no duplicate titles across sitemap pages", dupTitles.length === 0, dupTitles.map(([t, p]) => `${t} -> ${p.join(", ")}`).join("; "));
  check("every JSON-LD block parses", ldErrors === 0, `${ldErrors} errors`);
  const multiH1 = Object.entries(pages).filter(([, p]) => h1s(p.html).length !== 1).length;
  check("every sitemap page has exactly one H1", multiH1 === 0, `${multiH1} pages differ`);

  /* ---------------- no inherited homepage canonical ---------------- */
  for (const path of ["/signup", "/gift", "/book/free", "/guides"]) {
    const page = pages[path] || (await get(path));
    const canonical = canonicalOf(page.html);
    check(`${path} does not canonicalize to the homepage`, canonical !== SITE && canonical !== `${SITE}/`, String(canonical));
  }

  /* ---------------- plans: all prices in the HTML ---------------- */
  const plansText = visibleText(pages["/membership/plans"].html);
  for (const price of ["$149", "$249", "$349", "$499", "$1,490", "$2,490", "$3,490", "$4,990"]) {
    check(`/membership/plans HTML states ${price}`, plansText.includes(price));
  }
  check("/membership/plans has its own title", /Plans/.test(titleOf(pages["/membership/plans"].html) || ""), titleOf(pages["/membership/plans"].html));

  /* ---------------- book ---------------- */
  const bookHtml = pages["/book"].html;
  check("/book HTML states the One-Time price", visibleText(bookHtml).includes("$99"));
  check("/book H1 is the hub heading the live page also uses", h1s(bookHtml)[0] === "Book a Profixter handyman visit", h1s(bookHtml).join(" | "));

  /* ---------------- gift ---------------- */
  const giftHtml = pages["/gift"].html;
  check("/gift is server-rendered with real content", visibleText(giftHtml).length > 1500 && /How a gift membership works/.test(giftHtml), `${visibleText(giftHtml).length} chars`);

  /* ---------------- structured data: the business node ---------------- */
  const home = pages["/"].html;
  const graph = jsonLd(home).flatMap((b) => (b.ok && b.data["@graph"] ? b.data["@graph"] : []));
  const business = graph.find((node) => String(node["@id"] || "").endsWith("/#business"));
  check("business node exists", !!business);
  if (business) {
    check("business: legalName", business.legalName === "Premium Island Homes Inc.");
    check("business: address locality, no street", business.address && business.address.addressLocality === "Lindenhurst" && !business.address.streetAddress);
    check("business: opening hours", Array.isArray(business.openingHoursSpecification) && business.openingHoursSpecification.length > 0);
    check("business: sameAs includes the Google profile", (business.sameAs || []).some((u) => u.includes("maps.google.com")));
    check("business: license credential names Suffolk County", /Suffolk County/.test(JSON.stringify(business.hasCredential || {})));
    check("business: no self-serving aggregateRating", !business.aggregateRating);
  }
  const breadcrumbPages = ["/guides/handyman-for-small-jobs", "/locations/lindenhurst", "/services/tv-mounting", "/handyman-membership"];
  for (const path of breadcrumbPages) {
    const has = jsonLd((pages[path] || (await get(path))).html).some((b) => b.ok && b.data["@type"] === "BreadcrumbList");
    check(`BreadcrumbList on ${path}`, has);
  }

  /* ---------------- wording rules ---------------- */
  const forbidden = [
    [/unlimited visits/i, "unlimited visits"],
    [/no monthly visit limit/i, "no monthly visit limit"],
    [/active booking|active appointment/i, "active booking"],
    [/NY State Licensed|New York State Dept|NYS Department of State|NY HIC/i, "license attributed to New York State"],
    [/licensed in (both )?Nassau/i, "licensed in Nassau"],
    [/\b(first|only) handyman membership\b/i, "first/only claim"],
  ];
  for (const [re, label] of forbidden) {
    const hits = Object.entries(pages).filter(([, p]) => re.test(visibleText(p.html))).map(([path]) => path);
    check(`no "${label}" in any sitemap page`, hits.length === 0, hits.join(", "));
  }

  /* ---------------- live prices match the published fallbacks ---------------- */
  try {
    const oneTime = await (await fetch(`${API}/api/bookings/one-time/config`)).json();
    const fullDay = await (await fetch(`${API}/api/bookings/full-day/config`)).json();
    check("live One-Time price is $99 / 90 minutes (lib/business.ts fallback)", oneTime.priceCents === 9900 && oneTime.durationMinutes === 90, `${oneTime.priceCents} / ${oneTime.durationMinutes}`);
    check("live Full Day price is $499 (lib/business.ts fallback)", fullDay.priceCents === 49900, String(fullDay.priceCents));
  } catch (error) {
    check("live booking settings reachable", false, String(error));
  }

  /* ---------------- protected marketing tags ---------------- */
  /*
   * The pixel and GTM snippets are compared byte for byte with what production
   * serves today. (Each appears twice in the raw HTML - once as the script
   * element, once inside React's serialized payload - on production too, so the
   * check counts script ELEMENTS, not string matches.)
   */
  const pixelScript = (html) => attr(html, /<script id="meta-pixel">([\s\S]*?)<\/script>/);
  const gtmSnippet = (html) => attr(html, /(\(function\(w,d,s,l,i\)[\s\S]*?'GTM-KFPSD2P6'\);)/);
  const prodHome = await (await fetch(SITE + "/")).text();
  const prodPixel = pixelScript(prodHome);
  const prodGtm = gtmSnippet(prodHome);
  for (const path of ["/", "/membership/plans", "/guides/handyman-for-small-jobs", "/locations/massapequa", "/gift", "/book", "/handyman-membership"]) {
    const html = (pages[path] || (await get(path))).html;
    const elements = (html.match(/<script id="meta-pixel">/g) || []).length;
    check(`${path}: one Meta Pixel script, identical to production`, elements === 1 && pixelScript(html) === prodPixel && html.includes(`${INIT_CALL}, '${PIXEL_ID}')`), `${elements} elements`);
    check(`${path}: GTM snippet identical to production`, !!prodGtm && gtmSnippet(html) === prodGtm);
    check(`${path}: noscript pixel and GTM iframe present`, html.includes(`facebook.com/tr?id=${PIXEL_ID}`) && html.includes(`ns.html?id=${GTM_ID}`));
  }

  /* ---------------- redirects ---------------- */
  for (const [path, status] of [["/services/subscription", 308], ["/services/home-improvement", 308], ["/on-demand", 308], ["/membership-info", 308]]) {
    const res = await get(path);
    check(`${path} redirects permanently`, res.status === status, `${res.status} -> ${res.location}`);
  }
  for (const path of ["/landing", "/landing-b"]) {
    const res = await get(`${path}?utm_source=fb&utm_campaign=1234567`);
    check(`${path} ad landing redirect unchanged (307, keeps query)`, res.status === 307 && /utm_campaign=1234567/.test(res.location || ""), `${res.status} -> ${res.location}`);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
