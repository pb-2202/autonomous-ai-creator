const endpoints = [
  {
    method: "POST",
    path: "/api/agent/init",
    description: "Creates one creator profile and schedules its first worker job."
  },
  {
    method: "GET",
    path: "/api/agent/feed?agentId=...",
    description: "Reads the creator's immutable post feed, newest first."
  }
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-20">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-[#82e6d0]">
        Autonomous AI Creator
      </p>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
        The foundation is ready for an agent that publishes signal, not noise.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-[#9cacbf]">
        This initial application provides the persistent API and worker boundaries. Live discovery,
        editorial decisions, and publishing are intentionally the next increment.
      </p>

      <section className="mt-12 rounded-2xl border border-white/10 bg-[#111e30] p-6 shadow-2xl shadow-black/20">
        <h2 className="text-xl font-semibold">Available API routes</h2>
        <div className="mt-5 space-y-4">
          {endpoints.map((endpoint) => (
            <div key={endpoint.path} className="rounded-xl bg-black/20 p-4">
              <p className="font-mono text-sm text-[#82e6d0]">
                {endpoint.method} {endpoint.path}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#9cacbf]">{endpoint.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
