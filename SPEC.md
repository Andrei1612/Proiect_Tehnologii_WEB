# SPEC.MD — Marketplace și Gestiunea Comenzilor (Tema 6 | Pachete: STA + EXT)

> **Disciplina:** Tehnologii Web (CSIE, ASE București, 2026–2027)  
> **Tema:** Tema 6 — Marketplace și gestiunea comenzilor  
> **Pachete arhitecturale obligatorii:** `STA` (Fluxuri cu stări) + `EXT` (Integrare externă rezilientă)  
> **Documente sursă oficiale (referință):** `docs/reference/00-general-specifications.md`, `docs/reference/01-architectural-challenges.md`, `docs/reference/tema6-marketplace-orders.md`

---

## 0. PROTOCOL STRICT DE EXECUȚIE PENTRU AGENTUL AI (ANTIGRAVITY)

Acest fișier este sursa unică de adevăr (Single Source of Truth) pentru proiect. Înainte de a scrie sau modifica orice fișier, respectă cu strictețe următoarele reguli:

1. **EXECUȚIE INCREMENTALĂ (UN SINGUR PAS LA UN MOMENT DAT):**
   - **NU** genera întregul proiect dintr-o singură încercare.
   - Execută **exclusiv pasul solicitat explicit de utilizator** din Secțiunea 8 (Planul de execuție în 12 pași).
   - La finalul fiecărui pas:
     1. Rulează comenzile de verificare aferente pasului (lint/start/teste).
     2. Prezintă un rezumat scurt al fișierelor create/modificate și rezultatul verificărilor.
     3. Propune un mesaj de commit Git în format **Conventional Commits** (ex. `feat(db): add sequelize models and deterministic seed script`).
     4. **OPREȘTE-TE și așteaptă confirmarea utilizatorului** (care va inspecta diff-ul și va face `git commit`) înainte de a trece la pasul următor.
2. **CONSTRÂNGERI TEHNOLOGICE NENEGOCIABILE (HARD RULES):**
   - **EXCLUSIV JavaScript cu module ECMAScript (`"type": "module"` în `package.json`)**.
   - **FĂRĂ TypeScript** (nu crea niciun fișier `.ts`, `.tsx`, `tsconfig.json` și nu instala `typescript`).
   - **Backend:** Node.js LTS + Express (API REST HTTP/JSON).
   - **Persistență:** Sequelize ORM + SQLite (cu constrângeri active la nivel de DB: `PRAGMA foreign_keys = ON`). Nu folosi Prisma, Mongoose sau baze NoSQL.
   - **Frontend:** React + Vite + React Router (`.jsx`/`.js`), folosind API-uri web native (`fetch`, `localStorage`).
   - **Fără servicii cloud plătite** și fără microserviciu/Docker obligatoriu. Serviciul extern de livrare este un simulator HTTP local în directorul `simulator/`.
3. **CALITATE ȘI SECURITATE:**
   - Nu stoca parole în clar și nu expune secrete în cod sau în Git (`.env` este în `.gitignore`, iar `.env.example` conține doar valori placeholder).
   - Nu expune stack trace-uri sau date sensibile (ex. `passwordHash`) în răspunsuri HTTP sau în loguri.
   - Orice regulă critică de business (invariante) se impune în **backend și baza de date**, niciodată doar în interfața React.
   - Orice funcționalitate nouă de backend trebuie însoțită de teste automate verificabile.

---

## 1. ARHITECTURA GENERALĂ ȘI STRUCTURA REPOSITORY-ULUI

Aplicația este organizată ca un repository unificat (monorepo ușor cu 3 aplicații Node/JS + documentație):

```text
/
├── .env.example                 # Variabile de mediu (fără secrete reale)
├── .gitignore                   # node_modules, .env, *.sqlite, coverage, dist
├── README.md                    # Instrucțiuni complete: setup, seed, dev, test, coverage, load, prod
├── spec.md                      # Acest fișier de specificație
├── package.json                 # Scripturi root (convenience scripts pentru dev/test/seed/build)
├── docs/
│   ├── reference/               # Fișierele oficiale ale facultății (00, 01, tema6)
│   ├── requirements.md          # Roluri, fluxuri utilizator cu criterii de acceptare, invariante
│   ├── architecture.md          # Arhitectură, schemă ER, contract API, securitate/CORS/erori
│   ├── adr/
│   │   ├── 001-sta-explicit-state-machine.md
│   │   └── 002-ext-resilient-integration.md
│   ├── packages/
│   │   ├── sta-verification.md  # Dovezi reproductibile și scenarii verificate pentru STA
│   │   └── ext-verification.md  # Dovezi reproductibile și scenarii verificate pentru EXT
│   ├── testing.md               # Strategie testare, raport coverage, excluderi, lacune/riscuri
│   ├── capacity.md              # Test de încărcare pe 3 niveluri, mediu, p50/p95, bottleneck
│   └── ai-usage.md              # Rezumat unelte AI + caz tehnic documentat per student
├── backend/                     # API REST Express + Sequelize + SQLite (Port implicit: 4000)
│   ├── package.json             # "type": "module"
│   ├── vitest.config.js         # Configurare teste + V8 coverage (praguri >=70% stmt, >=60% branch)
│   ├── src/
│   │   ├── app.js               # Configurare aplicație Express (exportată pentru supertest)
│   │   ├── server.js            # Pornire HTTP server și inițializare DB
│   │   ├── config/              # env.js, database.js
│   │   ├── models/              # Modele Sequelize și asocieri (index.js)
│   │   ├── domain/              # Logică pură de business: orderStateMachine.js (STA)
│   │   ├── services/            # authService, productService, cartService, orderService, deliveryClient.js (EXT)
│   │   ├── controllers/         # Handlere HTTP subțiri
│   │   ├── routes/              # Rute Express (/api/auth, /api/products, /api/cart, /api/orders, /api/webhooks)
│   │   ├── middleware/          # auth.js, rbac.js, validate.js, errorHandler.js
│   │   ├── utils/               # AppError.js, crypto.js, logger.js
│   │   └── scripts/
│   │       └── seed.js          # Seed reproductibil (>=500 produse, >=100 comenzi)
│   └── tests/
│       ├── unit/                # Teste unitare (orderStateMachine, deliveryClient backoff/retry)
│       ├── integration/         # Teste integrare API + SQLite (auth, products, cart, orders, STA, EXT)
│       └── helpers/             # Factory DB test, helper autentificare
├── simulator/                   # Serviciu extern simulat de livrare/furnizare (Port implicit: 4001)
│   ├── package.json             # "type": "module"
│   └── src/
│       ├── app.js               # Express app (exportat pentru teste automate deterministe)
│       ├── server.js            # Pornire HTTP server pe portul 4001
│       └── faultStore.js        # Configurare deterministă de erori (429, 500, timeout, duplicate callback)
├── frontend/                    # SPA React + Vite (Port dev: 5173)
│   ├── package.json             # "type": "module"
│   ├── vite.config.js           # Proxy către backend în dev
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # Routing (React Router) + AuthContext
│       ├── api/                 # Client fetch centralizat (cu gestionare token și erori)
│       ├── components/          # Navbar, ProtectedRoute, ProductCard, StatusBadge, Loading/Error states
│       └── pages/               # Login/Register, Catalog, ProductDetail, Cart, CustomerOrders, SellerDashboard, SimulatorPanel
├── e2e/                         # Teste End-to-End automatizate (Playwright)
│   ├── package.json
│   └── tests/
│       └── marketplace-flow.spec.js
└── load-tests/                  # Scripturi reproductibile de testare a încărcării (Artillery)
    ├── low-load.yml
    ├── medium-load.yml
    ├── high-load.yml
    └── run-load-tests.js        # Script helper pentru colectare metrici
```

