# ADR 002: Integrare externă rezilientă cu serviciul de livrare (`EXT`)

- **Status:** Draft / Proposed (M1 — urmează implementarea și validarea experimentală în Pasul 7)
- **Pachet arhitectural:** `EXT` — Integrare externă rezilientă
- **Data:** 2026-11-22

---

## 1. Context și problemă

În fluxul de livrare, backend-ul Marketplace comunică bidirecțional cu un serviciu extern de curierat (implementat local ca simulator HTTP controlabil în `simulator/`, port `4001`):
1. **Outbound (`Backend -> Simulator`):** Vânzătorul declanșează expedierea comenzii (`POST /api/orders/:id/dispatch`), iar backend-ul apelează `POST /shipments`.
2. **Inbound (`Simulator -> Backend`):** Serviciul extern trimite asincron notificări webhook (`POST /api/webhooks/delivery`) pentru evenimentele `SHIPMENT_CONFIRMED`, `SHIPMENT_DISPATCHED`, `SHIPMENT_DELIVERED`.

În mediile reale, serviciile externe suferă de **latențe mari / timeout-uri**, **erori tranzitorii (`5xx`)**, **limitare de rată (`429 Too Many Requests` + `Retry-After`)** și **livrare at-least-once a webhook-urilor (callback-uri duplicate, secvențiale sau concurente)**.

Problema arhitecturală: **Cum proiectăm integrarea astfel încât backend-ul să nu rămână blocat, să recupereze automat din eșecuri tranzitorii fără a dubla expedierile, să păstreze starea comenzii coerentă la eșec total și să proceseze idempotent callback-urile externe?**

---

## 2. Alternative analizate

### Alternativa A: Client HTTP rezilient în-proces + persistență explicită + webhook HMAC cu deduplicare DB — **ALEASĂ**
- **Outbound (`backend/src/services/deliveryClient.js`):**
  - `fetch` nativ cu `AbortController` pentru timeout strict (`EXTERNAL_TIMEOUT_MS`).
  - Retry limitat (`EXTERNAL_MAX_RETRIES=3`, total max 4 încercări) cu **exponential backoff + jitter**, respectând header-ul `Retry-After` pentru `429`.
  - Clasificare clară a erorilor: retry **doar** pe erori tranzitorii (`429`, `5xx`, timeout, erori de rețea); **0 retry-uri** pe erori permanente `4xx` (`400`, `401`, `403`, `404`).
  - Cheie deterministă `Idempotency-Key: order-dispatch-${order.id}` trimisă la fiecare încercare.
  - Jurnalizarea fiecărei încercări în `ExternalCallLog` și actualizarea explicită pe `Order` (`externalShipmentId`, `externalSyncStatus`, `externalAttempts`, `lastExternalError`).
- **Inbound (`POST /api/webhooks/delivery`):**
  - Autentificare obligatorie prin `X-Webhook-Signature` (`HMAC-SHA256` verificat cu `crypto.timingSafeEqual`).
  - Deduplicare atomică în baza de date prin constrângerea `UNIQUE(eventId)` din tabelul `ExternalCallbackLog`, în aceeași tranzacție Sequelize cu apelul către `orderStateMachine`.

- **Avantaje:**
  - Nu necesită infrastructură suplimentară (fără Redis/RabbitMQ/Docker) — respectă 100% constrângerile proiectului.
  - Garantează atomicitatea deduplicării chiar și la callback-uri duplicate concurente (constrângerea `UNIQUE` din SQLite previne race condition-ul de tip check-then-insert).
  - Observabilitate completă prin `ExternalCallLog` și `ExternalCallbackLog`, ușor de inspectat în teste și în UI.
- **Dezavantaje:**
  - Retry-urile outbound rulează în timpul cererii HTTP `POST /api/orders/:id/dispatch`, ceea ce prelungește timpul de răspuns al endpoint-ului în scenarii cu erori tranzitorii.

### Alternativa B: Apel sincron simplu (`fetch` direct) fără retry/timeout și verificare de duplicate în memorie — **RESPINSĂ**
- **Avantaje:**
  - Implementare minimală (~20 linii de cod).
- **Dezavantaje:**
  - Un serviciu extern blocat poate agăța cererile backend nedefinit (lipsă `AbortController`).
  - Orice eroare tranzitorie `429`/`500` eșuează imediat în fața utilizatorului.
  - Un `Set` în memorie pentru `eventId` se pierde la restart și nu oferă izolare tranzacțională cu update-ul comenzii.

### Alternativa C: Coadă de mesaje persistentă + worker separat (ex. BullMQ/Redis sau Outbox + daemon) — **RESPINSĂ**
- **Avantaje:**
  - Decuplează complet latența retry-urilor de cererea HTTP a vânzătorului și supraviețuiește restart-urilor în timpul backoff-ului.
