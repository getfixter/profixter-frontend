/*
 * The AI recommendation benchmark: ask real assistants the questions homeowners
 * actually ask, and save exactly what they answered.
 *
 *   node scripts/ai-benchmark/run.js <system> [ids] [outDir]
 *     system  chatgpt | bing | gemini
 *     ids     optional comma list, e.g. C1,D1
 *     outDir  default .ai-benchmark-runs/<YYYY-MM-DD>   (git-ignored)
 *   then: node scripts/ai-benchmark/score.js .ai-benchmark-runs/<YYYY-MM-DD>
 *
 * Each prompt runs in a FRESH browser context (no history, no login), so one
 * answer cannot colour the next. Logged-out ChatGPT and Bing Copilot Search
 * were reliably reachable this way in October 2026; Gemini answered a few
 * prompts before asking for sign-in. Perplexity, Google AI Overviews / AI Mode
 * and the Copilot app blocked automation - check those by hand, monthly, with
 * the same prompts (and paste the answers into the run folder as
 * <system>_<id>.json with the same shape, so score.js counts them).
 *
 * LOCATION MATTERS. Local answers depend on where the request comes from. The
 * October baseline ran from a Lindenhurst IP - the most favourable place for
 * Profixter. Note the location of every run in the run folder's meta.json, and
 * when possible repeat from a Nassau and a North Shore location.
 *
 * This only reads public answers. It does not sign in, does not post anything,
 * and sends nothing from the Profixter site.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const system = process.argv[2];
const only = process.argv[3] ? process.argv[3].split(",") : null;
const outDir = process.argv[4] || path.join(".ai-benchmark-runs", new Date().toISOString().slice(0, 10));
if (!["chatgpt", "bing", "gemini"].includes(system)) {
  console.error("usage: node scripts/ai-benchmark/run.js <chatgpt|bing|gemini> [ids] [outDir]");
  process.exit(2);
}

const { prompts } = JSON.parse(fs.readFileSync(path.join(__dirname, "prompts.json"), "utf8"));
const selected = prompts.filter((p) => !only || only.includes(p.id));
fs.mkdirSync(outDir, { recursive: true });
const metaPath = path.join(outDir, "meta.json");
if (!fs.existsSync(metaPath)) {
  fs.writeFileSync(
    metaPath,
    JSON.stringify({ date: new Date().toISOString(), location: process.env.BENCHMARK_LOCATION || "UNRECORDED - set BENCHMARK_LOCATION" }, null, 1)
  );
}

/* Wait until the answer stops changing. Assistants stream; a snapshot taken mid-stream undercounts. */
async function waitStable(read, minIter = 6, need = 5, max = 60) {
  let last = "";
  let stable = 0;
  for (let i = 0; i < max; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const text = await read().catch(() => "");
    const busy = /Reading sources|Searching the web|Thinking|^\s*See reasoning\s*$/.test(text.slice(-200)) && text.length < 400;
    if (text === last && text.length > 150 && !busy && i >= minIter) {
      if (++stable >= need) break;
    } else stable = 0;
    last = text;
  }
  return last;
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  for (const prompt of selected) {
    const context = await browser.newContext({ userAgent: UA, locale: "en-US", timezoneId: "America/New_York", viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    const ts = new Date().toISOString();
    let text = "";
    let links = [];
    let sources = "";
    let error = null;
    try {
      if (system === "bing") {
        await page.goto("https://www.bing.com/copilotsearch?q=" + encodeURIComponent(prompt.text), { waitUntil: "domcontentloaded", timeout: 45000 });
        const frame = () => page.frames().find((f) => f.url().includes("cpltsrchif=1"));
        text = await waitStable(async () => {
          const f = frame();
          return f ? f.innerText("body") : "";
        });
        const f = frame();
        if (f) links = await f.$$eval('a[href^="http"]', (as) => as.map((a) => a.href));
      } else if (system === "chatgpt") {
        await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(6000);
        await page.locator('#prompt-textarea, textarea:visible, [contenteditable="true"]:visible').first().click({ timeout: 15000 });
        await page.keyboard.type(prompt.text, { delay: 25 });
        await page.waitForTimeout(600);
        await page.keyboard.press("Enter");
        text = await waitStable(async () => {
          const body = await page.innerText("body");
          const i = body.indexOf("ChatGPT said:");
          return i < 0 ? "" : body.slice(i + 13).split("ChatGPT is AI and can make mistakes")[0].trim();
        });
        try {
          const button = page.locator("button", { hasText: /^Sources$/ }).last();
          if (await button.count()) {
            await button.click({ timeout: 5000 });
            await page.waitForTimeout(3000);
            const dialog = page.locator('[role="dialog"]');
            if (await dialog.count()) sources = await dialog.last().innerText();
          }
        } catch {
          /* no sources panel */
        }
        links = (await page.$$eval('a[href^="http"]', (as) => as.map((a) => a.href)).catch(() => [])).filter(
          (h) => !/openai\.com|chatgpt\.com/.test(h)
        );
      } else {
        await page.goto("https://gemini.google.com/app", { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(4000);
        await page.locator('rich-textarea [contenteditable="true"], div.ql-editor').first().click({ timeout: 15000 });
        await page.keyboard.type(prompt.text, { delay: 30 });
        await page.keyboard.press("Enter");
        text = await waitStable(async () => {
          const l = page.locator("model-response");
          return (await l.count()) ? l.last().innerText() : "";
        });
        links = await page.$$eval('a[href^="http"]', (as) => as.map((a) => a.href)).catch(() => []);
      }
      if (!text) text = "[NO ANSWER] " + (await page.innerText("body")).slice(0, 1500);
    } catch (e) {
      error = String(e.message || e).slice(0, 300);
    }
    await page.screenshot({ path: path.join(outDir, `${system}_${prompt.id}.png`), fullPage: true }).catch(() => {});
    const record = { system, id: prompt.id, group: prompt.group, prompt: prompt.text, ts, url: page.url(), error, text, links: [...new Set(links)], sources };
    fs.writeFileSync(path.join(outDir, `${system}_${prompt.id}.json`), JSON.stringify(record, null, 1));
    console.log(system, prompt.id, ts, "chars", text.length, "links", record.links.length, error || "");
    await context.close();
    await new Promise((r) => setTimeout(r, 4000));
  }
  await browser.close();
})();
