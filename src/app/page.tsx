"use client";

import { useEffect, useState } from "react";

type FeedPostItem = {
  id: string;
  createdAt: string;
  text: string;
  rationale: string;
  sources: string[];
};

type TopicItem = {
  id: string;
  title: string;
  summary: string | null;
  sourceName: string;
  sourceUrl: string;
  status: string;
  discoveredAt: string;
};

type DecisionItem = {
  id: string;
  topicId: string;
  topicTitle: string;
  decision: string;
  score: number | null;
  reason: string;
  decidedAt: string;
};

type OutboxItem = {
  id: string;
  memoryId: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
};

type RunItem = {
  id: string;
  status: string;
  stage: string | null;
  startedAt: string;
  finishedAt: string | null;
  errorSummary: string | null;
};

type AgentStatusData = {
  agent: {
    id: string;
    name: string;
    domain: string;
    tagline: string;
    processingStatus: string;
    nextRunAt: string;
    consecutiveFailures: number;
    createdAt: string;
  };
  metrics: {
    topicsDiscoveredTotal: number;
    topicsPendingEvaluation: number;
    topicsSelected: number;
    topicsRejected: number;
    postsPublished: number;
    outboxRecordsTotal: number;
  };
  topics: TopicItem[];
  editorialDecisions: DecisionItem[];
  posts: FeedPostItem[];
  outboxRecords: OutboxItem[];
  recentRuns: RunItem[];
};

