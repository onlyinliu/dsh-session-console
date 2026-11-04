/**
 * dsh-session-console — Host half.
 *
 * Registers read-only aggregation routes plus two action routes under
 * `/plugins/dsh-session-console/*`, and mirrors the same capability as agent
 * tools so a conversation can be steered with a single sentence
 * ("示例项目的相关内容怎么样了").
 *
 * Design notes
 * - Every session metric comes from already-materialized data: the
 *   `sessionController` summary (title / tokenUsage / contextPressure /
 *   sessionListMetadata wire projections) instead of rescanning event logs.
 *   Event-log reads happen only on the explicit `tail` / `detail` routes.
 * - No new Session event types are appended and no Session projections are
 *   registered: this plugin is a pure reader plus the existing prompt channel.
 * - Results are cached for a short TTL so the dashboard can poll cheaply.
 */

import { randomUUID } from "node:crypto";

/** Route prefix owned by this plugin. */
const BASE = "/plugins/dsh-session-console";

/** Dashboard cache TTL. The panel polls faster than this and gets the memo. */
const OVERVIEW_TTL_MS = 8_000;

/** Bound on the JSON body accepted by the dispatch route. */
const BODY_LIMIT = 64 * 1024;

/** Recent-message scan bound for the `tail` route. */
const TAIL_EVENT_SCAN = 4_000;

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

/** Malformed client input: reported as 400 instead of an internal error. */
function badRequest(message) {
  const error = new Error(message);
  error.code = "bad-request";
  return error;
}

function safeMessage(error) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

/**
 * Project a value onto plain, lossless JSON.
 *
 * Everything this plugin reports is either an HTTP body (where `undefined`
 * silently disappears inside `JSON.stringify`) or an agent-tool result (where
 * the host rejects anything that is not lossless JSON — `undefined` fields and
 * non-finite numbers both fail that check). Normalising once at the boundary
 * keeps both channels honest: unknown scalars become `null`, non-finite
 * numbers become `0`, and `undefined` object members are dropped so payloads
 * stay compact.
 */
function plain(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(plain);
  if (value instanceof Date) return value.toISOString();
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    out[key] = plain(entry);
  }
  return out;
}

function json(res, status, body) {
  const payload = JSON.stringify(plain(body));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function isLoopbackHostname(hostname) {
  const name = String(hostname).toLowerCase().replace(/^\[|\]$/gu, "");
  return name === "127.0.0.1" || name === "localhost" || name === "::1";
}

/** Reject requests whose Host header does not name this loopback listener. */
function hostTrusted(req) {
  const host = req.headers.host;
  if (typeof host !== "string" || host.length === 0) return true;
  const hostname = host.replace(/:\d+$/u, "");
  return isLoopbackHostname(hostname);
}

/** Reject cross-site browser origins; same-origin GETs carry no Origin header. */
function originTrusted(req) {
  const origin = req.headers.origin;
  if (typeof origin !== "string" || origin.length === 0) return true;
  try {
    return isLoopbackHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function guard(req, res) {
  if (!hostTrusted(req)) {
    json(res, 403, { error: "host-not-trusted" });
    return false;
  }
  if (!originTrusted(req)) {
    json(res, 403, { error: "origin-not-trusted" });
    return false;
  }
  return true;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(badRequest("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (raw.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(badRequest("request body must be JSON"));
      }
    });
    req.on("error", reject);
  });
}

/* ------------------------------------------------------------------ */
/* Text normalization and fuzzy session targeting                      */
/* ------------------------------------------------------------------ */

/**
 * Words that carry no targeting signal in a Chinese request such as
 * "示例项目的相关内容怎么样了". Stripped before scoring.
 */
const STOP_PHRASES = [
  "怎么样了", "怎么样", "如何了", "如何", "什么情况", "什么进度", "在干嘛",
  "进度", "情况", "状态", "进展", "相关", "内容", "东西", "那些", "那个", "这个",
  "会话", "对话", "聊天", "窗口", "任务", "帮我", "帮忙", "看看", "看一下", "看下",
  "问一下", "查一下", "找一下", "我想", "我要", "需要", "现在", "最近", "目前",
  "然后", "还有", "以及", "时候", "怎样", "多少", "哪里", "哪个", "是不是",
];

/**
 * Single characters dropped after phrase removal.
 *
 * Kept deliberately narrow: characters like 能 / 会 / 有 / 和 also occur inside
 * real workspace names (e.g. Chinese project names), so stripping them would
 * corrupt the subject.
 */
