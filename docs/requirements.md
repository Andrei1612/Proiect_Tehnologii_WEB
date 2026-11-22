# Cerințe Funcționale, Fluxuri și Invariante — Marketplace și Gestiunea Comenzilor

> **Proiect:** Tema 6 — Marketplace și gestiunea comenzilor  
> **Pachete arhitecturale obligatorii:** `STA` (Fluxuri cu stări) + `EXT` (Integrare externă rezilientă)  
> **Etapă:** M1 — Analiză și Design  
> **Sursă de adevăr:** [SPEC.md](../SPEC.md), [00-general-specifications.md](./reference/00-general-specifications.md), [01-architectural-challenges.md](./reference/01-architectural-challenges.md), [tema6-marketplace-orders.md](./reference/tema6-marketplace-orders.md)

---

## 1. Obiectivul sistemului

Aplicația oferă o platformă web full-stack de tip **Marketplace multi-vânzător** în care:
- **Vânzătorii (`SELLER`)** publică și administrează produse proprii (preț, stoc, disponibilitate) și procesează comenzile primite pentru produsele lor.
- **Clienții (`CUSTOMER`)** explorează catalogul prin filtrare, căutare, ordonare și paginare, administrează un coș persistent și plasează comenzi (fără plăți reale).
- **Administratorul (`ADMIN`)** gestionează categoriile și are vizibilitate globală asupra comenzilor și produselor pentru suport/operare.
- **Serviciul extern de livrare simulat (`EXTERNAL_SYSTEM`)** primește cereri de expediere de la backend, injectează controlat erori realiste (`429`, `500`, `TIMEOUT`, callback-uri duplicate) și notifică asincron backend-ul prin webhook-uri semnate HMAC privind evoluția livrării.

---

## 2. Actori și matrice de permisiuni

Sistemul definește **3 roluri autentificate de utilizator** (`CUSTOMER`, `SELLER`, `ADMIN`) plus **actorul tehnic extern** (`EXTERNAL_SYSTEM`, autentificat prin semnătură HMAC-SHA256 la webhook).

| Actor | Autentificare | Operații permise | Restricții explicite (Object-Level & RBAC) |
| :--- | :--- | :--- | :--- |
| **Vizitator neautentificat** | Fără token | Înregistrare (`CUSTOMER`/`SELLER`), login, vizualizare categorii, listare/filtrare/detalii produse active, `/api/health` | Nu poate accesa coșul, nu poate plasa sau vedea comenzi, nu poate crea/edita produse. |
| **`CUSTOMER`** | JWT Bearer | Vizualizare catalog, CRUD propriul coș, plasare comandă (`checkout`), vizualizare **doar** propriile comenzi, anulare comandă proprie din `CREATED` sau `CONFIRMED` | Nu poate crea/edita/șterge produse; nu poate vedea sau modifica comenzile altor clienți (`403`); nu poate trece o comandă în `CONFIRMED`, `PACKED`, `SHIPPED`, `DELIVERED`; nu poate declanșa `dispatch`. |
| **`SELLER`** | JWT Bearer | CRUD categorii (creare), CRUD **doar** pe propriile produse (`product.sellerId === user.id`), vizualizare **doar** comenzile primite (`order.sellerId === user.id`), tranziții `CREATED -> CONFIRMED`, `CONFIRMED -> PACKED`, `PACKED -> SHIPPED`, anulare din `CREATED`/`CONFIRMED`, inițiere `dispatch` către simulator | Nu poate edita/șterge produsele altui vânzător (`403`); nu poate accesa/modifica comenzile altui vânzător (`403`); nu poate marca direct comanda `DELIVERED` (rezervat `EXTERNAL_SYSTEM`/`ADMIN`); nu folosește fluxul de coș/checkout de client. |
| **`ADMIN`** | JWT Bearer | Vizualizare globală produse și comenzi, creare categorii, editare/dezactivare produse, intervenție administrativă pe tranzițiile permise de mașina de stări și `dispatch` | Nu poate ocoli mașina de stări (tranzițiile ilegale precum `CREATED -> DELIVERED` sau `DELIVERED -> CANCELLED` sunt respinse cu `409` chiar și pentru `ADMIN`). |
| **`EXTERNAL_SYSTEM`** | Header `X-Webhook-Signature` (HMAC-SHA256) | Trimitere webhook-uri `POST /api/webhooks/delivery` pentru tranzițiile `CREATED -> CONFIRMED`, `PACKED -> SHIPPED`, `SHIPPED -> DELIVERED` | Webhook-urile fără semnătură validă sunt respinse cu `401`; evenimentele duplicate (`eventId` existent) sunt ignorate idempotent; nu poate aplica tranziții ilegale (ex. pe o comandă deja `CANCELLED`). |

