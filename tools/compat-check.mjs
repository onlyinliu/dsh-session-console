#!/usr/bin/env node
// Replicates DeepSeek Harness's plugin compatibility gate
// (dsh-app-boot `evaluatePluginCompatibility`) against a package.json manifest.
//
// Harness rules being reproduced:
//   * an own `engines.dsh` range decides alone; `@deepseek-ai/dsh*` peers are then ignored
//   * otherwise every `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` peer must match the runtime
//   * ranges are evaluated with `includePrerelease: true`
//
// Usage: node tools/compat-check.mjs [path/to/package.json] [dshVersion...]
// No dependencies: the semver subset below covers comparator, hyphen, tilde and caret ranges,
// which is everything a plugin manifest realistically uses.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const PRERELEASE_ORDER = { alpha: 0, beta: 0, rc: 0 };

function parse(version) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(version).trim());
  if (m === null) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] === undefined ? [] : m[4].split('.'),
  };
}

function compareIdentifiers(a, b) {
  const an = /^\d+$/.test(a);
  const bn = /^\d+$/.test(b);
  if (an && bn) return Number(a) - Number(b);
  if (an) return -1; // numeric identifiers always have lower precedence
  if (bn) return 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compare(left, right) {
  const a = parse(left);
  const b = parse(right);
  if (a === null || b === null) throw new Error(`not a semantic version: ${a === null ? left : right}`);
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1; // a release outranks any prerelease of itself
  if (b.prerelease.length === 0) return -1;
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    if (i >= a.prerelease.length) return -1;
    if (i >= b.prerelease.length) return 1;
    const cmp = compareIdentifiers(a.prerelease[i], b.prerelease[i]);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

/** Expand one range token into primitive comparators. */
function comparators(token) {
  const t = token.trim();
  if (t === '' || t === '*' || t === 'x') return [];
  const lower = (v) => ({ op: '>=', version: v });
  const upper = (v) => ({ op: '<', version: v });
  const bump = (p, which) => ({
    major: which === 'major' ? p.major + 1 : p.major,
    minor: which === 'minor' ? p.minor + 1 : which === 'major' ? 0 : p.minor,
    patch: which === 'patch' ? p.patch + 1 : 0,
  });
  const fmt = (o) => `${o.major}.${o.minor}.${o.patch}-0`; // -0 excludes every prerelease of that release

  if (t.startsWith('^')) {
    const p = parse(t.slice(1));
    if (p === null) throw new Error(`invalid caret range: ${t}`);
    const ceil = p.major > 0 ? bump(p, 'major') : p.minor > 0 ? bump(p, 'minor') : bump(p, 'patch');
    return [lower(t.slice(1)), upper(fmt(ceil))];
  }
  if (t.startsWith('~')) {
    const p = parse(t.slice(1));
    if (p === null) throw new Error(`invalid tilde range: ${t}`);
    // ~1.2.3 and ~1.2 (with or without a prerelease) all allow patches of the same minor
    const ceil = bump(p, 'minor');
    return [lower(t.slice(1)), upper(fmt(ceil))];
  }
  const m = /^(>=|<=|>|<|=)?\s*(.+)$/.exec(t);
  if (m === null) throw new Error(`unsupported range token: ${t}`);
  const op = m[1] ?? '=';
  const raw = m[2];
  const partial = !/^\d+\.\d+\.\d+/.test(raw);
  if (!partial) return [{ op, version: raw }];
  // Partial versions ("5", "5.1") behave as x-ranges: the missing parts are wildcards.
  const p = parse(raw.replace(/^(\d+)(\.(\d+))?$/, (_, ma, __, mi) => `${ma}.${mi ?? 0}.0`));
  if (p === null) throw new Error(`unsupported range token: ${t}`);
  if (op === '=') return [lower(fmt({ ...p, patch: 0 })), upper(fmt(bump(p, 'major')))];
  if (op === '>=') return [{ op: '>=', version: `${p.major}.${p.minor}.0` }];
  if (op === '>') return [{ op: '>=', version: fmt(bump(p, 'major')) }];
  if (op === '<=') return [{ op: '<', version: fmt(bump(p, 'major')) }];
  return [{ op: '<', version: fmt({ ...p, patch: 0 }) }]; // "<" excludes every prerelease of the bound
}

export function satisfies(version, range) {
  if (typeof range !== 'string' || range.trim() === '') return false;
  if (range.includes('||')) return range.split('||').some((part) => satisfies(version, part));
  const tokens = range.trim().replace(/(>=|<=|>|<|=|\^|~)\s+/g, '$1').split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    for (const { op, version: target } of comparators(token)) {
      const cmp = compare(version, target);
      const ok =
        (op === '>=' && cmp >= 0) ||
        (op === '<=' && cmp <= 0) ||
        (op === '>' && cmp > 0) ||
        (op === '<' && cmp < 0) ||
        (op === '=' && cmp === 0);
      if (!ok) return false;
    }
  }
  return true;
}

export function unmetRequirements(manifest, runtimeVersion) {
  const engines = manifest.engines ?? {};
  if (Object.hasOwn(engines, 'dsh')) {
    const range = engines.dsh;
    if (typeof range !== 'string') throw new Error('Plugin manifest engines.dsh must be a string');
    return satisfies(runtimeVersion, range) ? {} : { 'engines.dsh': range };
  }
  const peers = manifest.peerDependencies ?? {};
  const unmet = {};
  for (const [name, range] of Object.entries(peers)) {
    if (name !== '@deepseek-ai/dsh' && !name.startsWith('@deepseek-ai/dsh-')) continue;
    const resolved = ['workspace:^', 'workspace:~', 'workspace:*'].includes(range) ? runtimeVersion : range;
    if (!satisfies(runtimeVersion, resolved)) unmet[name] = range;
  }
  return unmet;
}

const invokedDirectly = process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

if (invokedDirectly) {
  const manifestPath = process.argv[2] ?? 'package.json';
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const explicit = process.argv.slice(3);
  const versions =
    explicit.length > 0
      ? explicit
      : ['0.2.0-rc.2', '0.2.1-rc.5', '0.2.2-alpha.3', '0.2.2-rc.1', '0.2.2', '0.2.9-rc.1'];

  console.log(`${manifest.name}@${manifest.version}  (${path.basename(path.dirname(path.resolve(manifestPath)))})`);
  console.log(`engines.dsh = ${JSON.stringify(manifest.engines?.dsh ?? null)}`);
  let failed = 0;
  for (const version of versions) {
    const unmet = unmetRequirements(manifest, version);
    const ok = Object.keys(unmet).length === 0;
    if (!ok) failed++;
    console.log(`  dsh ${version.padEnd(15)} ${ok ? 'compatible' : `INCOMPATIBLE ${JSON.stringify(unmet)}`}`);
  }
  console.log(failed === 0 ? 'ALL_COMPATIBLE' : `FAILED ${failed} version(s)`);
  process.exit(failed === 0 ? 0 : 1);
}