const STOP_CHARS = new Set([
  "的", "了", "吗", "呢", "吧", "啊", "呀", "我", "你", "他", "它",
  "把", "给", "对", "看", "下", "个", "些",
]);

/** Lowercase, drop punctuation/whitespace, keep letters, digits and CJK. */
function normalizeText(input) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[\uFF01-\uFF5E]/gu, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

/** Remove request phrasing, leaving only the subject the user cares about. */
function extractSubject(query) {
  let text = String(query ?? "");
  for (const phrase of STOP_PHRASES) text = text.split(phrase).join(" ");
  const kept = [];
  for (const ch of text) {
    if (/[\p{Letter}\p{Number}]/u.test(ch) && !STOP_CHARS.has(ch)) kept.push(ch);
  }
  const subject = normalizeText(kept.join(""));
  return subject.length > 0 ? subject : normalizeText(query);
}

/** CJK bigrams plus latin/digit words; the unit of fuzzy overlap. */
function tokenize(normalized) {
  const tokens = new Set();
  const latin = normalized.match(/[a-z0-9]{2,}/gu) ?? [];
  for (const word of latin) tokens.add(word);
  const cjk = normalized.replace(/[a-z0-9]+/gu, " ");
  for (const run of cjk.split(/\s+/u)) {
    if (run.length === 1) tokens.add(run);
    for (let i = 0; i + 1 < run.length; i += 1) tokens.add(run.slice(i, i + 2));
  }
  return [...tokens];
}

/** Dice coefficient over token sets, 0..1. */
function dice(aTokens, bTokens) {
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const b = new Set(bTokens);
  let hit = 0;
  for (const token of aTokens) if (b.has(token)) hit += 1;
  return (2 * hit) / (aTokens.length + b.size);
}

/**
 * Score one session against the extracted subject.
 *
 * Substring containment wins over fuzzy overlap because Chinese workspace
 * names are usually quoted verbatim ("示例项目" inside `示例项目-v2`).
 */
function scoreSession(subject, tokens, fields) {
  const reasons = [];
  let score = 0;
  for (const [field, weight] of [
    ["title", 6],
    ["cwd", 4],
    ["leaf", 3],
    ["preset", 1],
    ["id", 1],
  ]) {
    const value = fields[field];
    if (typeof value !== "string" || value.length === 0) continue;
    const hay = normalizeText(value);
    if (hay.length === 0) continue;
    if (subject.length > 0 && hay.includes(subject)) {
      score += weight * 20 + Math.min(subject.length, 12);
      reasons.push(`${field}:exact`);
      continue;
    }
    if (subject.length >= 4) {
      for (let size = subject.length - 1; size >= 3; size -= 1) {
        let covered = false;
        for (let i = 0; i + size <= subject.length; i += 1) {
          if (hay.includes(subject.slice(i, i + size))) {
            score += weight * (6 + size);
            reasons.push(`${field}:part`);
            covered = true;
            break;
          }
        }
        if (covered) break;
      }
    }
    const overlap = dice(tokens, tokenize(hay));
    if (overlap > 0.2) {
      score += weight * overlap * 24;
      reasons.push(`${field}:fuzzy`);
    }
  }
  return { score, reasons };
}

/** Last path segment, used as a strong human-facing label. */
function leafOf(cwd) {
  if (typeof cwd !== "string" || cwd.length === 0) return undefined;
  const parts = cwd.split(/[\\/]+/u).filter(Boolean);
  return parts.length === 0 ? undefined : parts[parts.length - 1];
}

/* ------------------------------------------------------------------ */
/* Session snapshot assembly                                           */
/* ------------------------------------------------------------------ */

/** Sum the four wire token buckets of a `tokenUsage` projection value. */
function totalTokens(usage) {
  if (usage === null || typeof usage !== "object") return 0;
  return (
    (Number(usage.uncachedInputTokens) || 0) +
    (Number(usage.outputTokens) || 0) +
    (Number(usage.cacheReadTokens) || 0) +
    (Number(usage.cacheWriteTokens) || 0)
  );
}

/**
 * Heat: recency-decayed activity score. Deliberately cheap — it uses only the
 * fields already present on a session summary plus live in-memory counters.
 *
 * `recency` dominates because the dashboard answers "what is hot right now";
 * token volume breaks ties between equally recent conversations, and a live
 * agent always floats to the top.
 */
