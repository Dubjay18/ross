import { useEffect, useState } from "react";
import { ROSS_VERSION, type HealthStatus } from "@ross/shared";

const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export function App() {
  const [apiHealth, setApiHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/health`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json() as Promise<HealthStatus>;
      })
      .then((data) => {
        if (!cancelled) setApiHealth(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "API unreachable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">Agentic Cinema · Parallel track</p>
        <h1>Ross</h1>
        <p className="tagline">
          Script continuity + real-world fact checks for the writers&apos; room.
        </p>
      </header>

      <section className="card">
        <h2>Status</h2>
        <dl>
          <div>
            <dt>Package</dt>
            <dd>v{ROSS_VERSION}</dd>
          </div>
          <div>
            <dt>API</dt>
            <dd>
              {error && <span className="bad">{error}</span>}
              {!error && !apiHealth && <span className="muted">checking…</span>}
              {apiHealth?.ok && (
                <span className="ok">
                  {apiHealth.service} ok
                  {apiHealth.version ? ` · v${apiHealth.version}` : ""}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Endpoint</dt>
            <dd className="mono">{apiBase}/health</dd>
          </div>
        </dl>
      </section>

      <p className="foot">Module 1 contracts loaded — upload &amp; analysis land next.</p>
    </main>
  );
}
