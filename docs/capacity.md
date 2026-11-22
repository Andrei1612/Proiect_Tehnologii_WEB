# Planificarea Capacității și Modelul de Sarcină

> **Proiect:** Marketplace și gestiunea comenzilor (Tema 6 | Pachete: `STA` + `EXT`)  
> **Etapă:** M1 — Model de sarcină și ipoteze inițiale (măsurătorile reale și analiza post-experiment se completează în **Pasul 11**)  
> **Instrument de load testing:** Artillery (`load-tests/low-load.yml`, `medium-load.yml`, `high-load.yml`)

---

## 1. Obiective de performanță (Service Level Objectives — SLO)

Pentru evaluarea capacității susținute pe mediul local de testare, stabilim următoarele obiective de serviciu:
- **Latență p95:** `< 300 ms` pe mixul realist de operații.
- **Latență p50 (mediană):** `< 100 ms`.
- **Rata erorilor (HTTP `5xx`, timeout-uri, `ECONNRESET`):** `< 1%`.
- **Integritate date:** Zero încălcări ale invariantelor (`stock >= 0`, fără comenzi corupte) pe durata testelor.

> *Notă metodologică (conform specificației generale):* Valorile absolute de RPS nu se compară între calculatoare diferite; concluziile privind capacitatea susținută și blocajele sunt raportate strict la mediul hardware/software documentat în Secțiunea 4.

---

## 2. Volumul de date (Dataset determinist)

Toate testele de încărcare rulează împotriva bazei de date SQLite populate prin `npm run seed` (PRNG determinist, seed fix `42`):

| Entitate | Volum minim seeded | Rol în profilul de sarcină |
| :--- | :---: | :--- |
| `Category` | 10 | Filtrare pe categorie în catalog |
| `User` | 31 (1 Admin, 10 Sellers, 20 Customers) | Autentificare și izolare pe roluri |
| `Product` | >= 500 | Interogări de citire, filtrare, sortare, paginare și scădere stoc |
| `Order` | >= 100 | Interogări autentificate ale istoricului comenzilor |
| `OrderItem` & `OrderStateTransition` | ~200–400 rânduri | Eager loading la vizualizarea detaliilor unei comenzi |

---

## 3. Modelul de sarcină și cele 3 niveluri de testare

### 3.1 Mixul realist de operații

| Pondering | Operație | Endpoint-uri exercitate | Tip sarcină |
| :---: | :--- | :--- | :--- |
| **70%** | Navigare, căutare, filtrare și paginare catalog | `GET /api/products?categoryId=...&inStock=true&sortBy=priceCents&page=...&limit=20`, `GET /api/categories` | Citire intensivă (indexuri SQLite) |
| **20%** | Vizualizare detalii produs și listare comenzi autentificate | `GET /api/products/:id`, `GET /api/orders?page=1&limit=10` (cu JWT pre-obținut) | Citire + autorizare JWT + join-uri |
| **10%** | Operații de scriere (coș și checkout) | `POST /api/cart/items`, `POST /api/orders/checkout` (cu `Idempotency-Key` unic) | Scriere tranzacțională SQLite (lock-uri + update stoc) |

> *Notă privind autentificarea în testul de încărcare:* Pentru a măsura realist API-ul Marketplace fără a satura artificial CPU-ul exclusiv cu `bcryptjs`, utilizatorii virtuali pot reutiliza token-uri JWT obținute pentru conturile seeded (sau rula un sub-scenariu separat pentru login). Impactul `bcryptjs` la login va fi discutat explicit în analiza blocajelor.

### 3.2 Nivelurile de încărcare planificate (Artillery)

| Nivel | Fișier scenariu | Rată sosire (`arrivalRate`) | Durată | Total cereri estimate | Scop |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Low** | `load-tests/low-load.yml` | `5 req/s` | `30s` | ~150 scenarii | Linie de bază (baseline), latență fără contenție |
| **Medium** | `load-tests/medium-load.yml` | `20 req/s` | `30s` | ~600 scenarii | Sarcină nominală de producție locală |
| **High** | `load-tests/high-load.yml` | `50 req/s` | `30s` | ~1500 scenarii | Test de presiune și identificare prag de degradare / bottleneck |

---

## 4. Mediul de testare și rezultate (de completat în Pasul 11)

### 4.1 Specificații mediu de rulare
- **Sistem de operare:** *De completat la rularea din Pasul 11 (ex. Windows 11 x64)*
- **CPU / nuclee:** *De completat la rularea din Pasul 11*
- **Memorie RAM:** *De completat la rularea din Pasul 11*
- **Versiune Node.js:** `v24.14.0` (verificat în M1)
- **Mod rulare server:** `NODE_ENV=production` / local fără watcher (`node src/server.js`)
- **Bază de date:** SQLite locală populată prin `npm run seed`

### 4.2 Tabel rezultate măsurate (placeholder M1 -> completat în Pasul 11)

| Nivel | Rata țintă | Throughput obținut (RPS) | Latență `p50` (ms) | Latență `p95` (ms) | Rata erorilor (%) | CPU / RAM observat | Respectă SLO? |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Low** | 5 req/s | *Pending (Pasul 11)* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* |
| **Medium** | 20 req/s | *Pending (Pasul 11)* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* |
| **High** | 50 req/s | *Pending (Pasul 11)* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* |

---

## 5. Ipoteze privind capacitatea susținută și blocajele probabile (Bottlenecks)

Încă din faza de design M1, identificăm următoarele blocaje probabile care vor fi validate prin măsurătorile din Pasul 11:

1. **Contenția la scriere în SQLite (Single-Writer Lock):**
   - SQLite permite citiri concurente, dar serializază tranzacțiile de scriere (`BEGIN IMMEDIATE` / `INSERT` / `UPDATE`). Pe nivelul High (`50 req/s` cu 10% scrieri de coș/checkout), cozile de așteptare pe lock-ul DB pot ridica brusc `p95` sau pot produce `SQLITE_BUSY` dacă modul WAL (`PRAGMA journal_mode = WAL`) sau `busy_timeout` nu sunt configurate optim.
2. **Hashing parole cu `bcryptjs` (CPU-bound pe event loop-ul Node.js):**
   - `bcryptjs` cu cost `>= 10` consumă ~50–100 ms CPU per apel; un val mare de cereri simultane pe `POST /api/auth/login` blochează/încetinește event loop-ul single-threaded al Node.js, afectând latența rutelor de citire.
3. **Filtrarea catalogului (`LIKE '%search%'`) și serializarea JSON:**
   - Filtrele pe coloane indexate (`categoryId`, `priceCents`, `isActive`) folosesc indexuri B-Tree, dar căutarea parțială `LIKE '%term%'` declanșează scanare de tabel pe cele 500+ produse, ceea ce crește timpul de răspuns la trafic mare.

> *În Pasul 11*, această secțiune va fi actualizată cu **estimarea concretă a capacității susținute** (cel mai mare nivel care îndeplinește `p95 < 300ms` și erori `< 1%`) și cu **identificarea dovezilor pentru blocajul dominant observat**.