function heatOf({ running, updatedAt, tokens, events, now }) {
  const ageHours = Math.max(0, (now - updatedAt) / 3_600_000);
  const recency = 100 / (1 + ageHours / 6);
  const volume = Math.log10(1 + tokens) * 8;
  const activity = Math.log10(1 + (events ?? 0)) * 5;
  const live = running ? 40 : 0;
  return Math.round((recency + volume + activity + live) * 10) / 10;
}

/** Build one dashboard row from a SessionSummary. */
function buildRow(ctx, summary, now) {
  const values = summary?.projections?.values ?? {};
  const usage = values.tokenUsage;
  const tokens = totalTokens(usage);
  // cordis throws on `ctx.<service>` reads for services not listed in inject,
  // and optional chaining cannot protect against that getter throw. `ctx.get()`
  // reads the store without the inject requirement, so every optional service
  // below goes through it.
  const live = ctx.get?.("sessions")?.get?.(summary.sessionId);
  const events = typeof live?.seq === "number" ? live.seq : undefined;
  const agent = ctx.get?.("agents")?.get?.(summary.sessionId);
  const metadata = values.sessionListMetadata;
  const title = typeof values.title === "string" ? values.title : undefined;
  const cwd = summary.cwd;
  // `modelSelection` is an object ({provider, model, reasoningEffort}); projecting
  // it straight into a row would render as "[object Object]" in the panel, so the
  // row carries the display label plus the raw parts separately.
  // `modelSelection`'s wire view is `{lastUsed, next}` where each side is
  // `{provider, model, reasoningEffort} | null` — `next` already folds
  // `pending ?? lastUsed` (see dsh-api-session-controller's
  // modelSelectionProjection). Reading `values.modelSelection.model` directly
  // would always be undefined, so unwrap it here.
  const selection = values.modelSelection;
  const activeSelection = selection?.next ?? selection?.lastUsed ?? undefined;
  const pressure = values.contextPressure;
  const pressureTokens = Number(pressure?.pressureTokens) || 0;
  const contextWindow = Number(pressure?.contextWindow) || 0;
  return {
    id: summary.sessionId,
    title: title ?? leafOf(cwd) ?? summary.sessionId.slice(0, 8),
    untitled: title === undefined,
    running: summary.running === true,
    agentStatus: typeof agent?.status === "string" ? agent.status : undefined,
    agentAvailable: summary.agentAvailable === true,
    blank: summary.blank === true,
    formatStatus: summary.formatStatus,
    origin: summary.origin,
    parentSessionId: summary.parentSessionId,
    cwd,
    leaf: leafOf(cwd),
    agentPreset: live?.header?.agentPreset,
    createdAt: live?.header?.createdAt,
    updatedAt: summary.updatedAt ?? 0,
    lastPromptAt: metadata?.lastPromptAt ?? undefined,
    events,
    tokens: {
      total: tokens,
      input: Number(usage?.uncachedInputTokens) || 0,
      output: Number(usage?.outputTokens) || 0,
      cacheRead: Number(usage?.cacheReadTokens) || 0,
      cacheWrite: Number(usage?.cacheWriteTokens) || 0,
    },
    pressure: pressureTokens > 0 ? pressureTokens : undefined,
    pressureRatio: pressureTokens > 0 && contextWindow > 0 ? Math.round((pressureTokens / contextWindow) * 1000) / 10 : undefined,
    contextWindow: contextWindow > 0 ? contextWindow : undefined,
    model: typeof activeSelection?.model === "string" ? activeSelection.model : undefined,
    provider: typeof activeSelection?.provider === "string" ? activeSelection.provider : undefined,
    reasoningEffort: typeof activeSelection?.reasoningEffort === "string" ? activeSelection.reasoningEffort : undefined,
    heat: heatOf({ running: summary.running === true, updatedAt: summary.updatedAt ?? 0, tokens, events, now }),
  };
}