---

## 2. MODELUL DE DATE RELAȚIONAL (SEQUELIZE + SQLITE)

Toate tabelele folosesc constrângeri de integritate reale (`NOT NULL`, `UNIQUE`, `FOREIGN KEY`, `CHECK`). SQLite va rula obligatoriu cu `PRAGMA foreign_keys = ON;`.

### 2.1 Entități și coloane

1. **`User`**
   - `id` (INTEGER, PK, autoIncrement)
   - `email` (STRING, NOT NULL, UNIQUE)
   - `passwordHash` (STRING, NOT NULL) — hash generat cu `bcryptjs` (cost >= 10)
   - `name` (STRING, NOT NULL)
   - `role` (STRING, NOT NULL, CHECK IN `('CUSTOMER', 'SELLER', 'ADMIN')`, default `'CUSTOMER'`)
   - `createdAt`, `updatedAt`

2. **`Category`**
   - `id` (INTEGER, PK, autoIncrement)
   - `name` (STRING, NOT NULL, UNIQUE)
   - `slug` (STRING, NOT NULL, UNIQUE)
   - `description` (TEXT, NULLABLE)
   - `createdAt`, `updatedAt`

3. **`Product`**
   - `id` (INTEGER, PK, autoIncrement)
   - `sellerId` (INTEGER, NOT NULL, FK -> `User.id`)
   - `categoryId` (INTEGER, NOT NULL, FK -> `Category.id`)
   - `title` (STRING, NOT NULL)
   - `description` (TEXT, NOT NULL)
   - `priceCents` (INTEGER, NOT NULL, CHECK `priceCents > 0`) — prețul în bani/cenți pentru a evita erorile float
   - `stock` (INTEGER, NOT NULL, CHECK `stock >= 0`) — **invariantă protejată în DB**
   - `isActive` (BOOLEAN, NOT NULL, default `true`)
   - `createdAt`, `updatedAt`
   - **Indexuri:** `categoryId`, `sellerId`, `priceCents`, `isActive`

4. **`CartItem`**
   - `id` (INTEGER, PK, autoIncrement)
   - `customerId` (INTEGER, NOT NULL, FK -> `User.id` ON DELETE CASCADE)
   - `productId` (INTEGER, NOT NULL, FK -> `Product.id` ON DELETE CASCADE)
   - `quantity` (INTEGER, NOT NULL, CHECK `quantity > 0`)
   - **Constrângere compusă:** `UNIQUE(customerId, productId)`

5. **`Order`**
   - `id` (INTEGER, PK, autoIncrement)
   - `customerId` (INTEGER, NOT NULL, FK -> `User.id`)
   - `sellerId` (INTEGER, NOT NULL, FK -> `User.id`) — *Notă de design:* La checkout, dacă în coș există produse de la mai mulți vânzători, coșul este grupat per `sellerId` și se creează atomic câte o comandă per vânzător (sau în cadrul aceleiași tranzacții). Astfel fiecare comandă are un singur `sellerId` clar pentru autorizare și livrare.
   - `status` (STRING, NOT NULL, CHECK IN `('CREATED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED')`, default `'CREATED'`)
   - `totalCents` (INTEGER, NOT NULL, CHECK `totalCents > 0`)
   - `shippingAddress` (TEXT, NOT NULL)
   - `idempotencyKey` (STRING, NULLABLE, UNIQUE) — previne dublarea comenzii la retrimiteri client (pentru comenzile grupate per seller din același checkout: `${clientKey}:seller:${sellerId}`)
   - `externalShipmentId` (STRING, NULLABLE, UNIQUE) — ID-ul returnat de simulatorul de curierat
   - `externalSyncStatus` (STRING, NOT NULL, default `'NOT_SENT'`, CHECK IN `('NOT_SENT', 'PENDING_RETRY', 'DISPATCHED', 'FAILED_PERMANENT')`)
   - `externalAttempts` (INTEGER, NOT NULL, default `0`)
   - `lastExternalError` (TEXT, NULLABLE)
   - `stockRestored` (BOOLEAN, NOT NULL, default `false`) — gardă suplimentară împotriva dublei restaurări de stoc la anulare
   - `createdAt`, `updatedAt`
   - **Indexuri:** `customerId`, `sellerId`, `status`, `createdAt`

6. **`OrderItem`**
   - `id` (INTEGER, PK, autoIncrement)
   - `orderId` (INTEGER, NOT NULL, FK -> `Order.id` ON DELETE CASCADE)
   - `productId` (INTEGER, NOT NULL, FK -> `Product.id`)
   - `productTitleSnapshot` (STRING, NOT NULL)
   - `unitPriceCents` (INTEGER, NOT NULL, CHECK `unitPriceCents > 0`)
   - `quantity` (INTEGER, NOT NULL, CHECK `quantity > 0`)

