/*
 * Tell Bing (and the other IndexNow engines) which Profixter URLs changed.
 *
 *   node scripts/indexnow_submit.js                 # every URL in the live sitemap
 *   node scripts/indexnow_submit.js --recent 0      # sitemap URLs dated today (1 = today or yesterday)
 *   node scripts/indexnow_submit.js /guides /gift   # just these paths
 *
 * IndexNow is the open protocol Bing, Yandex, Seznam and Naver accept URL
 * submissions through, with no account: ownership is proven by the key file at
 * https://www.profixter.com/<key>.txt (public/<key>.txt), which must contain the
 * key and nothing else. Bing's index also feeds Copilot and ChatGPT's search, so
 * this is the fastest legitimate way to get new and changed pages re-crawled.
 *
 * AUTOMATIC: .github/workflows/indexnow.yml runs `--recent 0` (content dated
 * the deploy day; bump CONTENT_RELEASE_DATE in lib/seo.ts when pages change) after every
 * successful production deployment Vercel reports to GitHub. Because sitemap
 * lastmod is each page's real content date (lib/seo.ts), that submits exactly
 * the pages whose content changed in that release - not the whole site, and
 * nothing when a deploy changed no public page.
 *
 * Google does not use IndexNow; it reads the sitemap (robots.txt, Search Console).
 */
const { execFileSync } = require("child_process");

const SITE = "https://www.profixter.com";
const KEY = "fcb86454c853bca4a1bc07419213d129";
const ENDPOINT = "https://api.indexnow.org/indexnow";

async function sitemapEntries() {
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
    loc: (m[1].match(/<loc>([^<]+)<\/loc>/) || [])[1],
    lastmod: (m[1].match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1],
  }));
}

/* Node's fetch has been reset by the endpoint from some networks; curl is the fallback. */
async function post(body) {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    return { status: res.status, text: await res.text() };
  } catch {
    const out = execFileSync("curl", ["-s", "-m", "30", "-w", "\n%{http_code}", "-H", "Content-Type: application/json; charset=utf-8", "-d", JSON.stringify(body), ENDPOINT], { encoding: "utf8" });
    const lines = out.trimEnd().split("\n");
    return { status: Number(lines.pop()), text: lines.join("\n") };
  }
}

(async () => {
  const keyFile = await fetch(`${SITE}/${KEY}.txt`);
  const keyText = (await keyFile.text()).trim();
  if (!keyFile.ok || keyText !== KEY) {
    console.error(`Key file not live at ${SITE}/${KEY}.txt (status ${keyFile.status}). Deploy it first.`);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let urlList;
  const recentAt = args.indexOf("--recent");
  if (recentAt >= 0) {
    /*
     * Calendar dates, not a rolling 24 hours: sitemap lastmod is a content
     * DATE (midnight UTC), so "--recent 1" means "dated today or yesterday".
     */
    const days = Number(args[recentAt + 1] || 1);
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    urlList = (await sitemapEntries()).filter((e) => e.loc && e.lastmod && e.lastmod.slice(0, 10) >= cutoff).map((e) => e.loc);
  } else if (args.length) {
    urlList = args.map((p) => (p.startsWith("http") ? p : SITE + p));
  } else {
    urlList = (await sitemapEntries()).map((e) => e.loc).filter(Boolean);
  }

  if (!urlList.length) {
    console.log("IndexNow: nothing changed recently, nothing submitted.");
    return;
  }
  const { status, text } = await post({ host: "www.profixter.com", key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList });
  /* 200 = accepted; 202 = accepted, key validation pending. Anything else is a failure. */
  console.log(`IndexNow: HTTP ${status} for ${urlList.length} URLs`);
  for (const url of urlList) console.log(`  ${url}`);
  if (![200, 202].includes(status)) {
    console.error(text);
    process.exit(1);
  }
})();