/** Aggregate the whole fleet: totals, per-project rollups, health counters. */
function buildTotals(rows, now) {
  const totals = {
    sessions: rows.length,
    running: 0,
    blank: 0,
    cold: 0,
    tokens: 0,
    tokensInput: 0,
    tokensOutput: 0,
    tokensCacheRead: 0,
    tokensCacheWrite: 0,
    cacheHitRate: 0,
    activeToday: 0,
    activeWeek: 0,
  };
  const buckets = { day: 86_400_000, week: 604_800_000 };
  const byProject = new Map();
  let hottest = null;
  for (const row of rows) {
    if (row.running) totals.running += 1;
    if (row.blank) totals.blank += 1;
    if (!row.agentAvailable) totals.cold += 1;
    totals.tokens += row.tokens.total;
    totals.tokensInput += row.tokens.input;
    totals.tokensOutput += row.tokens.output;
    totals.tokensCacheRead += row.tokens.cacheRead;
    totals.tokensCacheWrite += row.tokens.cacheWrite;
    const age = now - row.updatedAt;
    if (age <= buckets.day) totals.activeToday += 1;
    if (age <= buckets.week) totals.activeWeek += 1;
    const key = row.cwd ?? "(no workspace)";
    const bucket = byProject.get(key) ?? { cwd: key, leaf: row.leaf ?? key, sessions: 0, tokens: 0, running: 0, heat: 0, lastActive: 0 };
    bucket.sessions += 1;
    bucket.tokens += row.tokens.total;
    if (row.running) bucket.running += 1;
    bucket.heat = Math.max(bucket.heat, row.heat);
    bucket.lastActive = Math.max(bucket.lastActive, row.updatedAt);
    byProject.set(key, bucket);
    if (hottest === null || row.heat > hottest.heat) hottest = row;
  }
  const promptSide = totals.tokensInput + totals.tokensCacheRead + totals.tokensCacheWrite;
  totals.cacheHitRate = promptSide > 0 ? Math.round((totals.tokensCacheRead / promptSide) * 1000) / 10 : 0;
  totals.hottest = hottest === null ? undefined : { id: hottest.id, title: hottest.title, heat: hottest.heat };
  totals.projects = [...byProject.values()].sort((a, b) => b.heat - a.heat || b.lastActive - a.lastActive);
  return totals;
}

/** Read the fleet through the existing session-controller summary channel. */
async function readFleet(ctx, signal) {
  const controller = ctx.get?.("sessionController");
  if (controller === undefined) throw new Error("sessionController is not mounted");
  const result = await controller.list({}, signal);
  const items = Array.isArray(result?.items) ? result.items : Array.isArray(result) ? result : [];
  return items;
}

