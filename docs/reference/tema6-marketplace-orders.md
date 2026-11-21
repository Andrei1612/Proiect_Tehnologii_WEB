> An universitar / Academic year: **2026–2027**  
> Disciplina / Course: **Tehnologii Web / Web Technologies**  
> Statut / Status: **Draft v2.0 — pentru revizuire / for review**

---

# Marketplace și gestiunea comenzilor — RO

**Pachete obligatorii:** `EXT` \+ `STA`  
**Fișă comună:** [`00-general-specifications.md`](http://00-general-specifications.md)  
**Definiții pachete:** [`01-architectural-challenges.md`](http://01-architectural-challenges.md)

## 1\. Obiectiv

Vânzătorii publică produse, iar clienții comandă printr-un serviciu de furnizare/livrare simulat.

## 2\. Funcționalitate minimă

Produse, categorii, vânzători, clienți, coș, comenzi, stoc și stare livrare; fără plăți reale.

## 3\. Invariante și reguli critice

O comandă nu poate fi finalizată dintr-o stare ilegală; repetarea unui callback extern nu dublează confirmarea, rezervarea de stoc sau expedierea.

## 4\. Scenariu de volum și sarcină

Cel puțin 500 produse și 100 comenzi seed; simulator extern cu erori 429, 500, timeout și callback duplicat.

## 5\. Verificări obligatorii ale pachetelor

EXT: injecție de eșec și retry limitat; STA: minimum patru stări, teste pentru tranziții interzise și apeluri repetate.

## 6\. Criterii comune de acceptare

- Un student din rolul obișnuit poate efectua fluxurile proprii, dar nu poate exercita operațiile rolului privilegiat.  
- Există teste automate pentru fluxurile critice, permisiuni, intrări invalide și invariante.  
- Cele două pachete sunt implementate, demonstrate și însoțite de rezultate reproductibile; simpla descriere nu este suficientă.  
- Raportul de coverage, testul comun de încărcare și estimarea capacității sunt predate, conform specificației generale.  
- Se livrează seed-uri sintetice, scripturi de test, ADR pentru fiecare pachet și instrucțiuni de demonstrație.

## 7\. Livrare pe etape

**M1:** cazuri de utilizare, actori, reguli, schemă, API, profil de sarcină, plan de teste și alternative pentru pachete.  
**M2:** API, persistență, reguli critice și testele inițiale; primul scenariu de pachet demonstrabil.  
**M3:** SPA integrată, testele complete, ambele pachete validate, rapoarte de acoperire și performanță, ADR și demonstrație.

## 8\. Extensie opțională

Politici de anulare și rambursare simulată (fără transfer de bani).

**Atenție:** extensia nu înlocuiește cerințele obligatorii și nu implică servicii plătite.

---

# Marketplace and Order Management — EN

**Mandatory packages:** `EXT` \+ `STA`  
**Common specification:** [`00-general-specifications.md`](http://00-general-specifications.md)  
**Package definitions:** [`01-architectural-challenges.md`](http://01-architectural-challenges.md)

## 1\. Objective

Sellers list products; customers place orders via a simulated supplier/delivery service.

## 2\. Minimum functionality

Products, categories, sellers, customers, cart, orders, stock, and delivery status; no real payments.

## 3\. Critical invariants and rules

Orders cannot complete through illegal transitions; repeated external callbacks never duplicate confirmation, stock reservation, or shipment.

## 4\. Data and workload scenario

At least 500 seeded products and 100 orders; external simulator with 429, 500, timeout, and duplicate callback.

## 5\. Mandatory package verification

EXT: fault injection and bounded retry; STA: at least four states, forbidden transition and duplicate-call tests.

## 6\. Common acceptance criteria

- Ordinary users can complete their allowed workflows, but cannot perform privileged operations.  
- Automated tests cover critical workflows, permissions, invalid inputs, and invariants.  
- Both packages are implemented and backed by reproducible evidence; a description alone is insufficient.  
- Coverage report, common load test, and capacity estimate are delivered under the general specification.  
- Synthetic seed data, test scripts, an ADR per package, and demonstration instructions are provided.

## 7\. Milestone deliverables

**M1:** use cases, actors, rules, schema, API, workload profile, test plan, and package alternatives.  
**M2:** API, persistence, critical rules, and initial tests; first demonstrable package scenario.  
**M3:** integrated SPA, completed tests, both packages verified, coverage/performance reports, ADRs, and demonstration.

## 8\. Optional extension

Cancellation policies and simulated refunds (no money transfer).

**Note:** extensions never replace mandatory requirements and must not require paid services.