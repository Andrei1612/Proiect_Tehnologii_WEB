# Marketplace și Gestiunea Comenzilor (Tema 6 | Pachete: STA + EXT)

Proiect pentru disciplina **Tehnologii Web** (CSIE, ASE București, 2026–2027).

- **Tema:** Tema 6 — Marketplace și gestiunea comenzilor
- **Pachete arhitecturale obligatorii:**
  - `STA` — Fluxuri cu stări (mașină de stări explicită pentru comenzi)
  - `EXT` — Integrare externă rezilientă (simulator local de livrare cu fault injection, retry/backoff și webhook-uri idempotente)
- **Tehnologii:** JavaScript ESM (`"type": "module"`), Node.js LTS, Express, Sequelize + SQLite, React + Vite (fără TypeScript).

---

## Structura repository-ului

```text
/
├── .env.example        # Variabile de mediu (fără secrete reale)
├── .gitignore
├── package.json        # Workspaces & scripturi root
├── SPEC.md             # Specificația completă și planul în 12 pași
├── docs/               # Documentație M1–M3, ADR-uri, dovezi STA/EXT și referințe oficiale
├── backend/            # API REST Express + Sequelize + SQLite (port implicit: 4000)
├── simulator/          # Serviciu extern simulat de livrare/curierat (port implicit: 4001)
├── frontend/           # SPA React + Vite (port dev: 5173)
├── e2e/                # Teste End-to-End (Playwright — Pasul 11)
└── load-tests/         # Teste de încărcare (Artillery — Pasul 11)
```

---

## Cerințe preliminare

- **Node.js LTS** (recomandat v20+ / v22+ / v24+)
- **npm** v10+

---

## Instalare și pornire (Schelet M1 — Pasul 1)

1. **Copiază fișierul de variabile de mediu:**
   ```bash
   cp .env.example .env
   ```
   *(Pe Windows PowerShell: `Copy-Item .env.example .env`)*

2. **Instalează dependențele (toate workspace-urile):**
   ```bash
   npm install
   ```

3. **Pornește toate serviciile simultan în mod dezvoltare:**
   ```bash
   npm run dev
   ```

   Sau pornește fiecare componentă separat, în terminale distincte:
   ```bash
   npm run dev:simulator   # Simulator extern -> http://localhost:4001
   npm run dev:backend     # Backend API      -> http://localhost:4000
   npm run dev:frontend    # Frontend SPA     -> http://localhost:5173
   ```

---

## Verificare rapidă a scheletului

- **Backend health:** `GET http://localhost:4000/health` și `GET http://localhost:4000/api/health` -> `200 OK`
- **Simulator health:** `GET http://localhost:4001/health` -> `200 OK`
- **Frontend SPA:** `http://localhost:5173` — afișează starea live a ambelor servicii (folosind proxy-ul Vite `/api` -> `http://localhost:4000`).
- **Build frontend (verificare producție):**
  ```bash
  npm run build:frontend
  ```

---

## Progres implementare

- [x] **Pasul 1:** Structură repo și schelet executabil ESM (`backend`, `simulator`, `frontend`)
- [ ] **Pasul 2:** Documentație analiză și design M1 (`requirements`, `architecture`, schițe ADR, planuri teste/capacitate)
- [ ] **Pașii 3–12:** Conform [SPEC.md](./SPEC.md)