7. **`OrderStateTransition`** (Audit și dovadă pentru `STA`)
   - `id` (INTEGER, PK, autoIncrement)
   - `orderId` (INTEGER, NOT NULL, FK -> `Order.id` ON DELETE CASCADE)
   - `fromState` (STRING, NULLABLE) — `null` pentru crearea inițială
   - `toState` (STRING, NOT NULL)
   - `actorId` (INTEGER, NULLABLE, FK -> `User.id`) — `null` pentru `EXTERNAL_SYSTEM`
   - `actorRole` (STRING, NOT NULL) — `'CUSTOMER' | 'SELLER' | 'ADMIN' | 'EXTERNAL_SYSTEM'`
   - `reason` (STRING, NULLABLE)
   - `requestKey` (STRING, NULLABLE) — opțional pentru trasabilitate/idempotență
   - `createdAt`

8. **`ExternalCallbackLog`** (Deduplicare strictă pentru `EXT`)
   - `id` (INTEGER, PK, autoIncrement)
   - `eventId` (STRING, NOT NULL, UNIQUE) — **cheia unică ce împiedică procesarea duplicată a callback-urilor**
   - `orderId` (INTEGER, NOT NULL, FK -> `Order.id`)
   - `eventType` (STRING, NOT NULL) — ex. `'SHIPMENT_CONFIRMED'`, `'SHIPMENT_DISPATCHED'`, `'SHIPMENT_DELIVERED'`
   - `payloadJson` (TEXT, NOT NULL)
   - `outcome` (STRING, NOT NULL) — `'APPLIED' | 'IGNORED_ILLEGAL_STATE' | 'DUPLICATE'`
   - `processedAt` (DATE, NOT NULL)

9. **`ExternalCallLog`** (Evidență apeluri outbound și retry pentru `EXT`)
   - `id` (INTEGER, PK, autoIncrement)
   - `orderId` (INTEGER, NOT NULL, FK -> `Order.id`)
   - `idempotencyKey` (STRING, NOT NULL)
   - `attemptNumber` (INTEGER, NOT NULL)
   - `httpStatus` (INTEGER, NULLABLE)
   - `errorType` (STRING, NULLABLE) — `'NONE' | 'TIMEOUT' | 'RATE_LIMIT_429' | 'SERVER_5XX' | 'CLIENT_4XX' | 'NETWORK'`
   - `latencyMs` (INTEGER, NOT NULL)
   - `createdAt`

---

## 3. INVARIANTE CRITICE DE BUSINESS

Aceste reguli **NU** pot fi ocolite de niciun apel HTTP, nici direct prin `curl`/Postman:

1. **Stoc non-negativ și rezervare atomică:** Plasarea comenzii scade stocul tuturor produselor implicate într-o **singură tranzacție Sequelize** folosind update condiționat (`UPDATE Products SET stock = stock - qty WHERE id = ? AND stock >= qty`). Dacă un produs nu are stoc suficient, întreaga tranzacție face rollback (`409 Conflict`).
2. **Integritatea stărilor comenzii (`STA`):** Nicio comandă nu poate fi actualizată direct printr-un `PUT /orders/:id { status: ... }` arbitrar. Toate modificările de stare trec exclusiv prin **mașina de stări explicită** (`orderStateMachine.js`).
3. **Idempotență la plasare și tranziții:** Repetarea cererii de checkout cu același `Idempotency-Key` returnează comanda deja creată fără a scădea din nou stocul. Repetarea unei tranziții deja efectuate nu dublează efectele secundare (ex. nu restaurează stocul de două ori la anulare).
4. **Idempotență la callback-uri externe (`EXT`):** Repetarea unui webhook de la simulator (secvențial sau concurent) cu același `eventId` este oprită de constrângerea `UNIQUE(eventId)` din `ExternalCallbackLog` și nu dublează confirmarea, expedierea sau livrarea.
5. **Izolarea resurselor pe rol și proprietar (Object-Level Authorization):**
   - `CUSTOMER` vede și poate anula **doar propriile comenzi**; nu poate crea/edita/șterge produse și nu poate trece o comandă în `PACKED`/`SHIPPED`/`DELIVERED`.
   - `SELLER` poate edita/șterge **doar propriile produse** și poate vedea/procesa **doar comenzile unde `order.sellerId === req.user.id`**.
   - `ADMIN` are acces administrativ la categorii și vizualizare globală.

---

## 4. SPECIFICAȚIA DETALIATĂ A PACHETULUI `STA` (FLUXURI CU STĂRI)

### 4.1 Mașina de stări explicită (`backend/src/domain/orderStateMachine.js`)
Nu se folosesc condiții `if/else` împrăștiate prin controllere. Se implementează un modul pur, declarativ, care definește graful de tranziții, actorii permiși și precondițiile (guards).

**Stări (6 stări, depășind minimul obligatoriu de 4):**
`CREATED` -> `CONFIRMED` -> `PACKED` -> `SHIPPED` -> `DELIVERED`  
(+ starea terminală `CANCELLED`)

**Matricea tranzițiilor permise:**

| Din starea (`from`) | În starea (`to`) | Actori autorizați | Precondiții (Guards) | Efecte secundare |
| :--- | :--- | :--- | :--- | :--- |
| `CREATED` | `CONFIRMED` | `SELLER` (owner), `EXTERNAL_SYSTEM`, `ADMIN` | Comanda are cel puțin 1 produs | Înregistrează tranziția în `OrderStateTransition` |
| `CREATED` | `CANCELLED` | `CUSTOMER` (owner), `SELLER` (owner), `ADMIN` | `order.stockRestored === false` | Restaurează atomic stocul produselor, setează `stockRestored = true` |
| `CONFIRMED` | `PACKED` | `SELLER` (owner), `ADMIN` | — | Înregistrează tranziția |
| `CONFIRMED` | `CANCELLED` | `CUSTOMER` (owner), `SELLER` (owner), `ADMIN` | `order.stockRestored === false` | Restaurează atomic stocul produselor, setează `stockRestored = true` |
| `PACKED` | `SHIPPED` | `SELLER` (owner), `EXTERNAL_SYSTEM`, `ADMIN` | `order.externalShipmentId !== null` (sau inițiere livrare confirmată) | Înregistrează tranziția |
| `SHIPPED` | `DELIVERED` | `EXTERNAL_SYSTEM`, `ADMIN` | `order.externalShipmentId !== null` | Stare finală; înregistrează tranziția |