- **Dezavantaje:**
  - Introduce dependențe operaționale (Redis sau procese worker suplimentare) și intră în zona pachetului `ASY`, depășind necesarul și bugetul de complexitate al pachetului `EXT`.

### Sinteză comparativă

| Criteriu | A. Client rezilient + DB deduplication | B. Apel simplu + Set memorie | C. Coadă externă + Worker |
| :--- | :--- | :--- | :--- |
| Protecție la timeout/hang | Da (`AbortController`) | Nu | Da |
| Recuperare erori tranzitorii | Da (backoff + jitter + `Retry-After`) | Nu | Da |
| Idempotență persistentă la restart | Da (`UNIQUE(eventId)` + `Idempotency-Key`) | Nu | Da |
| Complexitate operațională | Scăzută (doar Node + SQLite) | Minimă | Ridicată (broker + worker) |
| Potrivire pentru `EXT` + constrângeri | **Optimă** | Neconformă | Supradimensionată |

---

## 3. Decizia arhitecturală

Se alege **Alternativa A**:
1. **Starea operației externe separată de starea de business a comenzii:** `Order.externalSyncStatus` (`NOT_SENT`, `PENDING_RETRY`, `DISPATCHED`, `FAILED_PERMANENT`) urmărește integrarea fără a corupe `Order.status`. Dacă toate retry-urile eșuează, `Order.status` rămâne neschimbat (`PACKED`), permițând o reîncercare ulterioară sigură cu aceeași cheie `Idempotency-Key`.
2. **Contract determinist de fault injection în `simulator/`:** Simulatorul suportă configurare globală (`/_control/faults`) și per-request (`X-Fault-Mode`) pentru `RATE_LIMIT_429`, `SERVER_ERROR_500`, `TIMEOUT`, `FAIL_FIRST_N`, `BAD_REQUEST_400`, precum și `trigger-callback` cu `duplicateCount` secvențial și concurent (`Promise.all`).
3. **Deduplicare tranzacțională pe webhook:** Inserarea `eventId` în `ExternalCallbackLog` înainte de aplicarea tranziției în aceeași tranzacție Sequelize garantează execuția exact-o-dată a efectelor de business.

---

## 4. Plan de experimentare și verificare (de completat în Pasul 7)

> *Notă M1:* Rezultatele concrete, latențele și dovezile reproductibile ale celor 6 scenarii obligatorii vor fi documentate în Pasul 7 (corelat cu `docs/packages/ext-verification.md`).

Scenarii deterministe planificate:
1. **`500` persistent:** exact `1 + maxRetries` încercări în `ExternalCallLog`, `externalSyncStatus === 'FAILED_PERMANENT'`, `Order.status` nemodificat, răspuns `502`.
2. **`429` cu `Retry-After` + `FAIL_FIRST_N = 2`:** respectă backoff-ul, recuperează la încercarea 3, salvează `externalShipmentId` și `DISPATCHED`.
3. **`TIMEOUT`:** `AbortController` întrerupe cererea la `EXTERNAL_TIMEOUT_MS`, retry limitat, eșec controlat (`504`) sau recuperare.
4. **`400 Bad Request`:** `0` retry-uri (`attemptNumber === 1`), dovedind că erorile permanente `4xx` nu sunt reîncercate.
5. **Callback duplicat (3 secvențiale + 5 concurente cu același `eventId`):** exact 1 înregistrare `OrderStateTransition` pentru tranziția respectivă; duplicatele răspund `200 OK` cu `duplicate_ignored`.
6. **Semnătură HMAC invalidă / lipsă:** `401 Unauthorized`, zero efecte în DB.

---

## 5. Limite și riscuri asumate

1. **Retry sincron pe cererea HTTP:** În timpul retry-urilor cu backoff, conexiunea HTTP a clientului către `POST /api/orders/:id/dispatch` rămâne deschisă; pentru a evita timeout-ul browserului, numărul de retry-uri (`3`) și plafonul de backoff sunt păstrate moderate.
2. **Limite SQLite sub concurență masivă:** La sosirea simultană a 5+ webhook-uri concurente cu același `eventId`, SQLite serializază tranzacțiile pe baza de fișier; este necesară configurarea unui `busy_timeout` adecvat și tratarea corectă a `SequelizeUniqueConstraintError` (și `SQLITE_BUSY` dacă apare sub sarcină extremă).
3. **Fără circuit breaker global:** Dacă simulatorul este căzut pentru o perioadă lungă, fiecare cerere nouă de `dispatch` va executa ciclul propriu de retry până la timeout; un circuit breaker ar fi următorul pas într-un mediu de producție cu trafic mare.
4. **Protecție la replay pe fereastră de timp:** Autenticarea HMAC și deduplicarea pe `eventId` previn reluarea aceluiași eveniment; într-un sistem real de producție s-ar adăuga și validarea unui header `X-Webhook-Timestamp` cu fereastră de toleranță (ex. 5 minute).
