#!/usr/bin/env node
// Refreshes public/data/models.json from Artificial Analysis.
//
// The leaderboard page at artificialanalysis.ai/leaderboards/models embeds its
// full dataset in the Next.js flight payload ("initialModels" and "releases").
// We parse that payload directly, so no API key is needed.
//
// Usage: node scripts/update-data.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'public', 'data', 'models.json');
const URL = 'https://artificialanalysis.ai/leaderboards/models';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function flightText(html) {
  const re = /self\.__next_f\.push\(\[1,\s*("(?:[^"\\]|\\.)*")\]\)/g;
  let m;
  let out = '';
  while ((m = re.exec(html))) out += JSON.parse(m[1]);
  return out;
}

// Extracts the JSON array that follows a marker like '"initialModels":',
// balancing brackets while respecting strings.
function extractArray(text, marker) {
  const i = text.indexOf(marker);
  if (i < 0) throw new Error(`marker not found: ${marker}`);
  const start = text.indexOf('[', i);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = start; j < text.length; j++) {
    const c = text[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, j + 1));
    }
  }
  throw new Error(`unbalanced array for ${marker}`);
}

const res = await fetch(URL, { headers: { 'user-agent': UA } });
if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
const flight = flightText(await res.text());

const raw = extractArray(flight, '"initialModels":');
const releases = extractArray(flight, '"releases":');
const releaseBySlug = new Map(releases.map((r) => [r.slug, r]));

const models = raw.map((m) => {
  const rel = releaseBySlug.get(m.release?.slug);
  return {
    name: m.name,
    slug: m.release?.slug ?? null,
    creator: m.modelCreatorName,
    creatorColor: m.modelCreatorColor ?? null,
    releaseDate: rel?.releaseDate ?? null,
    reasoning: !!m.isReasoning,
    openWeights: !!m.isOpenWeights,
    context: m.contextWindowTokens ?? null,
    intelligence: m.intelligenceIndex ?? null,
    costPerTask: m.intelligenceIndexCostPerTask ?? null,
    timePerTask: m.intelligenceIndexTimePerTask ?? null,
    speed: m.outputSpeed ?? null,
    ttft: m.timeToFirstAnswerToken ?? m.timeToFirstToken ?? null,
    inputPrice: m.price1mInputTokens ?? null,
    outputPrice: m.price1mOutputTokens ?? null,
    cacheHitPrice: m.cacheHitPrice ?? null,
    cacheWritePrice: m.cacheWritePrice ?? null,
  };
});

models.sort((a, b) => (b.intelligence ?? -1) - (a.intelligence ?? -1));

const payload = {
  generatedAt: new Date().toISOString(),
  source: 'https://artificialanalysis.ai/leaderboards/models',
  count: models.length,
  models,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload));
const withIndex = models.filter((m) => m.intelligence != null).length;
console.log(
  `wrote ${path.relative(ROOT, OUT)}: ${models.length} models (${withIndex} with intelligence index)`,
);