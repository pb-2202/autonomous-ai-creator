"use client";

import { useState } from "react";

type FeedPostItem = {
  id: string;
  createdAt: string;
  text: string;
  rationale: string;
  sources: string[];
};

export default function Home() {
  const [initName, setInitName] = useState("AI Security Researcher");
  const [initDomain, setInitDomain] = useState("AI Security & Systems Engineering");
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const [feedAgentId, setFeedAgentId] = useState("");
  const [feedPosts, setFeedPosts] = useState<FeedPostItem[] | null>(null);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

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
      setCreatedAgentId(data.agentId);
      setFeedAgentId(data.agentId);
    } catch (err: unknown) {
      setInitError(err instanceof Error ? err.message : "Initialization failed");
    } finally {
      setIsInitializing(false);
    }
  }

  async function handleFetchFeed(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!feedAgentId.trim()) return;

    setIsLoadingFeed(true);
    setFeedError(null);
    try {
      const res = await fetch(`/api/agent/feed?agentId=${encodeURIComponent(feedAgentId.trim())}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }

      const data = (await res.json()) as { posts: FeedPostItem[] };
      setFeedPosts(data.posts || []);
    } catch (err: unknown) {
      setFeedError(err instanceof Error ? err.message : "Failed to load feed");
      setFeedPosts(null);
    } finally {
      setIsLoadingFeed(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12 text-slate-100">
      {/* Header Badge */}
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400 border border-emerald-500/20">
          <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Autonomous System Active
        </span>
        <span className="text-xs text-slate-400">ABTalks Vibe Code Hackathon</span>
      </div>

      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
        Autonomous AI Creator
      </h1>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-400">
        Discovers timely technology developments from live web sources, evaluates candidate topics against strict AI persona standards, rejects repetitive or low-signal announcements, drafts source-grounded posts, and exposes an immutable feed.
      </p>

      {/* Two Column Section */}
      <div className="mt-10 grid gap-8 md:grid-cols-2">
        {/* Card 1: Agent Initializer */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">1. Initialize Creator Agent</h2>
            <span className="font-mono text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
              POST /api/agent/init
            </span>
          </div>
          <form onSubmit={handleInitializeAgent} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Persona Name</label>
              <input
                type="text"
                value={initName}
                onChange={(e) => setInitName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Domain Focus</label>
              <input
                type="text"
                value={initDomain}
                onChange={(e) => setInitDomain(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isInitializing}
              className="w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {isInitializing ? "Initializing Agent..." : "Initialize Agent"}
            </button>
          </form>

          {initError && (
            <div className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300">
              {initError}
            </div>
          )}

          {createdAgentId && (
            <div className="mt-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300">
              <p className="font-semibold">Agent Initialized Successfully!</p>
              <p className="mt-1 font-mono text-[11px] break-all">{createdAgentId}</p>
              <button
                type="button"
                onClick={() => handleFetchFeed()}
                className="mt-2 text-xs font-semibold text-emerald-400 underline hover:text-emerald-300"
              >
                Fetch Feed for this Agent
              </button>
            </div>
          )}
        </section>

        {/* Card 2: Feed Inspector */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">2. Inspect Published Feed</h2>
            <span className="font-mono text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
              GET /api/agent/feed
            </span>
          </div>
          <form onSubmit={handleFetchFeed} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Agent ID</label>
              <input
                type="text"
                placeholder="agent_..."
                value={feedAgentId}
                onChange={(e) => setFeedAgentId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoadingFeed}
              className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 disabled:opacity-50"
            >
              {isLoadingFeed ? "Fetching Feed..." : "Fetch Feed Posts"}
            </button>
          </form>

          {feedError && (
            <div className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300">
              {feedError}
            </div>
          )}

          {feedPosts && feedPosts.length === 0 && (
            <div className="mt-4 rounded-lg bg-slate-800/50 p-4 text-center text-xs text-slate-400">
              No published posts found yet for this agent. Background worker cycle will publish new posts on its next interval.
            </div>
          )}
        </section>
      </div>

      {/* Feed Output Display */}
      {feedPosts && feedPosts.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold text-white mb-4">Published Agent Feed ({feedPosts.length} posts)</h2>
          <div className="space-y-4">
            {feedPosts.map((post) => (
              <article key={post.id} className="rounded-xl border border-white/10 bg-slate-900/80 p-5 shadow-md">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-mono text-[11px] text-slate-500">{post.id}</span>
                  <time className="font-mono text-emerald-400">{new Date(post.createdAt).toUTCString()}</time>
                </div>

                <p className="text-sm text-slate-200 leading-relaxed font-sans mb-3">{post.text}</p>

                <div className="mt-3 rounded-lg bg-slate-950/80 p-3 border border-white/5 text-xs">
                  <span className="font-semibold text-emerald-400">Editorial Rationale: </span>
                  <span className="text-slate-300">{post.rationale}</span>
                </div>

                {post.sources && post.sources.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-400 font-medium">Sources:</span>
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
            ))}
          </div>
        </section>
      )}

      {/* Footer Metrics */}
      <footer className="mt-16 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
        Autonomous AI Creator — ABTalks Vibe Code Hackathon | Next.js 16 • PostgreSQL • TypeScript Worker
      </footer>
    </main>
  );
}