---

## 3. Fluxuri utilizator și criterii de acceptare (Given / When / Then)

### Fluxul 1: Explorare catalog, gestionare coș și checkout atomic (`CUSTOMER`)

**Descriere:** Un client autentificat caută și filtrează produse disponibile, le adaugă în coș și plasează comanda. Dacă în coș sunt produse de la mai mulți vânzători, backend-ul grupează atomic articolele per `sellerId` și creează câte o comandă distinctă per vânzător în aceeași tranzacție.

**Criterii de acceptare:**
1. **Filtrare, ordonare și paginare catalog:**
   - **Given** baza de date conține cel puțin 500 de produse active din 10 categorii,
   - **When** un utilizator trimite `GET /api/products?categoryId=2&minPrice=5000&maxPrice=25000&inStock=true&sortBy=priceCents&sortOrder=asc&page=1&limit=20`,
   - **Then** serverul răspunde `200 OK` cu maxim 20 produse care respectă toate filtrele, ordonate crescător după `priceCents`, și obiectul `meta: { total, page, limit, totalPages }`.
2. **Checkout reușit cu rezervare atomică de stoc:**
   - **Given** un `CUSTOMER` are în coș 2 bucăți din Produsul A (stoc inițial `5`, Seller 1) și 1 bucată din Produsul B (stoc inițial `3`, Seller 2),
   - **When** trimite `POST /api/orders/checkout` cu `{ shippingAddress }` și header `Idempotency-Key: chk-001`,
   - **Then** serverul răspunde `201 Created` cu 2 comenzi (una pentru Seller 1, una pentru Seller 2), stocurile devin `3` respectiv `2`, coșul clientului este golit, ambele comenzi au starea `CREATED` și câte o intrare inițială (`null -> CREATED`) în `OrderStateTransition`.
3. **Rollback la stoc insuficient:**
   - **Given** Produsul A are stoc `1`, iar clientul încearcă checkout pentru `2` bucăți din Produsul A și `1` bucată din Produsul B (stoc `10`),
   - **When** trimite `POST /api/orders/checkout`,
   - **Then** serverul răspunde `409 Conflict`, nicio comandă nu este creată, iar stocul Produsului B rămâne neschimbat (`10`) datorită rollback-ului tranzacțional.
4. **Checkout idempotent la retrimitere:**
   - **Given** un checkout cu `Idempotency-Key: chk-001` a reușit deja,
   - **When** clientul retrimite exact aceeași cerere cu același `Idempotency-Key: chk-001`,
   - **Then** serverul returnează comenzile deja create fără a crea duplicate și fără a scădea din nou stocul.

---

### Fluxul 2: Administrarea produselor de către vânzător (`SELLER`)

**Descriere:** Un vânzător autentificat își adaugă produse noi, actualizează prețul/stocul și dezactivează produse, fără a putea modifica resursele altor vânzători.

**Criterii de acceptare:**
1. **Creare produs valid:**
   - **Given** un utilizator autentificat cu rol `SELLER` și o categorie validă existentă,
   - **When** trimite `POST /api/products` cu `{ categoryId, title, description, priceCents: 14900, stock: 25 }`,
   - **Then** serverul răspunde `201 Created`, asociază automat `sellerId = req.user.id` și persistă produsul.
