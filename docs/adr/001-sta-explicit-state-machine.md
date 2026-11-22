# ADR 001: Mașină de stări explicită pentru ciclul de viață al comenzilor (`STA`)

- **Status:** Draft / Proposed (M1 — urmează implementarea și validarea experimentală în Pasul 6)
- **Pachet arhitectural:** `STA` — Fluxuri cu stări
- **Data:** 2026-11-22

---

## 1. Context și problemă

În platforma Marketplace, o comandă traversează mai multe etape de procesare și livrare, inițiate de actori diferiți (`CUSTOMER`, `SELLER`, `ADMIN`, `EXTERNAL_SYSTEM`):

`CREATED` -> `CONFIRMED` -> `PACKED` -> `SHIPPED` -> `DELIVERED` (+ starea terminală `CANCELLED`).

Cerințele critice pentru acest flux sunt:
1. Nicio comandă nu poate fi actualizată arbitrar (ex. prin `PUT /api/orders/:id { status: "DELIVERED" }`).
2. Fiecare tranziție are **actori autorizați strict definiți** (inclusiv ownership pe `customerId` / `sellerId`) și **precondiții (guards)** — de ex. trecerea în `SHIPPED` necesită `externalShipmentId !== null`.
3. Tranziția către `CANCELLED` declanșează un **efect secundar critic** (restaurarea atomică a stocului) care nu trebuie executat niciodată de două ori, nici la retrimiteri de rețea (`Idempotency-Key`), nici la cereri duplicate.
4. Fiecare tranziție validă trebuie auditată persistat (`OrderStateTransition`) pentru trasabilitate și verificare.

Problema arhitecturală: **Cum structurăm regulile de tranziție astfel încât logica să fie clară, auditabilă, imposibil de ocolit și testabilă izolat (unitar + integrare)?**

---

## 2. Alternative analizate

### Alternativa A: Mașină de stări explicită custom, declarativă (modul pur de domeniu) — **ALEASĂ**
Definirea unui modul pur `backend/src/domain/orderStateMachine.js` care exportă:
- lista stărilor valide (`ORDER_STATES`),
- tabelul/graful declarativ al tranzițiilor permise (`TRANSITIONS`), cu lista rolurilor autorizate și funcții pure de gardă (`guards`),
- funcția de evaluare `evaluateTransition({ order, toState, actor, itemsCount })` care întoarce fie permisiunea + efectele de aplicat, fie un cod semantic precis (`INVALID_STATE_TRANSITION` -> `409`, `ALREADY_IN_STATE` -> `409`, `FORBIDDEN_TRANSITION_ACTOR` -> `403`, `TRANSITION_PRECONDITION_FAILED` -> `422`).

- **Avantaje:**
  - Sursă unică de adevăr pentru toate regulile fluxului (atât pentru apelurile HTTP ale utilizatorilor, cât și pentru webhook-urile `EXTERNAL_SYSTEM`).
  - Zero dependențe externe suplimentare; 100% JavaScript ESM pur, ușor de inspectat și explicat la susținere.
  - Testabilitate unitară instantanee (fără DB sau Express) pentru toate combinațiile de `(fromState, toState, actorRole, ownership, guard)`.
  - Separare curată între regulile de domeniu (pure) și persistența tranzacțională din `orderService.js`.
- **Dezavantaje:**
  - Nu oferă out-of-the-box stări ierarhice/paralele sau vizualizator grafic automat (care nu sunt necesare pentru un graf liniar de 6 stări).

### Alternativa B: Condiții `if/else` dispersate în controllere și servicii — **RESPINSĂ**
Verificarea stării curente și a rolurilor direct în fiecare handler (`cancelOrder`, `confirmOrder`, `packOrder`, `handleDeliveryWebhook`).

- **Avantaje:**
  - Rapid de scris inițial pentru 2–3 rute simple.
- **Dezavantaje:**
  - Duplicare masivă a regulilor între rutele REST și handler-ul de webhook `EXT`.
  - Risc ridicat de omisiuni de securitate sau tranziții ilegale (ex. webhook-ul suprascrie o comandă `CANCELLED` în `SHIPPED`).
  - Greu de testat exhaustiv și dificil de demonstrat acoperirea tuturor combinațiilor.

### Alternativa C: Bibliotecă externă de statecharts (ex. `XState`) — **RESPINSĂ**
Modelarea comenzii folosind o mașină `XState` instanțiată pe server la fiecare cerere HTTP.

