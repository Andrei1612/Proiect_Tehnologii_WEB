# Strategie de Testare, Plan de Acoperire și Analiză Lacune

> **Proiect:** Marketplace și gestiunea comenzilor (Tema 6 | Pachete: `STA` + `EXT`)  
> **Etapă:** M1 — Plan inițial de testare (rezultatele reale de coverage și analiza finală a lacunelor se completează în **Pasul 8** și **Pasul 11**)  
> **Instrumente:** `vitest`, `@vitest/coverage-v8`, `supertest` (backend), `playwright` (E2E)

---

## 1. Strategia de testare (Piramida testelor)

Testarea este organizată pe 3 niveluri complementare, rulate complet automat, fără dependențe externe și fără servicii plătite:

| Nivel | Instrumente | Mediu | Obiectiv | Etapa de implementare |
| :--- | :--- | :--- | :--- | :--- |
| **1. Teste unitare** | Vitest | Izolat în memorie (fără DB/HTTP) | Verificarea exhaustivă a logicii pure de business: `orderStateMachine.js` (`STA`), politica de retry/backoff/jitter și clasificarea erorilor din `deliveryClient.js` (`EXT`), utilitare HMAC/validare. | Pașii 6–7 |
| **2. Teste de integrare (API + DB)** | Vitest + Supertest | Express app + SQLite de test (`NODE_ENV=test`, DB izolată + `PRAGMA foreign_keys = ON`) + instanță locală `simulator` pe port efemer | Verificarea contractului REST, persistenței Sequelize, constrângerilor SQL, autentificării/RBAC/ownership, testelor negative, checkout-ului atomic/idempotent și scenariilor deterministe `STA` și `EXT`. | Pașii 3–7 |
| **3. Teste End-to-End (E2E)** | Playwright | Browser Chromium + Backend + Simulator + Frontend SPA pornite local | Validarea cel puțin unui flux complet cap-coadă din perspectiva utilizatorilor reali (`CUSTOMER` -> `SELLER` -> `SIMULATOR` -> `CUSTOMER`). | Pasul 11 |

---

## 2. Matricea de acoperire a cerințelor și invariantelor

| Zonă / Cerință | Scenarii de test planificate | Tip test | Pas țintă |
| :--- | :--- | :--- | :---: |
| **Constrângeri DB (I1, I4)** | Respingere `Product.stock < 0`, `Product.priceCents <= 0`, `ExternalCallbackLog.eventId` duplicat, încălcare FK (`PRAGMA foreign_keys = ON`). | Integrare DB | Pasul 3 |
| **Auth & Securitate negativă (I5)** | Register/login valid; parolă greșită (`401`); token lipsă/expirat/invalid (`401`); acces rol neautorizat (`403`); validare payload invalid (`400`); absența `passwordHash` în toate răspunsurile. | Integrare API | Pasul 4 |
| **Catalog, Filtrare & Paginare** | Căutare text, filtrare `categoryId`, `sellerId`, `minPrice`/`maxPrice`, `inStock`, ordonare `asc`/`desc`, paginare (`page`, `limit`, `totalPages`). | Integrare API | Pasul 5 |
| **Ownership Produse & Comenzi (I5)** | `SELLER B` primește `403` la `PATCH/DELETE` pe produsul lui `SELLER A`; `CUSTOMER 2` și `SELLER B` primesc `403` la `GET /api/orders/:id` pentru comenzile altora. | Integrare API | Pasul 5 |
| **Checkout atomic & Idempotență (I1, I3)** | Grupare multi-seller în comenzi distincte; scădere atomică stoc; rollback complet la stoc insuficient (`409`); retrimitere cu același `Idempotency-Key` fără dublare comandă/stoc. | Integrare API | Pasul 5 |
| **Pachet `STA` — Mașină de stări (I2, I3)** | Toate cele 6 tranziții valide; toate tranzițiile ilegale (`409`); actori neautorizați/cross-seller (`403`); guards neîndepliniți (`422`); audit `OrderStateTransition`; anulare duplicată (stoc restaurat o singură dată). | Unitar + Integrare API | Pasul 6 |
| **Pachet `EXT` — Client rezilient & Webhook (I4)** | (1) `500` persistent -> retry limitat + `FAILED_PERMANENT`; (2) `429` + `Retry-After` + `FAIL_FIRST_N=2` -> recuperare; (3) `TIMEOUT` -> `AbortController`; (4) `400` -> 0 retry-uri; (5) 3 callback-uri duplicate secvențiale + 5 concurente -> 1 singură tranziție; (6) HMAC invalid -> `401`. | Unitar + Integrare API | Pasul 7 |
| **Flux complet UI (E2E)** | Login client -> filtrare catalog -> adăugare coș -> checkout -> login vânzător -> confirmare/împachetare/dispatch -> webhook livrare din simulator -> verificare `DELIVERED` în UI client. | E2E Playwright | Pasul 11 |