2. **Validare strictă a datelor de intrare:**
   - **Given** un `SELLER` autentificat,
   - **When** trimite `POST /api/products` cu `priceCents <= 0` sau `stock < 0`,
   - **Then** serverul răspunde `400 Bad Request` cu formatul standard `{ error: { code: "VALIDATION_ERROR", message, details } }` și nu inserează nimic în DB.
3. **Protecție ownership (anti-IDOR):**
   - **Given** Produsul P aparține lui `SELLER A`,
   - **When** `SELLER B` trimite `PATCH /api/products/:id` sau `DELETE /api/products/:id` pentru Produsul P,
   - **Then** serverul răspunde `403 Forbidden` și produsul rămâne nemodificat.
4. **Soft delete pentru produse aflate în comenzi istorice:**
   - **Given** Produsul P al lui `SELLER A` apare în cel puțin un `OrderItem`,
   - **When** `SELLER A` trimite `DELETE /api/products/:id`,
   - **Then** produsul este marcat `isActive = false` (nu este șters fizic pentru a păstra integritatea referențială a comenzilor istorice) și nu mai apare în catalogul public implicit.

---

### Fluxul 3: Ciclul de viață al comenzii și integritatea stărilor (`STA`)

**Descriere:** Comenzile parcurg exclusiv graful de stări definit în `orderStateMachine.js`:
`CREATED -> CONFIRMED -> PACKED -> SHIPPED -> DELIVERED`, plus ramura de anulare `CREATED -> CANCELLED` și `CONFIRMED -> CANCELLED`.

**Criterii de acceptare:**
1. **Tranziții valide și jurnalizare audit:**
   - **Given** o comandă în starea `CREATED` aparținând lui `SELLER A`,
   - **When** `SELLER A` apelează `POST /api/orders/:id/transition` cu `{ toState: "CONFIRMED" }` și apoi `{ toState: "PACKED" }`,
   - **Then** fiecare cerere răspunde `200 OK`, starea comenzii devine `CONFIRMED` apoi `PACKED`, iar tabelul `OrderStateTransition` conține tranzițiile cu `fromState`, `toState`, `actorId`, `actorRole` și timestamp.
2. **Respingere tranziție ilegală:**
   - **Given** o comandă în starea `CREATED` (sau deja `SHIPPED` / `DELIVERED` / `CANCELLED`),
   - **When** orice actor încearcă `CREATED -> DELIVERED` sau `SHIPPED -> CANCELLED` sau `CANCELLED -> CONFIRMED`,
   - **Then** serverul răspunde `409 Conflict` cu codul `INVALID_STATE_TRANSITION` (incluzând `from`, `to`, `allowedNextStates`), iar starea din DB rămâne nemodificată.
3. **Respingere actor neautorizat:**
   - **Given** o comandă în starea `CONFIRMED` a lui `CUSTOMER 1` și `SELLER A`,
   - **When** `CUSTOMER 1` sau `SELLER B` încearcă `POST /api/orders/:id/transition` cu `{ toState: "PACKED" }`,
   - **Then** serverul răspunde `403 Forbidden` cu codul `FORBIDDEN_TRANSITION_ACTOR`.
4. **Respingere precondiție (guard) neîndeplinită:**
   - **Given** o comandă în starea `PACKED` care nu are încă `externalShipmentId` (`null`),
   - **When** `SELLER A` încearcă `PACKED -> SHIPPED`,
   - **Then** serverul răspunde `422 Unprocessable Entity` cu codul `TRANSITION_PRECONDITION_FAILED`.
