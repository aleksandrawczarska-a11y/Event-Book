---
project: EventBook
version: 1
status: draft
created: 2026-05-29
updated: 2026-07-17
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: EventBook

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Dekoratorzy eventowi pozyskują klientów chaotycznie przez social media; organizatorzy tracą czas na przeszukiwanie profili bez jednego miejsca na discovery i kontakt. EventBook ma być marketplace lead-gen — wizytówka online dekoratora plus wyszukiwarka i formularz zapytania dla klientów anonimowych, wzorowany na modelu Booksy z branży beauty.

## North star

**S-03: Klient wysyła zapytanie, dekorator otrzymuje lead** — najmniejszy pełny flow udowadniający hipotezę produktu (discovery → kontakt → lead w panelu i mailu), zgodny z US-01 i Primary Success Criterion.

> Gwiazda przewodnia — najmniejszy end-to-end slice, którego powodzenie dowodzi, że core produktu działa; umieszczony jak najwcześniej, jak pozwalają zależności, bo reszta ma sens tylko wtedy, gdy ten flow działa.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | domain-schema-foundation | (foundation) minimalny schemat domenowy dla profili, portfolio i zapytań jest dostępny w bazie | — | Business Logic, Access Control | done |
| S-01 | decorator-onboarding | dekorator can register, log in, create a public profile, and add portfolio entries with photos | F-01 | FR-001, FR-002, FR-003 | done |
| S-02 | client-discovery | anonimowy klient can search and filter decorators and view a public profile with portfolio gallery | S-01, F-01 | FR-004, FR-005 | done |
| S-03 | contact-lead-flow | klient can submit a contact inquiry; dekorator receives it by email and sees it in the panel | S-02 | US-01, FR-006, FR-007 | done |
| S-04 | admin-moderation | administrator can manually moderate portfolio content | S-01 | FR-008 | proposed |

## Baseline

What's already in place in the codebase as of `2026-05-29` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present (partial UI) — Astro 6 SSR + React 19, Tailwind, shadcn; strony index, auth, dashboard
- **Backend / API:** partial — SSR + endpointy auth; brak API domenowych pod profile, portfolio, wyszukiwarkę, zapytania
- **Data:** partial — Supabase skonfigurowany; brak migracji, schematu tabel i seedów
- **Auth:** present — Supabase SSR, cookies, middleware chroni `/dashboard`
- **Deploy / infra:** partial — Cloudflare Workers + Wrangler skonfigurowane; CI lint/build; brak auto-deploy w GitHub Actions
- **Observability:** partial — toggle observability w Wranglerze; brak logowania i śledzenia błędów w aplikacji

## Foundations

### F-01: Minimalny schemat domenowy

- **Outcome:** (foundation) tabele i polityki dostępu dla profili dekoratorów, wpisów portfolio i zapytań kontaktowych istnieją i są gotowe do użycia przez pierwsze slice'y pionowe.
- **Change ID:** domain-schema-foundation
- **PRD refs:** Business Logic, Access Control
- **Unlocks:** S-01, S-02, S-03
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Data layer jest partial w baseline — bez tego enablera żaden slice domenowy nie da się zaplanować end-to-end; utrzymany minimalny zakres, żeby nie budować całej warstwy danych z wyprzedzeniem.
- **Status:** done

## Slices

### S-01: Onboarding dekoratora

- **Outcome:** dekorator can register, log in, create and edit a public profile, and add portfolio entries with photos, event description, style, location, and tags.
- **Change ID:** decorator-onboarding
- **PRD refs:** FR-001, FR-002, FR-003
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Jakie minimalne pola profilu wymagamy przy pierwszym publikowaniu? — Owner: user. Block: no.
- **Risk:** Strona podaży musi istnieć przed discovery klienta; auth jest już w baseline, więc slice integruje istniejący auth z nowym schematem z F-01.
- **Status:** done

### S-02: Discovery klienta

- **Outcome:** anonimowy klient can search and filter decorators by city, event type, and decoration style, and view a decorator's public profile and portfolio gallery.
- **Change ID:** client-discovery
- **PRD refs:** FR-004, FR-005
- **Prerequisites:** S-01, F-01
- **Parallel with:** S-04 (po S-01)
- **Blockers:** —
- **Unknowns:**
  - Czy na start wystarczy lista wyników bez paginacji i sortowania zaawansowanego? — Owner: user. Block: no.