**Reguli de comportament la erori și apeluri repetate:**
- **Tranziție nepermisă** (ex. `CREATED -> DELIVERED`, `SHIPPED -> CANCELLED`, `DELIVERED -> CANCELLED`, `CANCELLED -> CONFIRMED`): returnează `409 Conflict` cu cod de eroare `INVALID_STATE_TRANSITION` și mesaj explicit (`from`, `to`, `allowedNextStates`).
- **Actor neautorizat** (ex. `CUSTOMER` încearcă `CONFIRMED -> PACKED` sau `SELLER B` încearcă să modifice comanda lui `SELLER A`): returnează `403 Forbidden` cu cod `FORBIDDEN_TRANSITION_ACTOR`.
- **Precondiție neîndeplinită** (ex. `PACKED -> SHIPPED` fără `externalShipmentId`): returnează `422 Unprocessable Entity` cu cod `TRANSITION_PRECONDITION_FAILED`.
- **Apel repetat (Idempotență tranziție):**
  - Dacă cererea include header-ul `Idempotency-Key` (sau același `requestKey`) și tranziția exactă (`toState`) a fost deja aplicată pe acea comandă de acea cheie, returnează `200 OK` cu `{ order, idempotent: true }` fără a re-executa efectele secundare (fără dublă restaurare de stoc!).
  - Dacă se trimite o cerere nouă fără `Idempotency-Key` către starea în care comanda se află deja (ex. `CANCELLED -> CANCELLED`), mașina de stări respinge cu `409 Conflict` (`ALREADY_IN_STATE`) și nu dublează efectele secundare.

### 4.2 Verificări obligatorii `STA`
- Teste unitare directe pe `orderStateMachine.js` acoperind fiecare tranziție validă, fiecare tranziție ilegală, fiecare combinație de rol neautorizat și fiecare guard.
- Teste de integrare HTTP pe `POST /api/orders/:id/transition` verificând persistența în DB, tabelul `OrderStateTransition`, integritatea stocului la anulare repetată și codurile HTTP (`200`, `403`, `409`, `422`).
- **ADR obligatoriu:** `docs/adr/001-sta-explicit-state-machine.md` (Problema, Alternative: *Mașină de stări explicită custom* vs. *Condiții dispersate în controllere* vs. *Bibliotecă externă XState*, Decizie, Experiment/Teste, Limite).

---

## 5. SPECIFICAȚIA DETALIATĂ A PACHETULUI `EXT` (INTEGRARE EXTERNĂ REZILIENTĂ)

### 5.1 Simulatorul extern de livrare (`simulator/`, port `4001`)
Simulează un serviciu terț de curierat/furnizare. Expune următoarele endpoint-uri:

1. `GET /health` — verificare disponibilitate simulator.
2. `POST /shipments` — primește cerere de expediere de la Backend:
   - Header obligatoriu: `Idempotency-Key`
   - Body: `{ orderId, sellerId, shippingAddress, items, callbackUrl }`
   - Comportament normal: generează un `shipmentId` (determinist per `Idempotency-Key`, deci apelul duplicat returnează același `shipmentId` fără duplicare!), răspunde `201 Created` cu `{ shipmentId, status: 'ACCEPTED' }`.
   - Comportament cu fault injection (controlat fie global prin `/_control/faults`, fie per-request prin header `X-Fault-Mode` în teste):
     - `RATE_LIMIT_429`: răspunde `429 Too Many Requests` + header `Retry-After: 1`.
     - `SERVER_ERROR_500`: răspunde `500 Internal Server Error`.
     - `TIMEOUT`: întârzie răspunsul cu `delayMs` (ex. `2000ms` > timeout-ul backend-ului).
     - `FAIL_FIRST_N`: eșuează primele `N` încercări (cu `500` sau `429`) pentru același `Idempotency-Key` și reușește la încercarea `N + 1`.
3. `POST /shipments/:shipmentId/trigger-callback` — declanșează trimiterea unui webhook către `callbackUrl` al Backend-ului (`POST /api/webhooks/delivery`):
   - Body: `{ eventType: 'SHIPMENT_CONFIRMED' | 'SHIPMENT_DISPATCHED' | 'SHIPMENT_DELIVERED', eventId?, duplicateCount?: 1..5, concurrent?: boolean }`
   - Semnează payload-ul cu `X-Webhook-Signature` (HMAC-SHA256 folosind `WEBHOOK_SECRET` din `.env`).
   - Dacă `duplicateCount > 1`, trimite același `eventId` de `duplicateCount` ori (secvențial sau concurent cu `Promise.all`) pentru a testa idempotența backend-ului!
4. `POST /_control/faults` și `POST /_control/reset` — configurează/resetează scenariile de eroare (folosite atât de teste automate, cât și din panoul UI de demonstrație).

### 5.2 Clientul HTTP rezilient din Backend (`backend/src/services/deliveryClient.js`)
Când un vânzător (sau sistemul) solicită expedierea comenzii către serviciul extern (`POST /api/orders/:id/dispatch`):
1. **Timeout strict:** Folosește `fetch` nativ cu `AbortController` (ex. `EXTERNAL_TIMEOUT_MS=800` în producție/dev, configurabil mic, ex. `150ms`, în teste).
2. **Retry limitat cu Exponential Backoff + Jitter:**
   - `EXTERNAL_MAX_RETRIES=3` (total maxim 4 încercări: 1 inițială + 3 retry-uri).
   - Se face retry **DOAR** pe erori tranzitorii: `429`, `5xx`, timeout (`AbortError`), erori de rețea (`ECONNREFUSED`/`fetch failed`).
   - **NU** se face retry pe erori permanente `4xx` (`400`, `401`, `403`, `404`).
   - Dacă răspunsul `429` include `Retry-After`, se respectă (plafonat la o limită rezonabilă în dev/test).
   - Fiecare încercare este salvată în `ExternalCallLog` (număr încercare, status, tip eroare, latență ms).
