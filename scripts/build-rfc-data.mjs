#!/usr/bin/env node
// Builds src/data/rfc.json from the RFC editor index.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  manualOverrides,
  technologyById,
  wgMap,
} from '../src/data/rfc-taxonomy.ts';

const INDEX_URL = 'https://www.rfc-editor.org/rfc-index.xml';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = resolve(root, 'src/data/rfc.json');

function tag(entry, name) {
  const m = entry.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : null;
}

function decode(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function eraTechnology(year) {
  if (year >= 2020) return 'era-2020s';
  if (year >= 2010) return 'era-2010s';
  if (year >= 2000) return 'era-2000s';
  return 'era-1990s';
}

async function loadIndex() {
  const local = process.env.RFC_INDEX_FILE;
  if (local) return readFile(local, 'utf-8');
  const res = await fetch(INDEX_URL);
  if (!res.ok) throw new Error(`failed to fetch the index: ${res.status}`);
  return res.text();
}

async function loadExisting() {
  try {
    return JSON.parse(await readFile(outPath, 'utf-8'));
  } catch {
    return [];
  }
}

const xml = await loadIndex();
const existing = new Map((await loadExisting()).map((e) => [e.number, e]));

const entries = [];
const stats = {
  total: 0,
  obsoleted: 0,
  historic: 0,
  mapped: 0,
  unclassified: 0,
};

for (const [, block] of xml.matchAll(/<rfc-entry>([\s\S]*?)<\/rfc-entry>/g)) {
  stats.total++;

  const docId = tag(block, 'doc-id');
  const number = docId
    ? Number.parseInt(docId.replace(/^RFC/, ''), 10)
    : Number.NaN;
  if (!Number.isFinite(number)) continue;

  if (/<obsoleted-by>/.test(block)) {
    stats.obsoleted++;
    continue;
  }
  const status = tag(block, 'current-status');
  if (status === 'HISTORIC') {
    stats.historic++;
    continue;
  }

  const dateBlock = tag(block, 'date') ?? '';
  const year = Number.parseInt(tag(dateBlock, 'year') ?? '0', 10);
  const rawWg = tag(block, 'wg_acronym');
  const wg = rawWg && rawWg !== 'NON WORKING GROUP' ? rawWg : null;

  const entry = {
    number,
    title: decode(tag(block, 'title') ?? ''),
    year,
    status,
    stream: tag(block, 'stream'),
    wg,
    technology: null,
    subtopic: wg ?? 'none',
  };

  const kept = existing.get(number);
  const override = manualOverrides[number];

  if (kept?.manual) {
    // A hand edit in rfc.json outranks everything, including the taxonomy.
    entry.technology = kept.technology;
    entry.subtopic = kept.subtopic;
    if (kept.subtopicLabel) entry.subtopicLabel = kept.subtopicLabel;
    if (kept.note) entry.note = kept.note;
    entry.manual = true;
  } else if (override) {
    entry.technology = override[0];
    entry.subtopic = 'manual';
    entry.subtopicLabel = override[1];
    entry.manual = true;
  } else if (wg && wgMap[wg]) {
    entry.technology = wgMap[wg][0];
  } else {
    entry.technology = eraTechnology(year);
  }

  if (!technologyById.has(entry.technology)) {
    throw new Error(`RFC ${number}: unknown technology "${entry.technology}"`);
  }
  if (entry.technology.startsWith('era-')) stats.unclassified++;
  else stats.mapped++;

  entries.push(entry);
}

entries.sort((a, b) => a.number - b.number);

// A truncated fetch would otherwise silently wipe most of the file.
if (existing.size > 0 && entries.length < existing.size * 0.9) {
  throw new Error(
    `refusing to write: ${entries.length} entries vs ${existing.size} existing`,
  );
}

await writeFile(outPath, `${JSON.stringify(entries, null, 2)}\n`);

const live = entries.length;
console.log(
  [
    `index entries : ${stats.total}`,
    `obsoleted     : ${stats.obsoleted}`,
    `historic      : ${stats.historic}`,
    `written       : ${live}`,
    `  classified  : ${stats.mapped} (${((stats.mapped / live) * 100).toFixed(1)}%)`,
    `  unclassified: ${stats.unclassified}`,
  ].join('\n'),
);

const unmapped = new Map();
for (const e of entries) {
  if (!e.technology.startsWith('era-') || !e.wg) continue;
  unmapped.set(e.wg, (unmapped.get(e.wg) ?? 0) + 1);
}
if (unmapped.size > 0) {
  const top = [...unmapped].sort((a, b) => b[1] - a[1]).slice(0, 25);
  console.log(
    `\nunmapped working groups (top ${top.length} of ${unmapped.size}):`,
  );
  console.log(top.map(([w, c]) => `  ${w} (${c})`).join('\n'));
}