- **Risk:** Bez co najmniej jednego dekoratora z portfolio w systemie slice nie da się zweryfikować — plan zakłada dane testowe lub ręczne uzupełnienie po S-01.
- **Status:** done

### S-03: Lead-gen end-to-end

- **Outcome:** klient can submit a contact inquiry with event date, needs, and contact details; dekorator receives the inquiry by email and sees it in the panel; klient sees confirmation without an account.
- **Change ID:** contact-lead-flow
- **PRD refs:** US-01, FR-006, FR-007
- **Prerequisites:** S-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Który kanał email (Supabase, zewnętrzny provider) na MVP? — Owner: user. Block: no.
- **Risk:** To jest gwiazda przewodnia — dowodzi hipotezy marketplace lead-gen; cel speed wymaga trzymania formularza i panelu zapytań w jednym cienkim slice'u bez rozszerzeń poza FR-006/FR-007.
- **Status:** done

### S-04: Moderacja treści

- **Outcome:** administrator can manually moderate portfolio content (approve, reject, or hide entries as defined during planning).
- **Change ID:** admin-moderation
- **PRD refs:** FR-008
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03 (po S-01)
- **Blockers:** —
- **Unknowns:**
  - Moderacja przed czy po publikacji portfolio? — Owner: user. Block: no.
  - Dokładny zakres uprawnień administratora? — Owner: user. Block: no.
- **Risk:** Przesunięty za north star S-03, bo PRD oznacza otwarte pytania moderacji jako nieblokujące planowania; przy presji czasu MVP może wystartować z prostą moderacją post-publikacji.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | domain-schema-foundation | EventBook: minimal domain schema for profiles, portfolio, inquiries | — | done (`implemented`) |
| S-01 | decorator-onboarding | EventBook: decorator registration, profile, and portfolio | — | done (`impl_reviewed`) |
| S-02 | client-discovery | EventBook: client search, filters, and public profile view | — | done (`impl_reviewed`) |
| S-03 | contact-lead-flow | EventBook: contact form and decorator inquiry panel | — | done (`implemented`) |
| S-04 | admin-moderation | EventBook: admin manual portfolio moderation | no | After S-01; can parallel S-02/S-03 |

## Open Roadmap Questions

1. **Jaki jest dokładny zakres uprawnień administratora moderującego treści?** — Owner: user. Block: S-04.
2. **Kiedy następuje moderacja portfolio — przed publikacją, po publikacji, czy oba warianty?** — Owner: user. Block: S-04.
3. **Czy potrzebna jest osobna user story dla flow dekoratora (rejestracja → profil → pierwsze zapytanie)?** — Owner: user. Block: roadmap-wide (informacyjne; ścieżka dekoratora jest w S-01).

## Parked

- **Płatności online** — Why parked: PRD §Non-Goals.
- **Kalendarz rezerwacji** — Why parked: PRD §Non-Goals.
- **Natywna aplikacja mobilna** — Why parked: PRD §Non-Goals; responsywny web w scope.
- **AI (rekomendacje, matchowanie)** — Why parked: PRD §Non-Goals.
- **Komunikator / czat realtime** — Why parked: PRD §Non-Goals.
- **Funkcje social (obserwowanie, komentarze, feed)** — Why parked: PRD §Non-Goals.
- **System ocen i rankingów** — Why parked: PRD §Non-Goals.
- **Automatyczna moderacja treści** — Why parked: PRD §Non-Goals; MVP = moderacja manualna (S-04).
- **Feed inspiracji i zapisywanie inspiracji** — Why parked: PRD §Non-Goals (v2).
- **CI auto-deploy na Cloudflare** — Why parked: cel speed; deploy manualny/Wrangler wystarczy na MVP; infra baseline partial, nie blokuje slice'ów produktowych.

## Done

- **F-01: (foundation) minimalny schemat domenowy dla profili, portfolio i zapytań jest dostępny w bazie** — Implemented 2026-07-17 → `context/changes/domain-schema-foundation/` (`implemented`). Lesson: —.
- **S-01: dekorator can register, log in, create and edit a public profile, and add portfolio entries with photos** — Implemented 2026-07-16 → `context/changes/decorator-onboarding/` (`impl_reviewed`). Lesson: —.