3. **Outbound Idempotency:** Fiecare comandă trimite cheia stabilă `Idempotency-Key: order-dispatch-${order.id}` (astfel retry-urile nu creează 2 expedieri diferite în simulator).
4. **Stare coerentă la eșec total:** Dacă toate încercările eșuează, backend-ul **NU** corupe starea comenzii și **NU** o trece în `SHIPPED`. Actualizează `order.externalSyncStatus = 'FAILED_PERMANENT'`, `order.externalAttempts`, `order.lastExternalError` și returnează `502 Bad Gateway` / `504 Gateway Timeout` cu detalii structurate, permițând o reîncercare ulterioară sigură.

### 5.3 Handler Inbound Webhook Idempotent (`POST /api/webhooks/delivery`)
1. Verifică semnătura HMAC `X-Webhook-Signature` (`401 Unauthorized` dacă lipsește sau e invalidă).
2. Validează payload-ul (`eventId`, `orderId`, `shipmentId`, `eventType`).
3. Într-o **tranzacție Sequelize**:
   - Încearcă inserarea în `ExternalCallbackLog` cu `eventId` (`UNIQUE`).
   - Dacă `eventId` există deja (prinde `SequelizeUniqueConstraintError` sau găsește înregistrarea): **nu modifică comanda**, nu re-execută tranziția, și răspunde `200 OK` cu `{ status: 'duplicate_ignored', eventId }`.
   - Dacă este nou: mapează `eventType` la starea țintă (`SHIPMENT_CONFIRMED -> CONFIRMED`, `SHIPMENT_DISPATCHED -> SHIPPED`, `SHIPMENT_DELIVERED -> DELIVERED`) și apelează `orderStateMachine` cu actorul `EXTERNAL_SYSTEM`.
   - Dacă mașina de stări respinge tranziția (ex. webhook sosit din greșeală pentru o comandă deja `CANCELLED`), marchează callback-ul în `ExternalCallbackLog` cu `outcome = 'IGNORED_ILLEGAL_STATE'` și răspunde coerent (`409` sau `200` cu status explicit — vom folosi `409 Conflict` cu log salvat, fără a corupe comanda!).

### 5.4 Verificări obligatorii `EXT`
- Teste deterministe de injecție de eșec:
  1. `500` persistent -> retry exact de `maxRetries` ori, `ExternalCallLog` înregistrează toate încercările, `order.externalSyncStatus === 'FAILED_PERMANENT'`, starea comenzii rămâne neatinsă.
  2. `429` cu `Retry-After` -> backoff respectat, recuperare la încercarea 3 (`FAIL_FIRST_N = 2`), `externalShipmentId` salvat.
  3. `TIMEOUT` -> `AbortController` întrerupe cererea, retry limitat, recuperare sau eșec controlat.
  4. `400 Bad Request` -> **0 retry-uri** (dovadă că nu reîncearcă erori non-tranzitorii).
  5. **Callback duplicat** (3 apeluri secvențiale + 5 apeluri concurente cu același `eventId`) -> exact 1 înregistrare în `OrderStateTransition` pentru acea tranziție, stocul și starea rămân consistente.
  6. Semnătură webhook invalidă -> `401 Unauthorized`.
- **ADR obligatoriu:** `docs/adr/002-ext-resilient-integration.md` (Timeout, retry/backoff/jitter, idempotență outbound & inbound, persistența stării operației, limitele SQLite sub concurență).

---

## 6. CONTRACTUL API REST (BACKEND — PORT `4000`)