---

## 3. Politica de acoperire a codului (Code Coverage)

### 3.1 Praguri obligatorii pe codul backend scris în proiect
Configurate în `backend/vitest.config.js` folosind `@vitest/coverage-v8`:
- **Statement coverage:** `>= 70%`
- **Branch coverage:** `>= 60%`

### 3.2 Excluderi justificate din raportul de coverage

| Pattern exclus | Justificare |
| :--- | :--- |
| `node_modules/**` | Dependențe terțe, nu reprezintă cod scris în proiect. |
| `src/server.js` | Punct de intrare minimal (`app.listen`), testat prin pornirea aplicației; aplicația Express este testată prin `src/app.js`. |
| `src/scripts/seed.js` | Script CLI de populare inițială a bazei de date, verificat separat prin rularea `npm run seed`. |
| `vitest.config.js` | Fișier de configurare al runner-ului de teste. |
| `tests/**` | Codul testelor și helper-ele de test nu intră în calculul acoperirii codului de producție. |

---

## 4. Rezultate măsurate (de completat în Pasul 8)

> *Status M1:* Suita de teste și raportul V8 coverage urmează să fie construite incremental în Pașii 3–8.

| Metrică | Prag obligatoriu | Valoare măsurată (M2 / Pasul 8) | Status |
| :--- | :---: | :---: | :---: |
| Statements | >= 70% | *Pending (Pasul 8)* | Neexecutat încă |
| Branches | >= 60% | *Pending (Pasul 8)* | Neexecutat încă |
| Functions | — (informativ) | *Pending (Pasul 8)* | Neexecutat încă |
| Lines | — (informativ) | *Pending (Pasul 8)* | Neexecutat încă |
| Teste unitare + integrare | 100% pass | *Pending (Pașii 3–8)* | Neexecutat încă |
| Test E2E (Playwright) | 100% pass | *Pending (Pasul 11)* | Neexecutat încă |

---

## 5. Funcționalități insuficient testate și riscuri asociate (draft inițial)

> *Notă:* Această analiză va fi actualizată onest pe baza ramurilor neacoperite raportate de `@vitest/coverage-v8` în Pasul 8 și după rularea E2E în Pasul 11.

Zone de risc identificate anticipat încă din M1:
1. **Concurență ridicată pe SQLite la checkout simultan pe același produs:** Deși update-ul condiționat `WHERE stock >= qty` previne stocul negativ, SQLite poate arunca erori temporare `SQLITE_BUSY` sub scrieri concurente masive; comportamentul de degradare sub concurență va fi observat suplimentar în testele de încărcare (`docs/capacity.md`).
2. **Acoperirea componentelor UI React:** Pragurile automate de coverage se aplică backend-ului; interfața React este verificată prin fluxul E2E principal (Playwright), dar stări vizuale rare (ex. erori de rețea intermediare pe toate formularele) pot rămâne parțial neacoperite de teste automate.
3. **Securitate avansată (XSS / CSRF / scanare automată):** Pachetul `SEC` (OWASP ZAP) nu face parte din cele două pachete alocate Temei 6; verificarea securității de bază se realizează prin teste automate negative (auth, RBAC, IDOR, validare) și revizie manuală de cod.
