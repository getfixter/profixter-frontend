const assert = require("assert");
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  const requests = [];
  const responses = [];
  const failures = [];

  await cdp.send("Network.enable");
  cdp.on("Network.requestWillBeSent", (event) => {
    if (event.request.url.includes("/api/calendar/month")) {
      requests.push({
        method: event.request.method,
        url: event.request.url,
        headers: event.request.headers,
        initiator: event.initiator?.type,
      });
    }
  });
  cdp.on("Network.responseReceived", (event) => {
    if (event.response.url.includes("/api/calendar/month")) {
      responses.push({
        status: event.response.status,
        url: event.response.url,
        headers: event.response.headers,
      });
    }
  });
  cdp.on("Network.loadingFailed", (event) => {
    failures.push({
      errorText: event.errorText,
      canceled: event.canceled,
      blockedReason: event.blockedReason || null,
      corsErrorStatus: event.corsErrorStatus || null,
    });
  });

  try {
    await page.goto("https://profixter.com", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const result = await page.evaluate(async () => {
      const response = await fetch(
        "https://api.profixter.com/api/calendar/month?month=2026-07",
        { method: "GET", cache: "no-store" }
      );
      return {
        ok: response.ok,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.json(),
      };
    });

    const availabilityRequests = requests.filter((entry) =>
      entry.url.includes("/api/calendar/month")
    );
    const optionsRequests = availabilityRequests.filter(
      (entry) => entry.method === "OPTIONS"
    );
    const getRequests = availabilityRequests.filter((entry) => entry.method === "GET");
    assert.equal(optionsRequests.length, 0, "safe availability request should not preflight");
    assert.equal(getRequests.length, 1, "safe availability request should perform one GET");
    assert.equal(result.status, 200, "availability request should return HTTP 200");
    assert.equal(result.ok, true, "availability request should be ok");
    assert.equal(result.body.month, "2026-07", "availability response should match month");
    assert(Array.isArray(result.body.days), "availability response should include days array");
    assert.match(
      String(result.headers["cache-control"] || ""),
      /no-store/,
      "availability response should be no-store"
    );

    console.log(JSON.stringify({
      method: getRequests[0].method,
      url: getRequests[0].url,
      status: result.status,
      responseBodyPreview: {
        month: result.body.month,
        dayCount: result.body.days.length,
        firstDay: result.body.days[0],
      },
      requestHeaders: getRequests[0].headers,
      responseHeaders: result.headers,
      optionsPreflightCount: optionsRequests.length,
      requestFailureCount: failures.length,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
