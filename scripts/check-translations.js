#!/usr/bin/env node
/**
 * Translation checker for public/lang/*.json
 *
 * Compares every locale file against en.json (the source of truth) and reports:
 *   - keys present in English but missing from the locale
 *   - keys present in the locale but no longer in English (stale)
 *   - interpolation placeholder mismatches, e.g. {count} in EN but not in the translation
 *   - values that are still byte-identical to English (untranslated leftovers)
 *
 * Usage:
 *   node scripts/check-translations.js              # report only, always exits 0
 *   node scripts/check-translations.js --strict     # exit 1 if any locale has problems
 *   node scripts/check-translations.js --locale nb  # limit to one locale
 *   node scripts/check-translations.js --quiet      # summary lines only
 *
 * Dependency-free by design: plain Node, no packages.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const LANG_DIR = path.join(here, '..', 'public', 'lang');
const SOURCE_LOCALE = 'en';
const MAX_LISTED = 25; // per category, to keep CI logs readable
// The UI uses both {{name}} (i18n interpolation) and {name} in a few older strings.
const PLACEHOLDER_RE = /\{\{[a-zA-Z0-9_]+\}\}|\{[a-zA-Z0-9_]+\}/g;

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const quiet = args.includes('--quiet');
const localeArg = (() => {
  const i = args.indexOf('--locale');
  return i !== -1 ? args[i + 1] : null;
})();

/** Flatten a nested translation object into `a.b.c` -> value pairs. */
function flatten(obj, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, full, out);
    } else {
      out.set(full, value);
    }
  }
  return out;
}

function readLocale(file) {
  const raw = fs.readFileSync(path.join(LANG_DIR, file), 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`${file} is not valid JSON: ${err.message}`);
  }
}

function placeholders(value) {
  if (typeof value !== 'string') return [];
  return [...new Set(value.match(PLACEHOLDER_RE) || [])].sort();
}

function list(label, items) {
  if (!items.length) return;
  console.log(`  ${label} (${items.length}):`);
  if (quiet) return;
  for (const item of items.slice(0, MAX_LISTED)) console.log(`    - ${item}`);
  if (items.length > MAX_LISTED) console.log(`    … and ${items.length - MAX_LISTED} more`);
}

function main() {
  if (!fs.existsSync(LANG_DIR)) {
    console.error(`Language directory not found: ${LANG_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(LANG_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const sourceFile = `${SOURCE_LOCALE}.json`;
  if (!files.includes(sourceFile)) {
    console.error(`Source locale ${sourceFile} is missing from ${LANG_DIR}`);
    process.exit(1);
  }

  const source = flatten(readLocale(sourceFile));
  console.log(`Source locale: ${sourceFile} (${source.size} keys)\n`);

  let problems = 0;

  for (const file of files) {
    const locale = path.basename(file, '.json');
    if (locale === SOURCE_LOCALE) continue;
    if (localeArg && locale !== localeArg) continue;

    const target = flatten(readLocale(file));

    const missing = [];
    const untranslated = [];
    const placeholderMismatch = [];

    for (const [key, value] of source) {
      if (!target.has(key)) {
        missing.push(key);
        continue;
      }
      const translated = target.get(key);
      const expected = placeholders(value);
      const actual = placeholders(translated);
      if (expected.join(',') !== actual.join(',')) {
        placeholderMismatch.push(`${key}: expected ${expected.join(' ') || '(none)'} — got ${actual.join(' ') || '(none)'}`);
      }
      if (typeof value === 'string' && value.length > 3 && value === translated) {
        untranslated.push(key);
      }
    }

    const stale = [...target.keys()].filter((key) => !source.has(key));

    const total = missing.length + stale.length + placeholderMismatch.length;
    const status = total === 0 ? 'OK' : 'ISSUES';
    console.log(`${file} — ${target.size} keys — ${status}`);
    list('missing keys', missing);
    list('stale keys (not in English)', stale);
    list('placeholder mismatches', placeholderMismatch);
    // Identical-to-English values are informational only: many UI strings
    // (product names, units, "OK") are legitimately the same in both languages.
    if (untranslated.length) console.log(`  identical to English (informational): ${untranslated.length}`);
    console.log('');

    problems += total;
  }

  if (problems === 0) {
    console.log('All locales are complete and consistent.');
    return;
  }

  console.log(`Found ${problems} translation problem(s).`);
  if (strict) process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
