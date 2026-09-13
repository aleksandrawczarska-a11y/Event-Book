# Artefakt 3 — Mapa kontrybutorów

**Data:** 2026-09-13  
**Projekt:** EventBook (Astro 6 SSR + React islands) — **nie** przykładowe repo `channels` / `admin_console` z lekcji.  
**Ćwiczenie:** Wide Scan 3/3 — pytanie przewodnie: **kogo zapytać, zanim zmienisz coś, czego ktoś już próbował rok temu?**

W repo **nie ma** `context/mapping/artifact-1-territory.md`. Pięć obszarów wzięte z `context/mapping/artifact-2-structure.md` (huby, kompozytorzy, analog `admin_console`) oraz ryzyk #1–#6 w `context/foundation/test-plan.md` (admin/visibility, north-star inquiry, discovery, profil/portfolio, auth-middleware).

Okno: `git log --since=2025-09-13` (12 miesięcy wstecz od 2026-09-13). Faktyczny zakres historii: **2026-06-18 → 2026-09-12** (~3 miesiące, 43 commity). Nie ma roku prób.

---

## Werdykt (uczciwość)

To jest **solo / course repo**. Po odfiltrowaniu botów i agentów zostaje **jedna osoba**.

| Filtr | Wynik |
|---|---|
| Unikalne `%an <%ae>` (12 mies. i all-time) | **1:** `Aleksandra Piasecka <aleksandra.piasecka@ceneo.pl>` |
| `git shortlog -sn --since=2025-09-13` | **43** Aleksandra Piasecka |
| Boty / automation (`dependabot`, `github-actions`, `renovate`, …) | **0** |
| Autor-agent jako `%an` (Claude, Codex, Copilot, Cursor, Devin, …) | **0** — Cursor **nie** jest gita-autorem |
| `Co-authored-by: Cursor <cursoragent@cursor.com>` | **43 / 43** commitów |
| Commity bez trailera Cursor | **0** |

Cursor jest współautorem implementacji, **nie** ekspertem domenowym. Nie wrzucamy go do tabel. Nie ma drugiego recenzenta, nie ma Mattermosta, nie ma zespołu `channels`. „Kogo zapytać?” = właścicielkę (Aleksandra / `aleksandrawczarska`) **oraz** `context/archive/` i `context/changes/` — nie kolegę z innego squadu.

Liczby w kolumnie **Commity** to commity z ostatnich 12 miesięcy, które **dotykają ścieżek obszaru** (`git log --since=2025-09-13 -- <paths>`). Specjalizacja z subjectów `feat` / `fix` / `test` (nie z chore „write back SHA”).

---

## 1. Admin / moderacja

Ścieżki: `src/components/admin`, `src/pages/api/admin`, `src/lib/moderation-queue.ts`, `src/pages/dashboard.astro`.  
Struktura: analog `admin_console`; test-plan #1 / #2, slice S-04. Kompozytor poza grafem: `dashboard.astro` składa kolejkę + `locals.isAdmin`.

**Aleksandra Piasecka dominuje moderację** — jedyna osoba w historii; najgęstszy blok subjectów w repo (`admin-moderation`, `admin-queue-filter`).

| Osoba | Commity | Specjalizacja (z subjectów PR/commitów) |
|---|---:|---|
| Aleksandra Piasecka | 8 | Kolejka moderacji UI + API; filtr statusu na dashboardzie; parser statusu (test-first); badge’e statusu portfolio; alert błędu kolejki |

Subjecty, które o tym świadczą: `feat(admin-moderation): admin moderation queue UI + API`, `feat(admin-queue-filter): Apply filter on the dashboard`, `test(admin-queue-filter): Queue status parser`, `feat(admin-moderation): portfolio moderation status badges`. Incydentalnie w tym samym `git log -- paths` wpadają też shell dashboardu (onboarding) i initial commit — to nie jest osobna specjalizacja.

---

## 2. Inquiry / lead (north-star)

Ścieżki: `src/components/discovery/ContactInquiryForm.tsx`, `src/pages/api/inquiries`, `src/pages/dashboard/inquiries.astro`, `src/lib/inquiry-abuse.ts`, `src/lib/inquiry-email.ts`, `src/lib/inquiry-schema.ts`.  
Struktura: jedyny handler z Ce>4 (`api/inquiries/index.ts`); test-plan #3 / #4 / #5, slice S-03.

**Aleksandra Piasecka dominuje ścieżkę leada** — mało commitów, ale cały slice S-03 jest jej (plus późniejszy fix maila).

| Osoba | Commity | Specjalizacja (z subjectów PR/commitów) |
|---|---:|---|
| Aleksandra Piasecka | 2 | POST inquiry (API + publiczny formularz + panel dekoratora); status notyfikacji e-mail na 201 |

Subjecty: `feat(contact-lead-flow): inquiry submit API, public form, and decorator panel`, `fix(inquiries): surface email notification status on 201`. Osobno, poza tymi ścieżkami, jest `test(e2e): cover hidden portfolio and inquiry delivery` — ten sam człowiek, ten sam temat, inny folder (`tests/`).

---

## 3. Discovery / search

Ścieżki: `src/pages/search.astro`, `src/lib/discovery-query.ts`, `src/lib/decorator-taxonomy.ts`, `src/pages/d`.  
Struktura: `search.astro` → `discovery-query` (bez islandy); test-plan #6, slice S-02. Publiczny profil `d/[id]` składa też formularz leada.

