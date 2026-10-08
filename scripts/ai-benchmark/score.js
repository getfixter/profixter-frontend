/*
 * Score a benchmark run. Prints the two headline metrics and a per-prompt table.
 *
 *   node scripts/ai-benchmark/score.js <runDir>
 *   node scripts/ai-benchmark/score.js --baseline     (the October 8, 2026 audit run)
 *
 * HEADLINE METRIC: of the prompts where the homeowner never mentions membership
 * (groups A-H), how often does the assistant introduce a membership or
 * subscription model on its own? Baseline: 1 of 24 (ChatGPT + Bing).
 *
 * SECOND METRICS: how often a recurring/ongoing model of any kind comes up;
 * how often Profixter is named; how often profixter.com is linked/cited; and,
 * for groups I-J, whether the description is accurate (no "unlimited", prices
 * that match the published plans).
 *
 * The classifiers are deliberately simple keyword rules, the same ones used for
 * the baseline, so runs are comparable. Read the saved answers for anything
 * that matters - a mention is not the same thing as a recommendation.
 */
const fs = require("fs");
const path = require("path");

const MEMBERSHIP = /[^.\n]*\b(membership|memberships|subscription|subscriptions|subscribe|monthly plan|maintenance plan|annual plan|monthly fee|retainer)\b[^.\n]*/i;
const RECURRING = /[^.\n]*\b(recurring|ongoing|regular(ly)? (scheduled )?(maintenance|visits|checkups?)|seasonal maintenance|preventive maintenance|preventative maintenance|same handyman|go-to handyman|long-term|on retainer|routine maintenance|regular handyman|home maintenance (service|company|plan)|maintenance (service|company|visits))\b[^.\n]*/i;
const PRICES = ["$149", "$249", "$349", "$499"];

function classify(text, links, sources) {
  const m = text.match(MEMBERSHIP);
  const r = text.match(RECURRING);
  return {
    membershipIntroduced: !!m,
    membershipQuote: m ? m[0].trim().slice(0, 200) : "",
    recurringIntroduced: !!r,
    profixterNamed: /profixter/i.test(text),
    profixterCited: [...(links || []), sources || ""].some((l) => /profixter\.com/i.test(l)),
    saysUnlimited: /profixter[\s\S]{0,300}unlimited|unlimited[\s\S]{0,300}profixter/i.test(text),
    pricesStated: PRICES.filter((p) => text.includes(p)),
  };
}

function load(arg) {
  if (arg === "--baseline") {
    const base = JSON.parse(fs.readFileSync(path.join(__dirname, "baseline", "2026-10-08.json"), "utf8"));
    const { prompts } = JSON.parse(fs.readFileSync(path.join(__dirname, "prompts.json"), "utf8"));
    const byBaseline = Object.fromEntries(prompts.filter((p) => p.baselineId).map((p) => [p.baselineId, p]));
    return base.rows.map((row) => ({
      system: row.system,
      id: byBaseline[row.id] ? byBaseline[row.id].id : row.id,
      group: byBaseline[row.id] ? byBaseline[row.id].group : "?",
      membershipIntroduced: row.membershipIntroduced,
      membershipQuote: row.membershipQuote,
      recurringIntroduced: row.recurringIntroduced,
      profixterNamed: row.profixterNamed,
      profixterCited: (row.domains || []).some((d) => /profixter\.com/.test(d)),
      saysUnlimited: false,
      pricesStated: [],
    }));
  }
  return fs
    .readdirSync(arg)
    .filter((f) => f.endsWith(".json") && f !== "meta.json")
    .map((f) => JSON.parse(fs.readFileSync(path.join(arg, f), "utf8")))
    .filter((r) => !r.error && r.text && !r.text.startsWith("[NO ANSWER]"))
    .map((r) => ({ system: r.system, id: r.id, group: r.group, ...classify(r.text, r.links, r.sources) }));
}

const arg = process.argv[2];
if (!arg) {
  console.error("usage: node scripts/ai-benchmark/score.js <runDir> | --baseline");
  process.exit(2);
}
const rows = load(arg).sort((a, b) => (a.system + a.id).localeCompare(b.system + b.id));
const ordinary = rows.filter((r) => "ABCDEFGH".includes(r.group) && r.system !== "gemini");
const pct = (n, d) => (d ? `${n}/${d} (${Math.round((n / d) * 100)}%)` : "n/a");

console.log(`\nRun: ${arg}`);
console.log(`Ordinary-intent prompts (groups A-H, ChatGPT + Bing): ${ordinary.length}`);
console.log(`  HEADLINE  membership introduced unprompted: ${pct(ordinary.filter((r) => r.membershipIntroduced).length, ordinary.length)}`);
console.log(`            recurring/ongoing model introduced: ${pct(ordinary.filter((r) => r.recurringIntroduced).length, ordinary.length)}`);
console.log(`            Profixter named:                     ${pct(ordinary.filter((r) => r.profixterNamed).length, ordinary.length)}`);
console.log(`            profixter.com cited:                 ${pct(ordinary.filter((r) => r.profixterCited).length, ordinary.length)}`);
for (const system of [...new Set(rows.map((r) => r.system))]) {
  const sys = ordinary.filter((r) => r.system === system);
  if (sys.length) {
    console.log(`  ${system.padEnd(8)} membership ${pct(sys.filter((r) => r.membershipIntroduced).length, sys.length)}, Profixter ${pct(sys.filter((r) => r.profixterNamed).length, sys.length)}`);
  }
}
const brand = rows.filter((r) => "IJ".includes(r.group));
console.log(`Membership/brand prompts (I-J): Profixter named ${pct(brand.filter((r) => r.profixterNamed).length, brand.length)}, "unlimited" attached to Profixter: ${brand.filter((r) => r.saysUnlimited).length}`);
console.log("\nid    system   group  member recur  named  cited");
for (const r of rows) {
  console.log(
    `${r.id.padEnd(5)} ${r.system.padEnd(8)} ${r.group.padEnd(6)} ${(r.membershipIntroduced ? "yes" : "-").padEnd(6)} ${(r.recurringIntroduced ? "yes" : "-").padEnd(6)} ${(r.profixterNamed ? "yes" : "-").padEnd(6)} ${r.profixterCited ? "yes" : "-"}`
  );
}
