/*
 * Tell Bing (and the other IndexNow engines) which Profixter URLs changed.
 *
 *   node scripts/indexnow_submit.js                 # every URL in the live sitemap
 *   node scripts/indexnow_submit.js /guides /gift   # just these paths
 *
 * IndexNow is the open protocol Bing, Yandex, Seznam and Naver accept URL
 * submissions through, with no account: ownership is proven by the key file at
 * https://www.profixter.com/<key>.txt (public/<key>.txt), which must contain the
 * key and nothing else. Bing's index also feeds Copilot and ChatGPT's search, so
 * this is the fastest legitimate way to get new and changed pages re-crawled.
 *
 * Submit after a deploy that adds or materially changes pages - not on a
 * schedule, and not for pages that did not change. If Node's fetch is reset by
 * the endpoint (seen October 2026), the same JSON body POSTed with curl works.
 * Google does not use IndexNow;
 * Google picks up the sitemap from robots.txt (or Search Console).
 */
const SITE = "https://www.profixter.com";
const KEY = "fcb86454c853bca4a1bc07419213d129";

async function urlsFromSitemap() {
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

(async () => {
  const keyFile = await fetch(`${SITE}/${KEY}.txt`);
  const keyText = (await keyFile.text()).trim();
  if (!keyFile.ok || keyText !== KEY) {
    console.error(`Key file not live at ${SITE}/${KEY}.txt (status ${keyFile.status}). Deploy it first.`);
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const urlList = args.length ? args.map((p) => (p.startsWith("http") ? p : SITE + p)) : await urlsFromSitemap();
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: "www.profixter.com", key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
  });
  /* 200 = accepted; 202 = accepted, key validation pending. Anything else is a failure. */
  console.log(`IndexNow: HTTP ${res.status} for ${urlList.length} URLs`);
  if (![200, 202].includes(res.status)) {
    console.error(await res.text());
    process.exit(1);
  }
})();
