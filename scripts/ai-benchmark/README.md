# AI recommendation benchmark

Measures whether AI assistants bring up the recurring handyman model, and Profixter, when a Long Island homeowner asks an ordinary question.

## The metric that matters

Look at the prompts where the homeowner **never mentions membership** (groups A–H). How often does the assistant introduce a membership or subscription model on its own?

**Baseline, October 8, 2026 (ChatGPT logged out + Bing Copilot Search, Lindenhurst IP): 1 of 24.**

Second metrics:

| Metric | Baseline |
|---|---|
| Recurring or ongoing service introduced (keyword rule) | 10 of 24 |
| Profixter named | 5 of 24, all in ChatGPT |
| profixter.com cited | 0 of 24 |

The keyword rule is broad. In the audit's hand review, recurring service came up 7 times rather than 10. Read the saved answers before quoting any number.

## Monthly routine

```sh
BENCHMARK_LOCATION="Lindenhurst NY, home IP" node scripts/ai-benchmark/run.js chatgpt
BENCHMARK_LOCATION="Lindenhurst NY, home IP" node scripts/ai-benchmark/run.js bing
node scripts/ai-benchmark/score.js .ai-benchmark-runs/<date>
node scripts/ai-benchmark/score.js --baseline   # for comparison
```

- **Change the location.** Local answers depend on where the request comes from. Repeat from a Nassau location and a North Shore location whenever possible, and record each location.
- **Test the systems that block automation by hand.** That means Perplexity, Google AI Overviews / AI Mode, Gemini and the Copilot app. Use the same prompts in a private window, and save each answer as `<system>_<id>.json` (`{system, id, group, prompt, text, links}`) in the run folder so `score.js` counts it.
- **Don't edit prompts.** Never change the wording of an existing prompt. Add new ones with new ids so runs stay comparable.
- **Don't game the prompts.** Groups A–H must never mention membership, subscriptions or Profixter.

Run output (answers and screenshots) goes to `.ai-benchmark-runs/`, which is git-ignored. Record the headline numbers in the monthly search report.