Format standard de eroare pentru toate endpoint-urile:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descriere clară în limbaj natural",
    "details": []
  }
}
```

### Rute principale:
- **Health:** `GET /api/health`
- **Auth:**
  - `POST /api/auth/register` (`{ name, email, password, role: 'CUSTOMER' | 'SELLER' }`)
  - `POST /api/auth/login` (`{ email, password }` -> `{ token, user }`)
  - `GET /api/auth/me` (autentificat)
- **Categories:**
  - `GET /api/categories` (public)
  - `POST /api/categories` (`ADMIN` sau `SELLER`)
- **Products:**
  - `GET /api/products` (public) — **Filtrare, ordonare și paginare obligatorii:**
    - Query params: `search`, `categoryId`, `sellerId`, `minPrice`, `maxPrice`, `inStock` (`true`/`false`), `sortBy` (`priceCents` | `createdAt` | `title`), `sortOrder` (`asc` | `desc`), `page` (default `1`), `limit` (default `20`, max `100`).
    - Răspuns: `{ data: [...], meta: { total, page, limit, totalPages } }`.
  - `GET /api/products/:id` (public)
  - `POST /api/products` (`SELLER`, `ADMIN`)
  - `PATCH /api/products/:id` (`SELLER` owner sau `ADMIN`)
  - `DELETE /api/products/:id` (`SELLER` owner sau `ADMIN` — soft delete `isActive = false` dacă apare în comenzi existente)
- **Cart (`CUSTOMER`):**
  - `GET /api/cart`
  - `POST /api/cart/items` (`{ productId, quantity }`)
  - `PATCH /api/cart/items/:productId` (`{ quantity }`)
  - `DELETE /api/cart/items/:productId`
  - `DELETE /api/cart`
- **Orders:**
  - `POST /api/orders/checkout` (`CUSTOMER`, suportă header `Idempotency-Key`, body `{ shippingAddress }`) — creează atomic comanda/comenzile per seller, scade stocul, golește coșul.
  - `GET /api/orders` (autentificat: `CUSTOMER` vede doar comenzile sale; `SELLER` vede doar comenzile cu `sellerId === req.user.id`; `ADMIN` vede tot; suportă filtrare `status` și paginare `page`, `limit`).
  - `GET /api/orders/:id` (doar proprietar `CUSTOMER`, proprietar `SELLER` sau `ADMIN` — include `items`, `transitions`, `externalCallLogs`).
  - `POST /api/orders/:id/transition` (autentificat, body `{ toState, reason? }`, suportă `Idempotency-Key`) — trece prin `orderStateMachine`.
  - `POST /api/orders/:id/dispatch` (`SELLER` owner sau `ADMIN`) — apelează simulatorul extern prin `deliveryClient` (`EXT`).
- **Webhooks:**
  - `POST /api/webhooks/delivery` (semnat HMAC `X-Webhook-Signature`).

---

## 7. CERINȚE DE SEED, TESTARE, COVERAGE, PERFORMANȚĂ ȘI SECURITATE

### 7.1 Date Seed Reproductibile (`backend/src/scripts/seed.js`)
- Rulare prin `npm run seed` (idempotent / curăță și repopulează DB cu seed pseudo-aleator determinist, ex. generator PRNG cu seed fix `42`).
- Volume minime obligatorii:
  - **10 categorii**
  - **1 Admin**, **10 Sellers** (inclusiv `seller1@marketplace.local` / `Seller123!`), **20 Customers** (inclusiv `customer1@marketplace.local` / `Customer123!`), `admin@marketplace.local` / `Admin123!`
  - **Minimum 500 de produse** distribuite între categorii și vânzători, cu stocuri și prețuri variate
  - **Minimum 100 de comenzi** în diverse stări valide (`CREATED`, `CONFIRMED`, `PACKED`, `SHIPPED`, `DELIVERED`, `CANCELLED`), fiecare cu `OrderItems` și istoric valid în `OrderStateTransition`

### 7.2 Testare și Acoperire (Coverage)
- **Framework:** `vitest` + `@vitest/coverage-v8` + `supertest` (backend) și `playwright` (E2E).
- **Praguri obligatorii pe codul backend scris în proiect:**
  - **Statement coverage >= 70%**
  - **Branch coverage >= 60%**
- **Excluderi justificate (documentate în `docs/testing.md`):** `node_modules/**`, `src/scripts/seed.js`, `src/server.js`, `vitest.config.js`, teste.
- **Test E2E obligatoriu (Playwright):** Cel puțin un flux complet cap-coadă în browser (Client se autentifică -> filtrează catalog -> adaugă produs în coș -> plasează comandă -> Vânzător se autentifică -> confirmă/împachetează/expediază către simulator -> Simulator trimite webhook de livrare -> Client vede comanda `DELIVERED`).

### 7.3 Performanță și Capacitate (`load-tests/` + `docs/capacity.md`)
- Instrument: **Artillery** (instalat ca `devDependency`, rulabil prin `npm run load:low`, `npm run load:medium`, `npm run load:high`).
- Baza de date populată cu seed-ul complet (500 produse, 100 comenzi).
- **3 niveluri de încărcare** (ex. Low: 5 req/s timp de 30s; Medium: 20 req/s timp de 30s; High: 50 req/s timp de 30s) pe un mix realist de operații (70% citire/filtrare produse, 20% detalii produs/comenzi autentificate, 10% scriere coș/comandă).
- Metrici raportate în `docs/capacity.md`: throughput (RPS), latență `p50` și `p95`, rata erorilor (`%`), CPU/RAM observabil, descrierea exactă a mediului hardware/OS/Node, estimarea capacității susținute față de obiectivul de latență (ex. `p95 < 300ms`, erori `< 1%`) și analiza unui blocaj (bottleneck, ex. lock-urile de scriere SQLite sau bcrypt CPU-bound la login).

---

## 8. PLANUL DE EXECUȚIE PE PAȘI (ALINIAT CU MILESTONE-URILE M1, M2, M3)

> **Instrucțiune pentru Antigravity:** Execută exact pasul cerut de utilizator. Nu sări pași și nu combina pași decât la cererea explicită a utilizatorului.

### ETAPA M1 — Analiză, Design și Schelet Executabil

#### Pasul 1: Inițializare structură repo și schelet executabil
- Creează structura de directoare (`backend/`, `simulator/`, `frontend/`, `docs/`, `e2e/`, `load-tests/`).
- Inițializează `package.json` (root + subproiecte) cu `"type": "module"`, fără TypeScript.
- Creează `.gitignore`, `.env.example`, și rute `/health` funcționale în `backend` (4000) și `simulator` (4001), plus aplicația minimă React+Vite în `frontend` (5173).
- Creează un `README.md` inițial cu instrucțiuni de pornire a scheletului.
- **Verificare:** `backend` și `simulator` răspund `200 OK` la `/health`; `frontend` pornește cu Vite fără erori.
- **Commit sugerat:** `chore: initialize project structure and runnable ESM skeleton`

#### Pasul 2: Documentația de analiză și design M1
- Scrie `docs/requirements.md`: actori (`CUSTOMER`, `SELLER`, `ADMIN`, `EXTERNAL_SYSTEM`), cel puțin 4 fluxuri complete cu criterii de acceptare (Given/When/Then), invariante critice.
- Scrie `docs/architecture.md`: diagrama componentelor (ASCII/Mermaid), schema relațională ER, lista endpoint-urilor REST, politica de securitate (parole, JWT, CORS, tratare erori).
- Creează schițele inițiale (cu problemă și alternative analizate) pentru `docs/adr/001-sta-explicit-state-machine.md` și `docs/adr/002-ext-resilient-integration.md`.
- Creează planul inițial în `docs/testing.md` și modelul de sarcină în `docs/capacity.md`.
- **Verificare:** Toate fișierele cerute pentru M1 există și sunt coerente cu `spec.md`.
- **Commit sugerat:** `docs(m1): add requirements, architecture, ADR drafts, and test/capacity plans`

#### Pasul 3: Stratul de persistență Sequelize + SQLite și Seed determinist
- Implementează configurarea Sequelize (`backend/src/config/database.js`) cu `PRAGMA foreign_keys = ON` și suport pentru baza de test separată (`NODE_ENV=test`).
- Implementează toate cele 9 modele din Secțiunea 2 cu asocierile, indexurile și constrângerile `CHECK` / `UNIQUE` / `FK`.
- Implementează `backend/src/scripts/seed.js` (determinist: 10 categorii, 31 utilizatori cu conturi demo clare, >=500 produse, >=100 comenzi cu `OrderItems` și `OrderStateTransition`).
- Adaugă un test de integrare de bază care verifică constrângerile DB (ex. `stock < 0` respins de SQLite, `eventId` duplicat respins de SQLite).
- **Verificare:** `npm run seed` creează >=500 produse și >=100 comenzi fără erori; testul de constrângeri DB trece.
- **Commit sugerat:** `feat(db): implement Sequelize models, integrity constraints, and deterministic seed`

---

### ETAPA M2 — Backend, Securitate, Pachete Arhitecturale (`STA` + `EXT`) și Teste

#### Pasul 4: Autentificare, Autorizare (RBAC + Ownership), Validare și Securitate de bază
- Implementează `authService`, rute `/api/auth/register`, `/api/auth/login`, `/api/auth/me` cu `bcryptjs` și `jsonwebtoken`.
- Implementează middleware-urile: `authenticate`, `authorizeRoles`, `errorHandler` centralizat (`AppError`), validare strictă a payload-urilor (cu `zod` sau validatoare explicite), `helmet` și `cors` configurabil prin `.env`.
- Scrie teste de integrare și teste negative de securitate: parolă greșită (`401`), token lipsă/invalid (`401`), rol neautorizat (`403`), intrări invalide (`400`), verificare că `passwordHash` nu apare niciodată în răspunsuri.
- **Verificare:** Toate testele de auth și securitate trec.
- **Commit sugerat:** `feat(auth): implement JWT authentication, RBAC middleware, validation, and security tests`

#### Pasul 5: API Core Marketplace (Categorii, Produse, Coș, Checkout atomic)
- Implementează CRUD Categorii și Produse (`GET /api/products` cu filtrare, căutare, ordonare și paginare; `POST/PATCH/DELETE` cu verificare `sellerId` ownership).
- Implementează gestionarea coșului (`GET/POST/PATCH/DELETE /api/cart`).
- Implementează `POST /api/orders/checkout` cu:
  - Grupare atomică pe vânzător într-o tranzacție Sequelize.
  - Scădere atomică condiționată a stocului (`stock >= quantity`) + rollback la stoc insuficient (`409`).
  - Suport `Idempotency-Key` (retrimiterea aceluiași checkout nu dublează comanda și nu scade stocul de două ori).
  - Înregistrare stare inițială `CREATED` în `OrderStateTransition`.
- Implementează `GET /api/orders` (cu filtrare pe rol, status și paginare) și `GET /api/orders/:id` (cu protecție IDOR).
- Scrie teste de integrare complete pentru filtrare/paginare, ownership produs/comandă, checkout cu stoc insuficient și checkout idempotent.
- **Verificare:** Suita de teste trece integral.
- **Commit sugerat:** `feat(marketplace): add products filtering/pagination, cart, and atomic checkout`

#### Pasul 6: Pachetul `STA` — Mașina de Stări Explicită, Teste și ADR 001
- Implementează `backend/src/domain/orderStateMachine.js` conform Secțiunii 4 (cele 6 stări, matricea de tranziții, actorii permiși, gardienii).
- Implementează `POST /api/orders/:id/transition` în `orderService` (cu tranzacție Sequelize, restaurare atomică a stocului la `CANCELLED` protejată prin `stockRestored`, suport `Idempotency-Key` și log în `OrderStateTransition`).
- Scrie teste unitare exhaustive pentru `orderStateMachine.js` și teste de integrare HTTP pentru:
  - Toate tranzițiile valide.
  - Tranziții ilegale (`409`).
  - Actori neautorizați și cross-seller (`403`).
  - Precondiții neîndeplinite (`422`).
  - Apeluri repetate / anulare duplicată (stocul nu se restaurează de 2 ori).
- Finalizează `docs/adr/001-sta-explicit-state-machine.md` și scrie `docs/packages/sta-verification.md` cu comenzile de rulare și dovezile observate.
- **Verificare:** Toate testele `STA` trec; documentația `STA` este completă.
- **Commit sugerat:** `feat(sta): implement explicit order state machine, transition tests, and ADR 001`

#### Pasul 7: Pachetul `EXT` — Simulator, Client Rezilient, Webhook Idempotent, Teste și ADR 002
- Implementează complet aplicația `simulator/` (`POST /shipments`, `POST /shipments/:id/trigger-callback` cu semnătură HMAC-SHA256, `POST /_control/faults`, `POST /_control/reset`, suport pentru `429`, `500`, `TIMEOUT`, `FAIL_FIRST_N`, `duplicateCount` secvențial și concurent).
- Implementează `backend/src/services/deliveryClient.js` cu `AbortController` timeout, retry limitat cu exponential backoff + jitter (respectând `Retry-After`), fără retry pe `4xx`, `Idempotency-Key` outbound și jurnalizare în `ExternalCallLog`.
- Implementează `POST /api/orders/:id/dispatch` și `POST /api/webhooks/delivery` (verificare HMAC, deduplicare atomică în `ExternalCallbackLog` prin `UNIQUE(eventId)`, integrare cu `orderStateMachine`).
- Scrie teste unitare pentru politica de retry/backoff și teste de integrare deterministe pornind instanța `simulator` pe port efemer (sau `supertest`/HTTP local) care demonstrează toate cele 6 scenarii din Secțiunea 5.4 (inclusiv callback-uri duplicate concurente).
- Finalizează `docs/adr/002-ext-resilient-integration.md` și scrie `docs/packages/ext-verification.md`.
- **Verificare:** Toate testele deterministe `EXT` trec rapid și reproductibil.
- **Commit sugerat:** `feat(ext): add delivery simulator, resilient HTTP client, idempotent webhooks, tests, and ADR 002`

#### Pasul 8: Consolidare M2 — Raport Coverage și Analiza Lacunelor
- Configurează pragurile Vitest V8 coverage (`>= 70%` statements, `>= 60%` branches) în `backend/vitest.config.js` cu excluderile documentate.
- Rulează `npm run coverage` în `backend/`. Dacă vreun prag este sub limită, adaugă teste relevante (nu teste artificiale!) pentru ramurile critice de eroare și edge-case-uri.
- Actualizează `docs/testing.md` cu rezultatele reale ale raportului de coverage, tabelul excluderilor și o secțiune onestă privind **funcționalitățile insuficient testate și riscurile asociate**.
- **Verificare:** `npm test` și `npm run coverage` trec peste pragurile impuse.
- **Commit sugerat:** `test(m2): verify backend coverage thresholds and update testing report`

---

### ETAPA M3 — Interfață SPA, Test E2E, Capacitate și Livrare Finală

#### Pasul 9: Frontend SPA (Partea 1) — Autentificare, Catalog, Coș și Flux Client
- Configurează React Router, `AuthContext` (persistență sesiune + logout sigur) și clientul `fetch` centralizat (`frontend/src/api/client.js`).
- Implementează paginile responsive cu stări clare de loading, empty și eroare:
  - `Login` / `Register` (cu afișare clară a erorilor de validare și acces rapid la roluri).
  - `Catalog` (căutare, filtrare pe categorie/preț/stoc, ordonare, paginare).
  - `ProductDetail` (detalii, stoc disponibil, adăugare în coș).
  - `Cart & Checkout` (modificare cantități, adresă livrare, trimitere `Idempotency-Key`, confirmare comenzi create).
  - `CustomerOrders` (listă comenzi proprii, vizualizare timeline tranziții `STA`, buton `Anulează comanda` activ doar în stările permise).
- **Verificare:** Fluxul complet de client funcționează în browser împotriva backend-ului populat cu seed.
- **Commit sugerat:** `feat(frontend): implement auth, filterable catalog, cart, checkout, and customer orders UI`

#### Pasul 10: Frontend SPA (Partea 2) — Dashboard Vânzător și Panou Demonstrație `STA`/`EXT`
- Implementează `SellerDashboard`:
  - Gestiune produse proprii (creare, editare preț/stoc, dezactivare).
  - Gestiune comenzi primite cu butoane explicite pentru tranzițiile permise (`Confirmă`, `Împachetează`, `Trimite la Curier / Dispatch`, `Anulează`) și afișarea statusului sincronizării externe (`externalSyncStatus`, `externalAttempts`, `lastExternalError`, `ExternalCallLog`).
- Implementează `SimulatorPanel` (pagină de demonstrație utilă la susținere):
  - Permite activarea din UI a modurilor de eroare ale simulatorului (`NORMAL`, `RATE_LIMIT_429`, `SERVER_ERROR_500`, `TIMEOUT`, `FAIL_FIRST_N`) și declanșarea de webhook-uri (inclusiv `duplicateCount = 3`) pentru a demonstra live pachetele `EXT` și `STA` în fața evaluatorului.
- **Verificare:** Fluxul complet `SELLER` + `SIMULATOR` + `CUSTOMER` funcționează fără erori în consolă.
- **Commit sugerat:** `feat(frontend): add seller order management dashboard and EXT simulator control panel`

#### Pasul 11: Test E2E Automatizat (Playwright) și Testare de Încărcare (Artillery)
- Implementează testul E2E în `e2e/tests/marketplace-flow.spec.js` (acoperind fluxul cap-coadă: autentificare client -> filtrare produs -> coș -> checkout -> autentificare vânzător -> confirmare & împachetare & dispatch -> callback livrare simulator -> verificare status `DELIVERED` în UI).
- Implementează scenariile Artillery în `load-tests/` (`low-load.yml`, `medium-load.yml`, `high-load.yml`) și scriptul de rulare reproductibil.
- Rulează cele 3 niveluri de sarcină pe baza de date seeded (500 produse, 100 comenzi) și completează `docs/capacity.md` cu datele reale (throughput, p50, p95, erori, specificații sistem, capacitate susținută estimată, bottleneck identificat).
- **Verificare:** Testul E2E trece; toate cele 3 niveluri de load test produc rapoarte reproductibile.
- **Commit sugerat:** `test(m3): add Playwright E2E flow and 3-level Artillery load tests with capacity report`

#### Pasul 12: Mod Producție, Revizie Documentație și Pregătire Susținere
- Configurează build-ul de producție al frontend-ului (`vite build`) și servirea statică a `frontend/dist` din `backend` atunci când `NODE_ENV=production` (cu fallback SPA pentru React Router, excluzând `/api/*`).
- Revizuiește și finalizează `README.md` (instalare de la zero, `.env`, `seed`, `dev`, `test`, `coverage`, `e2e`, `load-test`, `build` + `start` în mod producție, conturi demo, scenariu pas-cu-pas de demonstrație).
- Creează structura completă pentru `docs/ai-usage.md` (rezumat unelte AI + secțiunea de completat/verificat de student pentru cazul tehnic individual).
- Verifică checklist-ul final de acceptare (Secțiunea 9).
- **Verificare:** Aplicația pornește curat în mod producție, toate testele trec, toate documentele din `docs/` sunt complete.
- **Commit sugerat:** `chore(release): add production build serving and finalize documentation`

---

## 9. CHECKLIST FINAL DE ACCEPTARE (CONFORM SPECIFICAȚIILOR OFICIALE)

- [ ] Exclusiv JavaScript ESM (`"type": "module"`), **0 fișiere TypeScript**.
- [ ] Node.js + Express + Sequelize + SQLite + React + Vite.
- [ ] Minimum 2 roluri distincte (`CUSTOMER`, `SELLER`, + `ADMIN`) cu autentificare și autorizare reală pe server (inclusiv verificare ownership pe obiecte).
- [ ] Filtrare, ordonare și paginare funcționale pe `/api/products` (și `/api/orders`).
- [ ] Seed reproductibil cu >= 500 produse și >= 100 comenzi.
- [ ] Invariante critice protejate în backend/DB (stoc >= 0 atomic, tranziții legale, idempotență callback & checkout).
- [ ] Pachet `STA`: >= 4 stări (6 implementate), mașină de stări explicită, teste complete, ADR `001`, dovezi în `docs/packages/sta-verification.md`.
- [ ] Pachet `EXT`: simulator cu `429`, `500`, `timeout`, `duplicate callback`, client cu timeout + retry limitat + backoff, deduplicare webhook cu `UNIQUE(eventId)`, teste deterministe, ADR `002`, dovezi în `docs/packages/ext-verification.md`.
- [ ] Raport coverage backend: `>= 70%` statements, `>= 60%` branches + analiză lacune în `docs/testing.md`.
- [ ] Cel puțin 1 test E2E automatizat (Playwright).
- [ ] Test de încărcare pe 3 niveluri + analiză capacitate și bottleneck în `docs/capacity.md`.
- [ ] Documentație completă în `docs/` (`requirements.md`, `architecture.md`, `adr/`, `packages/`, `testing.md`, `capacity.md`, `ai-usage.md`), `.env.example` fără secrete, lockfile, `README.md` complet și rulare în mod producție.