5. **Anulare cu restaurare atomică a stocului și protecție la apeluri repetate:**
   - **Given** o comandă în `CREATED` (sau `CONFIRMED`) pentru 3 bucăți dintr-un produs (stoc curent `7`, `stockRestored = false`),
   - **When** clientul proprietar apelează `POST /api/orders/:id/transition` cu `{ toState: "CANCELLED" }` și header `Idempotency-Key: cancel-1` de două ori consecutiv,
   - **Then** prima cerere trece comanda în `CANCELLED`, restaurează stocul la `10` și setează `stockRestored = true`; a doua cerere cu același `Idempotency-Key` răspunde `200 OK` cu `{ order, idempotent: true }` și **nu** mai incrementează stocul (rămâne `10`). O nouă cerere fără aceeași cheie către `CANCELLED` răspunde `409 Conflict` (`ALREADY_IN_STATE`), iar stocul rămâne `10`.

---

### Fluxul 4: Expediere rezilientă și procesare webhook idempotentă (`EXT`)

**Descriere:** Vânzătorul trimite comanda împachetată (`PACKED`) către serviciul extern simulat (`POST /api/orders/:id/dispatch`), iar simulatorul confirmă ulterior expedierea/livrarea prin webhook-uri semnate HMAC către `POST /api/webhooks/delivery`.

**Criterii de acceptare:**
1. **Recuperare automată la erori tranzitorii (`429`, `500`, `TIMEOUT`):**
   - **Given** simulatorul este configurat în modul `FAIL_FIRST_N` (`N = 2`, cu `429` + header `Retry-After` sau `500`) și o comandă aparținând lui `SELLER A`,
   - **When** `SELLER A` apelează `POST /api/orders/:id/dispatch`,
   - **Then** `deliveryClient` trimite `Idempotency-Key: order-dispatch-${order.id}`, reîncearcă cu exponential backoff + jitter (respectând `Retry-After`), reușește la încercarea 3, salvează toate cele 3 încercări în `ExternalCallLog`, persistă `externalShipmentId` și `externalSyncStatus = "DISPATCHED"`.
2. **Eșec controlat fără coruperea stării comenzii:**
   - **Given** simulatorul răspunde persistent `500` sau `TIMEOUT` peste `EXTERNAL_TIMEOUT_MS`,
   - **When** `SELLER A` apelează `POST /api/orders/:id/dispatch`,
   - **Then** clientul oprește încercările după `EXTERNAL_MAX_RETRIES` (total 4 încercări), înregistrează toate încercările în `ExternalCallLog`, setează `externalSyncStatus = "FAILED_PERMANENT"`, păstrează neschimbată starea comenzii (`order.status` nu devine `SHIPPED`) și returnează `502 Bad Gateway` sau `504 Gateway Timeout`.
3. **Fără retry pe erori permanente `4xx`:**
   - **Given** simulatorul răspunde `400 Bad Request`,
   - **When** se execută `dispatch`,
   - **Then** clientul efectuează exact `1` încercare (`0` retry-uri) și loghează `errorType = "CLIENT_4XX"`.
4. **Deduplicare strictă a callback-urilor externe (secvențial și concurent):**
   - **Given** o comandă în starea `SHIPPED` cu `externalShipmentId` valid,
   - **When** simulatorul trimite `5` webhook-uri (secvențial sau concurent via `Promise.all`) către `POST /api/webhooks/delivery` cu semnătură HMAC validă și **același `eventId`**, cu `eventType: "SHIPMENT_DELIVERED"`,
   - **Then** exact 1 callback aplică tranziția `SHIPPED -> DELIVERED` (`outcome = "APPLIED"` în `ExternalCallbackLog`), celelalte răspund `200 OK` cu `{ status: "duplicate_ignored", eventId }`, iar `OrderStateTransition` conține exact 1 înregistrare pentru `SHIPPED -> DELIVERED`.
5. **Respingere webhook nesemnat sau cu semnătură invalidă:**
   - **Given** o cerere `POST /api/webhooks/delivery` fără `X-Webhook-Signature` sau cu HMAC incorect,
   - **When** ajunge la backend,
   - **Then** serverul răspunde `401 Unauthorized` înainte de orice modificare în baza de date.

---

### Fluxul 5: Securitate, autentificare și izolare pe roluri (Criterii negative)

