# llmrank

AI model benchmark comparison: intelligence, cost per task, end-to-end time,
output speed and token pricing across 280+ models. Inspired by
[benchmark.surf](https://benchmark.surf/), with the full model catalog instead
of a curated subset.

Data comes from [Artificial Analysis](https://artificialanalysis.ai/). The
leaderboard page embeds its complete dataset in the Next.js flight payload, so
`scripts/update-data.mjs` parses it directly — no API key required.

## Features

- 287 models, 125 with an Artificial Analysis Intelligence Index score
- Filter by creator (Anthropic, OpenAI, Google, Meta, Alibaba, DeepSeek, Kimi,
  Z AI, …), minimum intelligence, maximum cost per task, maximum time per task
- Free-text search, sortable columns, toggleable columns
- Light / dark theme, filters persisted in localStorage
- Static site, no build step, no runtime dependencies

## Develop

Any static file server works:

```sh
python3 -m http.server 8080 --directory public
# or: npm run dev  (wrangler dev)
```

## Refresh data

```sh
node scripts/update-data.mjs
```

Rewrites `public/data/models.json` from the live Artificial Analysis
leaderboard. Commit the result and redeploy to publish an update.

## Deploy (Cloudflare Workers static assets)

```sh
npm install
npm run deploy
```

Requires a Cloudflare API token (`CLOUDFLARE_API_TOKEN`) with Workers deploy
permissions, or an interactive `wrangler login`.

## Attribution

All benchmark data is sourced from Artificial Analysis. llmrank is not
affiliated with Artificial Analysis.