/** Cached overview with a short TTL so UI polling stays cheap. */
function createOverviewCache() {
  let memo;
  let inflight;
  return {
    async read(ctx) {
      const now = Date.now();
      if (memo !== undefined && now - memo.at < OVERVIEW_TTL_MS) return memo.value;
      if (inflight !== undefined) return inflight;
      inflight = (async () => {
        try {
          const items = await readFleet(ctx);
          const stamp = Date.now();
          const rows = items.map((item) => buildRow(ctx, item, stamp));
          const totals = buildTotals(rows, stamp);
          const value = { at: stamp, totals, sessions: rows };
          memo = { at: stamp, value };
          return value;
        } finally {
          inflight = undefined;
        }
      })();
      return inflight;
    },
    invalidate() {
      memo = undefined;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Per-session detail (explicit, bounded reads)                        */
/* ------------------------------------------------------------------ */

function contentText(content) {
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (block?.type === "text" && typeof block.text === "string") parts.push(block.text);
    else if (block?.type === "tool-call") parts.push(`[tool] ${block.name}`);
  }
  return parts.join("\n").trim();
}

/** Read the recent turn history and outcome counters of one session. */
async function readDetail(ctx, sessionId, options = {}) {
  const query = ctx.get?.("sessionQuery");
  if (query === undefined) throw new Error("sessionQuery is not mounted");
  const limit = Math.max(1, Math.min(Number(options.limit) || 12, 60));
  const snapshot = await query.readSession(sessionId);
  const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
  const start = Math.max(0, events.length - TAIL_EVENT_SCAN);
  const counts = { turns: 0, steps: 0, toolCalls: 0, toolErrors: 0, userMessages: 0, assistantMessages: 0 };
  const types = {};
  const turnEnds = [];
  const messages = [];
  for (let i = start; i < events.length; i += 1) {
    const event = events[i];
    types[event.type] = (types[event.type] ?? 0) + 1;
    switch (event.type) {
      case "turn/start":
        counts.turns += 1;
        break;
      case "step/start":
        counts.steps += 1;
        break;
      case "tool/call":
        counts.toolCalls += 1;
        break;
      case "tool/result":
        if (event.data?.error !== undefined) counts.toolErrors += 1;
        break;
      case "turn/end": {
        const reason = event.data?.reason;
        if (reason !== undefined) {
          turnEnds.push(reason.kind === "error" ? { kind: "error", message: safeMessage(reason.error?.message) } : { kind: reason.kind });
        }
        break;
      }
      case "user/message":
        counts.userMessages += 1;
        messages.push({ role: "user", time: event.time, seq: event.seq, text: contentText(event.data?.content) });
        break;
      case "assistant/message":
        counts.assistantMessages += 1;
        messages.push({ role: "assistant", time: event.time, seq: event.seq, text: contentText(event.data?.message?.content) });
        break;
      default:
        break;
    }
  }
  const recent = messages.filter((message) => message.text.length > 0).slice(-limit);
  const failures = turnEnds.filter((end) => end.kind !== "completed");
  return {
    id: sessionId,
    header: snapshot?.session,
    inheritedEventCount: snapshot?.inheritedEventCount ?? 0,
    eventCount: events.length,
    scanned: events.length - start,
    types,
    counts,
    health: {
      failures: failures.length,
      lastFailure: failures.length > 0 ? failures[failures.length - 1] : undefined,
    },
    turnEnds: turnEnds.slice(-10),
    messages: recent,
  };
}

/* ------------------------------------------------------------------ */
/* Natural-language targeting                                          */
/* ------------------------------------------------------------------ */

/** Rank every known session against one sentence. */
async function matchSessions(ctx, query, options = {}) {
  const fleet = await createOverviewCacheRef(ctx);
  const subject = extractSubject(query);
  const tokens = tokenize(subject);
  const limit = Math.max(1, Math.min(Number(options.limit) || 5, 20));
  const scored = fleet.sessions.map((row) => {
    const { score, reasons } = scoreSession(subject, tokens, {
      title: row.title,
      cwd: row.cwd,
      leaf: row.leaf,
      preset: row.agentPreset,
      id: row.id,
    });
    return { row, score, reasons };
  });
  // Tie-break by heat so a whole workspace worth of equal scores still puts the
  // interesting session (running, recently active) first.
  scored.sort((a, b) => b.score - a.score || b.row.heat - a.row.heat);
  // A user sentence usually names a *topic* ("示例项目"), and the same topic owns
  // several sessions in one workspace. Those siblings are not ambiguity: the
  // freshest one is the answer. Ambiguity is a rival *outside* that workspace.
  const leader = scored[0];
  const rivalGroup = leader === undefined
    ? undefined
    : scored.find((entry) => entry.score >= leader.score * 0.6 && entry.row.cwd !== leader.row.cwd);
  const candidates = scored
    .filter((entry) => entry.score > 0)
    .slice(0, limit)
    .map((entry) => ({
      id: entry.row.id,
      title: entry.row.title,
      cwd: entry.row.cwd,
      running: entry.row.running,
      updatedAt: entry.row.updatedAt,
      heat: entry.row.heat,
      tokens: entry.row.tokens.total,
      score: Math.round(entry.score * 10) / 10,
      reasons: entry.reasons,
    }));
  const confident = leader !== undefined && leader.score >= 40 && rivalGroup === undefined;
  return { subject, candidates, best: candidates[0], confident };
}

/* The overview cache is shared between the route layer and the tools. */
let sharedCache;
function cacheFor(ctx) {
  sharedCache ??= createOverviewCache();
  return sharedCache;
}
async function createOverviewCacheRef(ctx) {
  return cacheFor(ctx).read(ctx);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/**
 * Dispatch one instruction into an existing conversation.
 *
 * Uses the same channel the UI composer uses, so the target session resumes
 * automatically when cold and the message is durably queued.
 */
async function dispatch(ctx, request) {
  const controller = ctx.get?.("sessionController");
  if (controller === undefined) throw new Error("sessionController is not mounted");
  const text = typeof request?.text === "string" ? request.text.trim() : "";
  if (text.length === 0) throw badRequest("text must be a non-empty string");
  let sessionId = typeof request?.sessionId === "string" ? request.sessionId.trim() : "";
  let resolvedFrom;
  if (sessionId.length === 0) {
    const target = typeof request?.query === "string" ? request.query : "";
    if (target.trim().length === 0) throw badRequest("either sessionId or query is required");
    const match = await matchSessions(ctx, target, { limit: 3 });
    if (match.best === undefined) {
      const error = new Error(`no session matches "${target}"`);
      error.code = "not-found";
      throw error;
    }
    if (!match.confident) {
      const error = new Error(`ambiguous target "${target}"; confirm one of the candidates`);
      error.code = "ambiguous";
      error.candidates = match.candidates;
      throw error;
    }
    sessionId = match.best.id;
    resolvedFrom = target;
  }
  const mode = request?.mode === "steer" ? "steer" : "queue";
  const requestId = randomUUID();
  await controller.prompt(
    { requestId, sessionId, mode, content: [{ type: "text", text }] },
    AbortSignal.timeout(60_000),
  );
  cacheFor(ctx).invalidate();
  return { accepted: true, sessionId, requestId, mode, resolvedFrom };
}

/** Cancel the running turn of one session. */
async function cancelSession(ctx, sessionId) {
  const controller = ctx.get?.("sessionController");
  if (controller === undefined) throw new Error("sessionController is not mounted");
  await controller.cancel({ sessionId }, AbortSignal.timeout(30_000));
  cacheFor(ctx).invalidate();
  return { cancelled: true, sessionId };
}

/**
 * Map one action failure to an HTTP status.
 *
 * Session-level failures arrive as cordis RemoteError values carrying a
 * `session/...` code, so both the plugin's own codes and those are honoured.
 */
function statusOf(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  if (code === "bad-request") return 400;
  if (code === "not-found" || code === "session/not-found") return 404;
  if (code === "ambiguous" || code === "session/agent-busy") return 409;
  if (code === "session/writer-held" || code === "gateway/internal") return 503;
  const message = safeMessage(error);
  if (message.includes("not found")) return 404;
  if (message.includes("ambiguous") || message.includes("busy")) return 409;
  return 500;
}

/* ------------------------------------------------------------------ */
/* Plugin entry                                                        */
/* ------------------------------------------------------------------ */

export const inject = ["webServer"];

export function apply(ctx) {
  cacheFor(ctx);

  /* ---- HTTP routes ------------------------------------------------ */

  const routes = [
    {
      path: `${BASE}/overview`,
      handler: async (req, res) => {
        if (!guard(req, res)) return;
        if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
        try {
          const url = new URL(req.url ?? "/", "http://127.0.0.1");
          const limit = Number(url.searchParams.get("limit")) || 0;
          const data = await cacheFor(ctx).read(ctx);
          const sessions = limit > 0 ? data.sessions.slice(0, limit) : data.sessions;
          json(res, 200, { ...data, sessions });
        } catch (error) {
          json(res, 500, { error: safeMessage(error) });
        }
      },
    },
    {
      path: `${BASE}/match`,
      handler: async (req, res) => {
        if (!guard(req, res)) return;
        if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
        try {
          const url = new URL(req.url ?? "/", "http://127.0.0.1");
          const query = url.searchParams.get("q") ?? "";
          if (query.trim().length === 0) return json(res, 400, { error: "q is required" });
          json(res, 200, await matchSessions(ctx, query, { limit: Number(url.searchParams.get("limit")) || 5 }));
        } catch (error) {
          json(res, 500, { error: safeMessage(error) });
        }
      },
    },
    {
      path: `${BASE}/tail`,
      handler: async (req, res) => {
        if (!guard(req, res)) return;
        if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
        try {
          const url = new URL(req.url ?? "/", "http://127.0.0.1");
          const id = url.searchParams.get("id") ?? "";
          if (id.length === 0) return json(res, 400, { error: "id is required" });
          json(res, 200, await readDetail(ctx, id, { limit: Number(url.searchParams.get("limit")) || 12 }));
        } catch (error) {
          json(res, statusOf(error), { error: safeMessage(error) });
        }
      },
    },
    {
      path: `${BASE}/dispatch`,
      handler: async (req, res) => {
        if (!guard(req, res)) return;
        if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
        try {
          const body = await readJsonBody(req);
          json(res, 200, await dispatch(ctx, body));
        } catch (error) {
          json(res, statusOf(error), { error: safeMessage(error), candidates: error?.candidates });
        }
      },
    },
    {
      path: `${BASE}/cancel`,
      handler: async (req, res) => {
        if (!guard(req, res)) return;
        if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
        try {
          const body = await readJsonBody(req);
          const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
          if (sessionId.length === 0) return json(res, 400, { error: "sessionId is required" });
          json(res, 200, await cancelSession(ctx, sessionId));
        } catch (error) {
          json(res, statusOf(error), { error: safeMessage(error) });
        }
      },
    },
  ];

  ctx.effect(() => {
    const disposers = [];
    for (const route of routes) {
      try {
        disposers.push(ctx.webServer.register({ kind: "exact", path: route.path, handler: route.handler }));
      } catch (error) {
        ctx.logger?.warn?.(`dsh-session-console: failed to register ${route.path}: ${safeMessage(error)}`);
      }
    }
    return () => {
      for (const dispose of disposers) {
        try {
          dispose();
        } catch {
          /* teardown is best effort */
        }
      }
    };
  }, "dsh-session-console routes");

  /* ---- Agent tools ------------------------------------------------ */

  const tools = ctx.get?.("tools");
  if (tools === undefined) {
    ctx.logger?.warn?.("dsh-session-console: tools service absent; agent tools not registered");
    return;
  }

  const overviewTool = {
    name: "session_console_overview",
    description:
      "列出 DeepSeek Harness 左侧所有会话及其状态仪表盘数据：运行状态、token 消耗、缓存命中率、上下文压力、热度排序、按工作区分组。回答“我有哪些对话/哪个最热/一共花了多少 token”这类问题时用它。返回的是汇总，不含消息正文。",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "最多返回多少条会话，默认 25，按热度降序。" },
        onlyActive: { type: "boolean", description: "只返回正在运行或最近 24 小时有活动的会话。" },
      },
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: {
          totals: { type: "object", description: "全局汇总：会话数、运行中数量、token 总量、缓存命中率、按工作区聚合。" },
          sessions: { type: "array", description: "会话行，按热度降序。", items: { type: "object" } },
        },
      },
      render(_args, value) {
        const totals = value?.totals ?? {};
        const lines = [
          `会话 ${totals.sessions ?? 0} 个（运行中 ${totals.running ?? 0}，今日活跃 ${totals.activeToday ?? 0}），token 合计 ${totals.tokens ?? 0}，缓存命中 ${totals.cacheHitRate ?? 0}%`,
        ];
        for (const row of (value?.sessions ?? []).slice(0, 15)) {
          lines.push(`- [${row.running ? "运行" : "空闲"}] ${row.title} · 热度 ${row.heat} · ${row.tokens?.total ?? 0} tok · ${row.cwd ?? ""}`);
        }
        return [{ type: "text", text: lines.join("\n") }];
      },
    },
    execute: async (args) => {
      const data = await cacheFor(ctx).read(ctx);
      let rows = data.sessions;
      if (args?.onlyActive === true) {
        const cutoff = Date.now() - 86_400_000;
        rows = rows.filter((row) => row.running || row.updatedAt >= cutoff);
      }
      const limit = Number(args?.limit) > 0 ? Math.min(Number(args.limit), 200) : 25;
      // Tool results must be lossless JSON; rows carry optional fields.
      return plain({ at: data.at, totals: data.totals, sessions: rows.slice(0, limit) });
    },
  };

  const findTool = {
    name: "session_console_find",
    description:
      "把用户的一句自然语言（例如“示例项目的相关内容怎么样了”“那个改主题的对话”）指到左侧某个具体会话上，返回按匹配度排序的候选会话。只要用户提到某个对话而不是当前对话，就先调用它定位目标，再用 session_console_tail 看结果或 session_console_dispatch 派任务。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "用户原话，例如“示例项目的相关内容怎么样了”。" },
        limit: { type: "number", description: "候选数量，默认 5。" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: {
          subject: { type: "string", description: "去掉请求措辞后剩下的主语。" },
          confident: { type: "boolean", description: "是否只有一个明确目标。" },
          candidates: { type: "array", description: "候选会话，按匹配度降序。", items: { type: "object" } },
        },
      },
      render(_args, value) {
        if (!value?.candidates?.length) return [{ type: "text", text: "没有匹配的会话。" }];
        const lines = [`主语「${value.subject}」，${value.confident ? "唯一目标" : "需要确认"}：`];
        for (const candidate of value.candidates) {
          lines.push(`- ${candidate.title} · ${candidate.id} · 分数 ${candidate.score} · ${candidate.cwd ?? ""}`);
        }
        return [{ type: "text", text: lines.join("\n") }];
      },
    },
    execute: async (args) => {
      const query = typeof args?.query === "string" ? args.query : "";
      if (query.trim().length === 0) throw new Error("query must be a non-empty string");
      // `matchSessions` is async: await before normalising, or `plain` would
      // stringify the Promise itself into an empty object.
      return plain(await matchSessions(ctx, query, { limit: Number(args?.limit) || 5 }));
    },
  };

  const tailTool = {
    name: "session_console_tail",
    description:
      "读取某个会话最近的对话内容与健康度（最近若干条 user/assistant 消息、工具调用数、失败轮次、最后失败原因），用来回答“那个对话进展到哪了/有没有报错”。需要先拿到 sessionId（可用 session_console_find）。",
    parameters: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "目标会话 id（session-<uuid>）。" },
        limit: { type: "number", description: "最多返回多少条最近消息，默认 12。" },
      },
      required: ["sessionId"],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: {
          id: { type: "string" },
          eventCount: { type: "number" },
          counts: { type: "object" },
          health: { type: "object" },
          messages: { type: "array", items: { type: "object" } },
        },
      },
      render(_args, value) {
        const counts = value?.counts ?? {};
        const lines = [
          `会话 ${value?.id}：${value?.eventCount ?? 0} 事件，${counts.turns ?? 0} 轮，工具调用 ${counts.toolCalls ?? 0}（失败 ${counts.toolErrors ?? 0}），异常轮次 ${value?.health?.failures ?? 0}`,
        ];
        for (const message of value?.messages ?? []) {
          const text = String(message.text).replace(/\s+/gu, " ").slice(0, 240);
          lines.push(`${message.role === "user" ? "用户" : "助手"}：${text}`);
        }
        return [{ type: "text", text: lines.join("\n") }];
      },
    },
    execute: async (args) => {
      const sessionId = typeof args?.sessionId === "string" ? args.sessionId : "";
      if (sessionId.length === 0) throw new Error("sessionId must be a non-empty string");
      return plain(await readDetail(ctx, sessionId, { limit: Number(args?.limit) || 12 }));
    },
  };

  const dispatchTool = {
    name: "session_console_dispatch",
    description:
      "把一句话作为排队中的用户消息派发到另一个已存在的会话（等价于在那个对话里发一条消息，冷会话会自动恢复）。用户可以要求“让示例项目那个对话去做 X”。先用 session_console_find 确认目标；若目标不唯一，先向用户确认再派。派完可以用 session_console_tail 看返回。",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "要派给目标会话的指令正文。" },
        sessionId: { type: "string", description: "目标会话 id；与 query 二选一。" },
        query: { type: "string", description: "用户对目标的自然语言指代；不唯一时会报 ambiguous 并返回候选。" },
        mode: { type: "string", enum: ["queue", "steer"], description: "queue 排队（默认，目标空闲时立刻执行）；steer 打断式插入。" },
      },
      required: ["text"],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: {
          accepted: { type: "boolean" },
          sessionId: { type: "string" },
          requestId: { type: "string" },
          mode: { type: "string" },
          resolvedFrom: { type: "string" },
        },
      },
      render(_args, value) {
        return [{ type: "text", text: `已派发到 ${value?.sessionId}（${value?.mode}，requestId ${value?.requestId}）` }];
      },
    },
    execute: async (args) => plain(await dispatch(ctx, args ?? {})),
  };

  const cancelTool = {
    name: "session_console_cancel",
    description: "取消某个会话正在运行的一轮。用户说“把那个对话停下来”时使用。",
    parameters: {
      type: "object",
      properties: { sessionId: { type: "string", description: "目标会话 id。" } },
      required: ["sessionId"],
      additionalProperties: false,
    },
    output: {
      schema: { type: "object", properties: { cancelled: { type: "boolean" }, sessionId: { type: "string" } } },
      render(_args, value) {
        return [{ type: "text", text: `已取消 ${value?.sessionId}` }];
      },
    },
    execute: async (args) => plain(await cancelSession(ctx, String(args?.sessionId ?? ""))),
  };

  ctx.effect(() => {
    const disposers = [];
    for (const tool of [overviewTool, findTool, tailTool, dispatchTool, cancelTool]) {
      try {
        disposers.push(tools.register(tool));
      } catch (error) {
        ctx.logger?.warn?.(`dsh-session-console: failed to register tool ${tool.name}: ${safeMessage(error)}`);
      }
    }
    return () => {
      for (const dispose of disposers) {
        try {
          dispose();
        } catch {
          /* teardown is best effort */
        }
      }
    };
  }, "dsh-session-console tools");
}