export default function Home() {
  const [initName, setInitName] = useState("AI Security Intelligence Creator");
  const [initDomain, setInitDomain] = useState(
    "AI security, autonomous agents, cybersecurity, prompt injection, AI safety and emerging threats"
  );
  const [activeAgentId, setActiveAgentId] = useState<string>("");
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"posts" | "decisions" | "topics" | "outbox" | "runs">("posts");
  const [statusData, setStatusData] = useState<AgentStatusData | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  async function handleInitializeAgent(e: React.FormEvent) {
    e.preventDefault();
    setIsInitializing(true);
    setInitError(null);
    try {
      const res = await fetch("/api/agent/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: {
            name: initName,
            domain: initDomain
          }
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }

      const data = (await res.json()) as { agentId: string };
      setActiveAgentId(data.agentId);
      await fetchAgentStatus(data.agentId);
    } catch (err: unknown) {
      setInitError(err instanceof Error ? err.message : "Initialization failed");
    } finally {
      setIsInitializing(false);
    }
  }

  async function fetchAgentStatus(agentIdToFetch?: string) {
    const id = (agentIdToFetch || activeAgentId).trim();
    if (!id) return;

    setIsLoadingStatus(true);
    setStatusError(null);
    try {
      const res = await fetch(`/api/agent/status?agentId=${encodeURIComponent(id)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }

      const data = (await res.json()) as AgentStatusData;
      setStatusData(data);
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : "Failed to load agent status");
      setStatusData(null);
    } finally {
      setIsLoadingStatus(false);
    }
  }

  // Auto-refresh interval (every 6 seconds if enabled)
  useEffect(() => {
    if (!autoRefresh || !activeAgentId) return;
    const interval = setInterval(() => {
      fetchAgentStatus(activeAgentId);
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeAgentId]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 text-slate-100 font-sans">
      {/* Top Banner */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400 border border-emerald-500/20">
              <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Autonomous Creator Platform
            </span>
            <span className="text-xs text-slate-400">ABTalks Vibe Code Hackathon</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Autonomous AI Creator Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-400 max-w-2xl">
            Inspect live RSS discovery, AI persona evaluation, deliberate topic rejections, post generation, and persistent memory synchronization in real-time.
          </p>
        </div>

        {/* Quick Config Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-lg bg-slate-800/80 px-3 py-1.5 border border-white/10 text-slate-300 font-mono">
            Provider: <strong className="text-emerald-400">Mock / OpenAI</strong>
          </span>
          <span className="rounded-lg bg-slate-800/80 px-3 py-1.5 border border-white/10 text-slate-300 font-mono">
            Memory: <strong className="text-emerald-400">Mock / Breeth Boundary</strong>
          </span>
        </div>
      </header>

      {/* Grid: Agent Initialization & Controls */}
      <div className="grid gap-8 lg:grid-cols-3 mb-10">
        {/* Card 1: Initialization Form */}
        <section className="lg:col-span-1 rounded-2xl border border-white/10 bg-slate-900/80 p-6 backdrop-blur-sm shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">Initialize Autonomous Agent</h2>
              <span className="font-mono text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                POST /api/agent/init
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Initialize an agent once. The worker process claims it automatically for continuous discovery and publishing.
            </p>

            <form onSubmit={handleInitializeAgent} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Persona Name</label>
                <input
                  type="text"
                  value={initName}
                  onChange={(e) => setInitName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Domain & Stance Focus</label>
                <textarea
                  value={initDomain}
                  onChange={(e) => setInitDomain(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isInitializing}
                className="w-full rounded-lg bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {isInitializing ? "Creating Agent..." : "Create Autonomous Agent"}
              </button>
            </form>

            {initError && (
              <div className="mt-3 rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-300">
                {initError}
              </div>
            )}
          </div>
        </section>

        {/* Card 2 & 3: Active Status & Inspection Controls */}
        <section className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-900/80 p-6 backdrop-blur-sm shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base font-bold text-white">Active Agent Inspector</h2>
                <p className="text-xs text-slate-400">
                  Inspect persona parameters, topic counts, editorial reasons, and memory sync.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="agent_..."
                  value={activeAgentId}
                  onChange={(e) => setActiveAgentId(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-100 focus:border-emerald-500 focus:outline-none w-48"
                />
                <button
                  type="button"
                  onClick={() => fetchAgentStatus()}
                  disabled={isLoadingStatus || !activeAgentId.trim()}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
                >
                  {isLoadingStatus ? "Loading..." : "Inspect"}
                </button>
              </div>
            </div>

            {statusError && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 mb-4">
                {statusError}
              </div>
            )}

            {statusData ? (
              <div>
                {/* Agent Identity & Status Header */}
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 mb-4">
                  <div className="rounded-lg bg-slate-950/80 p-3 border border-white/5">
                    <span className="text-[11px] text-slate-400">Agent Persona</span>
                    <p className="text-xs font-bold text-white truncate">{statusData.agent.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{statusData.agent.domain}</p>
                  </div>
                  <div className="rounded-lg bg-slate-950/80 p-3 border border-white/5">
                    <span className="text-[11px] text-slate-400">Worker Status</span>
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      {statusData.agent.processingStatus}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Failures: {statusData.agent.consecutiveFailures}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-950/80 p-3 border border-white/5">
                    <span className="text-[11px] text-slate-400">Discovered / Evaluated</span>
                    <p className="text-xs font-bold text-white">
                      {statusData.metrics.topicsDiscoveredTotal} Total
                    </p>
                    <p className="text-[10px] text-emerald-400">
                      {statusData.metrics.topicsSelected} Selected / {statusData.metrics.topicsRejected} Rejected
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-950/80 p-3 border border-white/5">
                    <span className="text-[11px] text-slate-400">Published / Synced</span>
                    <p className="text-xs font-bold text-emerald-400 font-mono">
                      {statusData.metrics.postsPublished} Published Posts
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {statusData.metrics.outboxRecordsTotal} Outbox Sync Records
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-slate-950/50 p-6 text-center text-xs text-slate-400">
                Initialize a creator agent or enter an existing <code>agentId</code> above to inspect live autonomous pipeline state.
              </div>
            )}
          </div>

          {/* Auto Refresh Toggle */}
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-white/10 bg-slate-950 text-emerald-500 focus:ring-0"
              />
              Auto-refresh Live Status (Every 6s)
            </label>
            {statusData && (
              <span className="text-[11px] font-mono text-slate-400">
                ID: {statusData.agent.id}
              </span>
            )}
          </div>
        </section>
      </div>

      {/* Evaluator Tabs & Data Display */}
      {statusData && (
        <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 backdrop-blur-sm shadow-xl">
          {/* Tab Navigation Header */}
          <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-4 mb-6 gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("posts")}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === "posts"
                    ? "bg-emerald-500 text-slate-950 shadow"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Published Feed ({statusData.posts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("decisions")}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === "decisions"
                    ? "bg-emerald-500 text-slate-950 shadow"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Editorial Decisions ({statusData.editorialDecisions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("topics")}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === "topics"
                    ? "bg-emerald-500 text-slate-950 shadow"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Discovered Topics ({statusData.topics.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("outbox")}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === "outbox"
                    ? "bg-emerald-500 text-slate-950 shadow"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Memory & Outbox ({statusData.outboxRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("runs")}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === "runs"
                    ? "bg-emerald-500 text-slate-950 shadow"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Worker Runs ({statusData.recentRuns.length})
              </button>
            </div>

            <span className="font-mono text-xs text-slate-400">
              Evaluator Feed Contract: <code className="text-emerald-400">GET /api/agent/feed?agentId=...</code>
            </span>
          </div>

          {/* TAB 1: Published Feed Posts */}
          {activeTab === "posts" && (
            <div className="space-y-4">
              {statusData.posts.length === 0 ? (
                <div className="rounded-lg bg-slate-950/50 p-6 text-center text-xs text-slate-400">
                  No published posts yet. Worker loop generates posts for selected candidate topics automatically.
                </div>
              ) : (
                statusData.posts.map((post) => (
                  <article key={post.id} className="rounded-xl border border-white/10 bg-slate-950/80 p-5 shadow-md">
                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 mb-2 gap-2">
                      <span className="font-mono text-[11px] text-slate-500">{post.id}</span>
                      <time className="font-mono text-emerald-400">{new Date(post.createdAt).toUTCString()}</time>
                    </div>

                    <p className="text-sm text-slate-100 leading-relaxed mb-3">{post.text}</p>

                    <div className="rounded-lg bg-slate-900 p-3 border border-white/5 text-xs mb-3">
                      <span className="font-semibold text-emerald-400">Editorial Rationale: </span>
                      <span className="text-slate-300">{post.rationale}</span>
                    </div>

                    {post.sources && post.sources.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-slate-400 font-medium">Source Links:</span>
                        {post.sources.map((src, idx) => (
                          <a
                            key={idx}
                            href={src}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-emerald-400 hover:underline"
                          >
                            {src}
                          </a>
                        ))}
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          )}

          {/* TAB 2: Editorial Decisions */}
          {activeTab === "decisions" && (
            <div className="space-y-3">
              {statusData.editorialDecisions.length === 0 ? (
                <div className="rounded-lg bg-slate-950/50 p-6 text-center text-xs text-slate-400">
                  No editorial decisions recorded yet.
                </div>
              ) : (
                statusData.editorialDecisions.map((d) => (
                  <div key={d.id} className="rounded-xl border border-white/10 bg-slate-950/80 p-4 text-xs">
                    <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            d.decision === "selected"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {d.decision}
                        </span>
                        {d.score !== null && (
                          <span className="font-mono text-slate-300">Score: {d.score}/100</span>
                        )}
                      </div>
                      <time className="font-mono text-slate-500">{new Date(d.decidedAt).toUTCString()}</time>
                    </div>

                    <p className="font-bold text-slate-200 text-sm mb-1">{d.topicTitle}</p>
                    <p className="text-slate-400 leading-relaxed">{d.reason}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: Discovered Topics */}
          {activeTab === "topics" && (
            <div className="space-y-3">
              {statusData.topics.length === 0 ? (
                <div className="rounded-lg bg-slate-950/50 p-6 text-center text-xs text-slate-400">
                  No discovered topics.
                </div>
              ) : (
                statusData.topics.map((t) => (
                  <div key={t.id} className="rounded-xl border border-white/10 bg-slate-950/80 p-4 text-xs">
                    <div className="flex flex-wrap items-center justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                          {t.sourceName}
                        </span>
                        <span className="rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 text-[10px] uppercase font-mono">
                          {t.status}
                        </span>
                      </div>
                      <time className="font-mono text-slate-500">{new Date(t.discoveredAt).toUTCString()}</time>
                    </div>
                    <p className="font-semibold text-slate-100 text-sm mb-1">{t.title}</p>
                    {t.summary && <p className="text-slate-400 text-xs line-clamp-2">{t.summary}</p>}
                    <a
                      href={t.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block font-mono text-[11px] text-emerald-400 hover:underline"
                    >
                      {t.sourceUrl}
                    </a>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: Memory & Outbox */}
          {activeTab === "outbox" && (
            <div className="space-y-3">
              {statusData.outboxRecords.length === 0 ? (
                <div className="rounded-lg bg-slate-950/50 p-6 text-center text-xs text-slate-400">
                  No outbox memory sync records yet. Memory outbox items are enqueued automatically when posts are published.
                </div>
              ) : (
                statusData.outboxRecords.map((o) => (
                  <div key={o.id} className="rounded-xl border border-white/10 bg-slate-950/80 p-4 text-xs">
                    <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            o.status === "synced"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {o.status}
                        </span>
                        <span className="font-mono text-slate-400">Attempts: {o.attempts}</span>
                      </div>
                      <time className="font-mono text-slate-500">{new Date(o.createdAt).toUTCString()}</time>
                    </div>
                    <p className="font-mono text-[11px] text-slate-400">Memory ID: {o.memoryId}</p>
                    {o.lastError && (
                      <p className="mt-1 text-rose-400 font-mono text-[11px]">Error: {o.lastError}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 5: Worker Runs */}
          {activeTab === "runs" && (
            <div className="space-y-3">
              {statusData.recentRuns.length === 0 ? (
                <div className="rounded-lg bg-slate-950/50 p-6 text-center text-xs text-slate-400">
                  No worker run history yet.
                </div>
              ) : (
                statusData.recentRuns.map((r) => (
                  <div key={r.id} className="rounded-xl border border-white/10 bg-slate-950/80 p-4 text-xs">
                    <div className="flex flex-wrap items-center justify-between mb-1 gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            r.status === "succeeded"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {r.status}
                        </span>
                        <span className="font-mono text-slate-300">Stage: {r.stage || "claimed"}</span>
                      </div>
                      <time className="font-mono text-slate-500">{new Date(r.startedAt).toUTCString()}</time>
                    </div>
                    <p className="font-mono text-[11px] text-slate-500">Run ID: {r.id}</p>
                    {r.errorSummary && (
                      <p className="mt-1 text-rose-400 font-mono text-[11px]">{r.errorSummary}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      )}

      {/* Footer Footer */}
      <footer className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
        Autonomous AI Creator — ABTalks Vibe Code Hackathon | Next.js 16 • PostgreSQL • TypeScript Worker
      </footer>
    </main>
  );
}