**Aleksandra Piasecka dominuje discovery** — jeden slice S-02 plus triage po impl-review.

| Osoba | Commity | Specjalizacja (z subjectów PR/commitów) |
|---|---:|---|
| Aleksandra Piasecka | 4 | Publiczny search i karta dekoratora (S-02); poprawki po impl-review S-02; mount formularza leada na `d/[id]` |

Subjecty: `feat(client-discovery): public search and decorator profile`, `fix(client-discovery): address S-02 impl-review triage findings`. Dwa pozostałe hit-y ścieżek to `contact-lead-flow` (formularz na profilu) i shell typów z onboardingu — nie osobny ekspert search.

---

## 4. Profil / portfolio dekoratora

Ścieżki: `src/components/decorator`, `src/pages/api/portfolio`, `src/pages/api/profile`, `src/pages/dashboard/portfolio.astro`, `src/pages/dashboard/profile.astro`, `src/lib/portfolio-schema.ts`, `src/lib/profile-schema.ts`, `src/lib/profile-photo.ts`, `src/lib/storage-url.ts`.  
Struktura: islandowy rekord Ce to `ProfileForm` (Ce=7); test-plan #1 (gość vs pending/rejected), slice S-01.

**Aleksandra Piasecka dominuje onboarding dekoratora** — najdłuższy łańcuch `feat(decorator-onboarding)` w historii (CRUD profilu i portfolio, storage zdjęć).

| Osoba | Commity | Specjalizacja (z subjectów PR/commitów) |
|---|---:|---|
| Aleksandra Piasecka | 8 | CRUD profilu; zdjęcie profilowe (storage); CRUD portfolio; upload zdjęć portfolio; poprawki po impl-review; badge’e statusu moderacji na portfolio |

Subjecty: `feat(decorator-onboarding): Profile CRUD`, `Profile photo storage`, `Portfolio CRUD`, `Portfolio photo upload`, `fix(decorator-onboarding): address impl-review findings`, `feat(admin-moderation): portfolio moderation status badges`. Seed ze `domain-schema-foundation` dotyka tych ścieżek, ale to schemat/seed, nie UI.

---

## 5. Huby `lib` / auth / middleware

Ścieżki: `src/lib/api-auth.ts`, `src/lib/api-error.ts`, `src/lib/supabase.ts`, `src/middleware.ts`, `src/types.ts`, `src/components/auth`, `src/pages/api/auth`, `src/pages/auth`.  
Struktura: największy Ca (`types` 15, `api-error` 14, `api-auth` / `supabase` 7); middleware tylko → `supabase`; test-plan #2 (gate admin vs sesja).

**Aleksandra Piasecka dominuje kontrakt sesji i typów** — nie dlatego, że jest zespołem platform, tylko dlatego, że nie ma kogo innego. Zmiana `ModerationStatus` / `requireAdmin` / `PROTECTED_ROUTES` i tak idzie przez nią.

| Osoba | Commity | Specjalizacja (z subjectów PR/commitów) |
|---|---:|---|
| Aleksandra Piasecka | 9 | Detekcja admina + łatka RLS; optional-chain `app_metadata` na bramce; typy i shell dashboardu; bootstrap auth (Astro SSR + Supabase + Cloudflare) |

Subjecty: `feat(admin-moderation): RLS gap fix + admin detection`, `fix(admin-moderation): optional-chain app_metadata on admin gate`, `feat(decorator-onboarding): Types and dashboard shell`, `Initial EventBook project: Astro SSR, Supabase auth, Cloudflare Workers deploy`. Reszta hit-ów to konsumenci hubów (inquiry, portfolio, seed) — ten sam autor, nie osobny maintainer `lib`.

---

## Co z tego wynika

1. **Nie ma mapy ekspertów w sensie lekcji `channels`.** Pięć obszarów = pięć razy ta sama osoba. Tabele nie kłamią liczebnością zespołu.

2. **Cursor nie zastępuje kontekstu ludzkiego.** 43/43 commitów ma `Co-authored-by: Cursor`. Agent pisał kod; decyzje produktowe i „co już próbowaliśmy” nie żyją w git author — żyją w `context/archive/` (S-01–S-04, F-01) i otwartych `context/changes/*`.

3. **Nie ma „roku temu”.** Najstarszy commit: 2026-06-18 (`Initial EventBook`). Pytanie lekcji („ktoś już próbował rok temu”) w tym repo jest puste. Zamiast szukać weterana: czytaj `impl-review` i epilogue w archive.

4. **Jedyny człowiek do pytania przed zmianą hubu** (`types.ts`, `api-auth`, `inquiry-*`, kolejka admina) to Aleksandra Piasecka. Jeśli jej nie ma — jedyne źródło to artefakty w `context/`, nie drugi kontrybutor.

---

## Źródła

```text
# unikalność autorów
git log --since=2025-09-13 --format="%an <%ae>"
git log --format="%an <%ae>"          # all-time: ta sama 1 osoba
git shortlog -sn --since=2025-09-13   # 43  Aleksandra Piasecka

# subject + autor
git log --since=2025-09-13 --pretty=format:"%h|%an|%ae|%s"

# per obszar (przykład)
git log --since=2025-09-13 --pretty=format:"%h|%an|%s" -- src/components/admin src/pages/api/admin src/lib/moderation-queue.ts src/pages/dashboard.astro
```

Trailer obecny w **każdym** z 43 ciał commitów: `Co-authored-by: Cursor <cursoragent@cursor.com>`.
