#!/usr/bin/env node
// Scrape Limitless TCG's top Standard decks and write decks/standard.json.
//
// Run:   node scripts/refresh-decks.mjs
//
// Requires Node 18+ (uses built-in fetch). No npm install needed.
// Writes:  decks/standard.json
//
// What it does:
// 1. Fetches the Standard meta deck index (~30 archetypes).
// 2. For each archetype, fetches the page and pulls the top tournament finisher's
//    decklist URL.
// 3. For each decklist, extracts the JSON card array embedded in a hidden form input
//    (cleanest source — has name, set, number, count for every card).
// 4. Writes one JSON file with all archetypes + their top decklists.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const INDEX_URL = "https://play.limitlesstcg.com/decks?format=standard";
const UA = "Mozilla/5.0 (compatible; barrl-pokedex-refresher/1.0)";
const DELAY_MS = 250; // be polite to Limitless

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
  return r.text();
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function getArchetypes() {
  const html = await fetchText(INDEX_URL);
  // unique deck slugs from /decks/<slug>?format=standard
  const re = /href="\/decks\/([^/"?]+)\?format=standard[^"]*"/g;
  const slugs = new Set();
  let m;
  while ((m = re.exec(html))) {
    if (m[1] !== "other") slugs.add(m[1]);
  }
  // pull display name from archetype rows by reading the <td> after each link
  // simpler: derive from slug
  return [...slugs].map((slug) => ({
    slug,
    name: slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
  }));
}

async function getTopDecklistUrl(slug) {
  const url = `https://play.limitlesstcg.com/decks/${slug}?format=standard`;
  const html = await fetchText(url);
  // find the first row's decklist link
  const m = html.match(/href="(\/tournament\/[^/"]+\/player\/[^/"]+\/decklist)"/);
  return m ? `https://play.limitlesstcg.com${m[1]}` : null;
}

function getDeckIcon(slug, html) {
  const m = html.match(
    /<img[^>]*class="pokemon"[^>]*src="(https:\/\/r2\.limitlesstcg\.net\/pokemon\/[^"]+)"/,
  );
  return m ? m[1] : null;
}

async function getDecklist(url) {
  const html = await fetchText(url);
  // parse the HTML directly so we can capture supertype (Pokémon/Trainer/Energy) per card
  const cards = parseAnchorDecklist(html);
  return { cards, icon: getDeckIcon(null, html) };
}

function parseAnchorDecklist(html) {
  // split on each section heading so we don't have to deal with nested div balance
  const out = [];
  const headingRe =
    /<div class="heading">([^(<]+?)\s*\((\d+)\)<\/div>([\s\S]*?)(?=<div class="heading">|<\/div><\/div>|<div class="buttons">)/g;
  let s;
  while ((s = headingRe.exec(html))) {
    const supertype = s[1].trim(); // "Pokémon" | "Trainer" | "Energy"
    const inner = s[3];
    // anchor format varies:
    //   Pokémon:  4 Dreepy (TWM-128)
    //   Trainer:  4 Lillie's Determination
    //   Energy:   3 Psychic Energy
    // capture set+number from href, count + name from anchor body, strip optional "(SET-NUM)" trail
    const cardRe =
      /<a href="https:\/\/limitlesstcg\.com\/cards\/([A-Z0-9]+)\/(\d+)"[^>]*>\s*(\d+)\s+([^<]+?)\s*<\/a>/g;
    let m;
    while ((m = cardRe.exec(inner))) {
      const name = m[4].replace(/\s*\([A-Z0-9]+-\d+\)\s*$/, "").trim();
      out.push({
        supertype,
        count: Number(m[3]),
        name,
        set: m[1],
        number: m[2],
      });
    }
  }
  return out;
}

async function main() {
  console.log(`Fetching index from ${INDEX_URL}`);
  const archetypes = await getArchetypes();
  console.log(`Found ${archetypes.length} archetypes`);

  const decks = [];
  for (const arch of archetypes) {
    try {
      console.log(`  → ${arch.slug}`);
      const dlUrl = await getTopDecklistUrl(arch.slug);
      if (!dlUrl) {
        console.warn(`    no decklist link found, skipping`);
        continue;
      }
      await sleep(DELAY_MS);
      const { cards, icon } = await getDecklist(dlUrl);
      if (!cards?.length) {
        console.warn(`    no cards parsed, skipping`);
        continue;
      }
      decks.push({
        slug: arch.slug,
        name: arch.name,
        icon,
        source: dlUrl,
        cards,
        totalCards: cards.reduce((s, c) => s + c.count, 0),
      });
      await sleep(DELAY_MS);
    } catch (e) {
      console.warn(`    ${arch.slug} failed:`, e.message);
    }
  }

  const out = {
    format: "standard",
    fetched_at: new Date().toISOString(),
    source: INDEX_URL,
    notes:
      "Top-finish decklists per archetype, scraped from play.limitlesstcg.com. " +
      "Run scripts/refresh-decks.mjs to refresh.",
    decks,
  };

  const outPath = path.resolve("decks", "standard.json");
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${decks.length} decks to ${outPath}`);
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