**Criterii de acceptare:**
1. **Given** un client neautentificat, **When** accesează `GET /api/orders`, `GET /api/cart` sau `POST /api/products`, **Then** primește `401 Unauthorized`.
2. **Given** un utilizator autentificat ca `CUSTOMER`, **When** apelează `GET /api/orders/:otherCustomerOrderId` sau `POST /api/products`, **Then** primește `403 Forbidden`.
3. **Given** orice endpoint din API (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/orders`), **When** returnează date despre utilizatori, **Then** câmpul `passwordHash` nu apare niciodată în răspunsul HTTP sau în loguri.

---

## 4. Invariante critice de business (impuse în Backend și DB)

Nicio invariantă nu se bazează exclusiv pe validări din interfața React; toate sunt garantate la granița Backend + SQLite:

| # | Invariantă critică | Mecanism de impunere Backend / DB | Răspuns la încălcare |
| :---: | :--- | :--- | :--- |
| **I1** | **Stoc non-negativ și rezervare atomică** | Constrângere SQL `CHECK(stock >= 0)` pe `Product` + tranzacție Sequelize cu update condiționat atomic `UPDATE Products SET stock = stock - qty WHERE id = ? AND stock >= qty`. | `409 Conflict` + rollback complet al tranzacției |
| **I2** | **Integritatea tranzițiilor de stare (`STA`)** | Nu există endpoint de update arbitrar pentru `Order.status`. Toate schimbările trec exclusiv prin `orderStateMachine.js` + constrângere SQL `CHECK(status IN (...))` + audit în `OrderStateTransition`. | `409 Conflict` (`INVALID_STATE_TRANSITION`), `403` (`FORBIDDEN_TRANSITION_ACTOR`), `422` (`TRANSITION_PRECONDITION_FAILED`) |
| **I3** | **Idempotență la checkout și la anulare (fără dublare comandă sau stoc)** | Coloană `UNIQUE(idempotencyKey)` pe `Order` + flag boolean `stockRestored` verificat și actualizat atomic în aceeași tranzacție + `requestKey` în `OrderStateTransition`. | `200 OK` (răspuns idempotent, zero efecte secundare duble) sau `409` (`ALREADY_IN_STATE`) |
| **I4** | **Idempotență la callback-uri externe (`EXT`)** | Constrângere SQL `UNIQUE(eventId)` în `ExternalCallbackLog` inserată în aceeași tranzacție Sequelize cu tranziția de stare. | `200 OK` (`duplicate_ignored`), fără dublarea confirmării/expedierii/livrării |
| **I5** | **Izolare pe rol și proprietar (Object-Level Authorization)** | Middleware `authenticate` + `authorizeRoles` + verificări explicite `product.sellerId === req.user.id`, `order.customerId === req.user.id`, `order.sellerId === req.user.id` în servicii. | `401 Unauthorized` / `403 Forbidden` |

---

## 5. Cerințe non-funcționale și constrângeri de livrare

1. **Stivă tehnologică strictă:** Exclusiv JavaScript cu module ECMAScript (`"type": "module"`), fără TypeScript; Backend Node.js LTS + Express + Sequelize + SQLite (`PRAGMA foreign_keys = ON`); Frontend React + Vite + React Router.
2. **Volum minim de date reproductibil (seed):** 10 categorii, 31 utilizatori (1 Admin, 10 Sellers, 20 Customers), >= 500 produse, >= 100 comenzi în toate stările valide cu istoric `OrderStateTransition` coerent.
3. **Calitate și testare:** Praguri backend `>= 70%` statement coverage și `>= 60%` branch coverage (Vitest + V8), teste negative de validare și securitate, teste deterministe pentru `STA` și `EXT`, plus cel puțin 1 test E2E automatizat (Playwright).
4. **Performanță și capacitate:** Test de încărcare reproductibil (Artillery) pe 3 niveluri (Low/Medium/High) pe DB seeded, cu obiectiv orientativ `p95 < 300ms` și rata erorilor `< 1%`.
5. **Zero costuri externe:** Simulator local HTTP în `simulator/` (fără servicii cloud plătite și fără Docker obligatoriu).
