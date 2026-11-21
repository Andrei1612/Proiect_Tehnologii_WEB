import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const SIMULATOR_URL = import.meta.env.VITE_SIMULATOR_URL || 'http://localhost:4001';

function StatusCard({ title, endpoint, state }) {
  return (
    <article className="card">
      <div className="card-header">
        <h2>{title}</h2>
        <span className={`badge badge-${state.status}`}>{state.status.toUpperCase()}</span>
      </div>
      <p className="endpoint">
        <code>GET {endpoint}</code>
      </p>
      {state.status === 'loading' && <p className="muted">Se verifică disponibilitatea...</p>}
      {state.status === 'ok' && (
        <pre className="payload">{JSON.stringify(state.data, null, 2)}</pre>
      )}
      {state.status === 'error' && <p className="error-text">{state.error}</p>}
    </article>
  );
}

function SkeletonHome() {
  const [backend, setBackend] = useState({ status: 'loading', data: null, error: null });
  const [simulator, setSimulator] = useState({ status: 'loading', data: null, error: null });

  const checkServices = async () => {
    setBackend({ status: 'loading', data: null, error: null });
    setSimulator({ status: 'loading', data: null, error: null });

    const check = async (url, setter) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setter({ status: 'ok', data, error: null });
      } catch (err) {
        setter({
          status: 'error',
          data: null,
          error: `Indisponibil (${err.message}). Pornește serviciul local.`,
        });
      }
    };

    await Promise.all([
      check(`${API_BASE}/health`, setBackend),
      check(`${SIMULATOR_URL}/health`, setSimulator),
    ]);
  };

  useEffect(() => {
    checkServices();
  }, []);

  return (
    <main className="container">
      <header className="hero">
        <p className="eyebrow">Tehnologii Web · Tema 6 · Pachete STA + EXT</p>
        <h1>Marketplace și Gestiunea Comenzilor</h1>
        <p className="subtitle">
          Schelet executabil ESM (Pasul 1 — Etapa M1). Backend Express, Simulator extern de livrare
          și Frontend React + Vite.
        </p>
        <button type="button" className="refresh-btn" onClick={checkServices}>
          Reverifică serviciile
        </button>
      </header>

      <section className="grid">
        <StatusCard title="Backend API" endpoint={`${API_BASE}/health`} state={backend} />
        <StatusCard
          title="Delivery Simulator (EXT)"
          endpoint={`${SIMULATOR_URL}/health`}
          state={simulator}
        />
      </section>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<SkeletonHome />} />
    </Routes>
  );
}