- **Avantaje:**
  - Standard matur pentru fluxuri foarte complexe (stări imbricate, paralele, actori persistenți în memorie).
- **Dezavantaje:**
  - Overhead conceptual și de configurare disproporționat pentru un API REST stateless cu 6 stări persistate în SQLite.
  - Integrarea cu tranzacții Sequelize și coduri HTTP distincte (`403` vs `409` vs `422`) devine mai opacă decât un modul de domeniu explicit.
  - Încalcă principiul din specificația generală: *"Nu se acordă puncte doar pentru introducerea unor tehnologii complicate."*

### Sinteză comparativă

| Criteriu | A. State Machine explicită custom | B. Condiții dispersate | C. XState |
| :--- | :--- | :--- | :--- |
| Sursă unică de adevăr | Da (tabel declarativ) | Nu | Da |
| Complexitate & lizibilitate | Mică, transparentă | Scăzută inițial, degradează rapid | Ridicată (overhead) |
| Testabilitate unitară | Excelentă (funcții pure) | Slabă (cuplată cu HTTP/DB) | Bună, dar legată de API-ul librăriei |
| Mapare precisă `403`/`409`/`422` | Directă și explicită | Inconsistentă | Necesită strat adaptor suplimentar |
| Potrivire pentru 6 stări stateless | **Optimă** | Inadecvată | Supradimensionată |

---

## 3. Decizia arhitecturală

Se alege **Alternativa A**: implementarea unei mașini de stări explicite în `backend/src/domain/orderStateMachine.js`, invocată obligatoriu de `orderService.transitionOrder()` (atât din `POST /api/orders/:id/transition`, cât și din `POST /api/webhooks/delivery`).

Persistența se face într-o tranzacție Sequelize care:
1. Reîncarcă comanda curentă,
2. Verifică idempotența pe `requestKey` (`Idempotency-Key`),
3. Evaluează tranziția prin `orderStateMachine`,
4. Actualizează `Order.status` (și restaurează atomic stocul dacă `toState === 'CANCELLED'` și `stockRestored === false`),
5. Inserează înregistrarea de audit în `OrderStateTransition`.

---

## 4. Plan de experimentare și verificare (de completat în Pasul 6)

> *Notă M1:* Această secțiune va fi completată cu comenzile exacte, rezultatele rulării testelor și dovezile observate în Pasul 6 (corelat cu `docs/packages/sta-verification.md`).

- **Teste unitare (`backend/tests/unit/orderStateMachine.test.js`):**
  - Toate cele 6 tranziții valide (`CREATED->CONFIRMED`, `CREATED->CANCELLED`, `CONFIRMED->PACKED`, `CONFIRMED->CANCELLED`, `PACKED->SHIPPED`, `SHIPPED->DELIVERED`).
  - Tranziții ilegale (salturi de stare, ieșire din stări terminale `DELIVERED`/`CANCELLED`, retur înapoi) -> `INVALID_STATE_TRANSITION` (`409`).
  - Actori neautorizați și acces cross-owner (`CUSTOMER` pe `PACKED`, `SELLER B` pe comanda lui `SELLER A`) -> `FORBIDDEN_TRANSITION_ACTOR` (`403`).
  - Precondiții neîndeplinite (`PACKED->SHIPPED` fără `externalShipmentId`, anulare când `stockRestored === true`) -> `TRANSITION_PRECONDITION_FAILED` (`422`).
- **Teste de integrare HTTP (`POST /api/orders/:id/transition`):**
  - Verificare persistență `Order.status` și jurnal `OrderStateTransition`.
  - Verificare anulare repetată cu și fără `Idempotency-Key` (stocul este restaurat o singură dată).

---

## 5. Limite și riscuri asumate

1. **Concurență pe aceeași comandă în SQLite:** SQLite serializază scrierile la nivel de fișier (single-writer lock), ceea ce reduce anomaliile de concurență local, dar sub tranzacții concurente intense poate produce erori `SQLITE_BUSY` dacă nu se folosesc tranzacții scurte și update condiționat pe starea curentă (`WHERE id = ? AND status = ?`).
2. **Audit bazat pe aplicație:** Tabelul `OrderStateTransition` este populat de `orderService`; un acces direct la fișierul `.sqlite` din afara API-ului nu ar genera intrări de audit (limită inerentă auditului la nivel de aplicație).
3. **Evolutivitate:** Dacă numărul de stări și sub-stări paralele ar crește semnificativ (ex. fluxuri de retur parțial, rambursare în tranșe), migrarea la un motor de statecharts ar deveni justificată.
