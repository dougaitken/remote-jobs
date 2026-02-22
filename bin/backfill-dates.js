#!/usr/bin/env node

/**
 * Backfill addedAt and updatedAt dates into company frontmatter
 * from git history, tracing through the old company-profiles/ path.
 *
 * Usage:
 *   node bin/backfill-dates.js                  # dry-run, prints results
 *   node bin/backfill-dates.js --write           # writes to files
 *   node bin/backfill-dates.js --slug stripe     # single file test
 */

import { execSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Commits that are migration/infrastructure — not real content updates
const EXCLUDE_COMMITS = new Set([
  '181b5b45a423bf193ecf3d06ef5b27756e102f05', // Add Eleventy company profiles and migration script
  '039278d50c0bb8f1ea9bd37d290dd80ab65313c1', // overhaul
  'f36316605be52039e0eb7b8a58cf711e4f0b0a0c', // Merge dry-run: Replace build system with Eleventy
  '89682bb13b12b8330d0150bed266daaf78c57f6d', // Redesign site with curated homepage and structured company data
  '97096be5cf4cdd5a8c74a4fee13376d64bee53c3', // Remove legacy files and clean up build scripts
  '370b145d72756d6942e281814f9d365956da3fcf', // SEO improvements and company URL fixes
  'dfdb995b7212818932a47a45923cf79cf56f1ec5', // Site improvements: search, dates, OG images, and documentation updates
]);

const companiesDir = './src/companies';
const args = process.argv.slice(2);
const doWrite = args.includes('--write');
const singleSlug = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;

/**
 * Get commit history for a file path, following renames.
 * Returns array of { hash, date } from newest to oldest.
 */
function getHistory(filePath) {
  try {
    const output = execSync(
      `git log --follow --format="%H %ci" -- "${filePath}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return output.trim().split('\n').filter(Boolean).map(line => {
      const [hash, ...rest] = line.split(' ');
      const date = rest.slice(0, 1)[0]; // YYYY-MM-DD
      return { hash, date };
    });
  } catch {
    return [];
  }
}

/**
 * Given a slug, find the best addedAt and updatedAt dates.
 */
function getDatesForSlug(slug) {
  // Try both old and new paths
  const newPath = `src/companies/${slug}.md`;
  const oldPath = `company-profiles/${slug}.md`;

  // Get history from old path (follows renames, goes back to 2015)
  const oldHistory = getHistory(oldPath);
  // Get history from new path
  const newHistory = getHistory(newPath);

  // Merge and deduplicate by hash
  const seen = new Set();
  const allCommits = [];
  for (const entry of [...newHistory, ...oldHistory]) {
    if (!seen.has(entry.hash)) {
      seen.add(entry.hash);
      allCommits.push(entry);
    }
  }

  if (allCommits.length === 0) {
    return { addedAt: null, updatedAt: null, commits: 0, realCommits: 0 };
  }

  // Filter out migration commits for updatedAt
  const realCommits = allCommits.filter(c => !EXCLUDE_COMMITS.has(c.hash));

  // addedAt = earliest commit (last in the list, since newest-first)
  const addedAt = allCommits[allCommits.length - 1].date;

  // updatedAt = most recent non-migration commit (first in filtered list)
  const updatedAt = realCommits.length > 0 ? realCommits[0].date : null;

  return {
    addedAt,
    updatedAt,
    commits: allCommits.length,
    realCommits: realCommits.length
  };
}

/**
 * Insert or update addedAt/updatedAt in frontmatter
 */
function updateFrontmatter(filePath, addedAt, updatedAt) {
  const content = readFileSync(filePath, 'utf-8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return content;

  let fm = fmMatch[1];

  // Remove existing addedAt/updatedAt
  fm = fm.replace(/^addedAt:.*\n?/m, '');
  fm = fm.replace(/^updatedAt:.*\n?/m, '');

  // Remove trailing whitespace/newlines from frontmatter
  fm = fm.trimEnd();

  // Add dates at the end of frontmatter
  if (addedAt) fm += `\naddedAt: ${addedAt}`;
  if (updatedAt) fm += `\nupdatedAt: ${updatedAt}`;

  const newContent = content.replace(/^---\n[\s\S]*?\n---/, `---\n${fm}\n---`);
  return newContent;
}

// Main
const files = singleSlug
  ? [`${singleSlug}.md`]
  : readdirSync(companiesDir).filter(f => f.endsWith('.md'));

let noHistory = 0;
let noRealUpdates = 0;
let updated = 0;

for (const file of files) {
  const slug = file.replace('.md', '');
  const dates = getDatesForSlug(slug);

  if (singleSlug || !doWrite) {
    console.log(`${slug}: addedAt=${dates.addedAt} updatedAt=${dates.updatedAt} (${dates.commits} commits, ${dates.realCommits} real)`);
  }

  if (!dates.addedAt) {
    noHistory++;
    continue;
  }

  if (!dates.updatedAt) {
    noRealUpdates++;
  }

  if (doWrite) {
    const filePath = join(companiesDir, file);
    const newContent = updateFrontmatter(filePath, dates.addedAt, dates.updatedAt);
    writeFileSync(filePath, newContent, 'utf-8');
    updated++;
  }
}

console.log(`\n--- Summary ---`);
console.log(`Total files: ${files.length}`);
console.log(`No git history: ${noHistory}`);
console.log(`No real updates (only migration commits): ${noRealUpdates}`);
if (doWrite) {
  console.log(`Files written: ${updated}`);
} else {
  console.log(`Dry run — pass --write to update files`);
}
