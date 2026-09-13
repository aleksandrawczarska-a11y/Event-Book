# Terytorium — gdzie projekt żyje (historia gita)

**Data:** 2026-09-13  
**Źródło:** wyłącznie `git log` (bez czytania `src/**` w celu wyjaśniania zachowania).  
**Okno zlecone:** ostatnie 12 miesięcy (`--since=2025-09-13`).  
**Okno faktyczne:** **2026-06-18 → 2026-09-12** — historia repo jest krótsza niż rok (~3 miesiące, **43 commity**, wszystkie mieszczą się w oknie 12 miesięcy).

---

## Preambuła: metoda i szum

### Co policzono

```text
git log --since=2025-09-13 --pretty=format:"COMMIT %h %ad %s" --date=short --name-only
git log --since=2025-09-13 --stat --oneline
```

- **commit-touch** — liczba unikalnych commitów, które dotknęły ścieżki / obszaru.
- **file-hit** — ile razy plik (albo plik w obszarze) pojawił się na liście zmian; jeden commit = najwyżej 1 hit na plik.
- **współzmiana** — pary i trójki obszarów, które współwystępują w tym samym commicie.
- **hub** — plik, który w commitach produktowych pojawia się razem z wieloma różnymi obszarami.

Commit początkowy `b7d43c6` (2026-06-18, 163 pliki, bootstrap Astro/auth/Cloudflare) **zniekształca ranking**. Poniższe rankingi „steady / hands-on” liczą **42 commity po inicjalizacji**, o ile nie napisano inaczej. Inicjalizacja jest opisana osobno jako jednorazowy zrzut, nie jako stała aktywność.

### Odfiltrowany szum (nie jest terytorium produktowym)

| Kategoria | Ścieżki | Hity w całym oknie |
|---|---|---|
| lockfile | `package-lock.json` | 3 commity |
| lockfile | `skills-lock.json` | 1 commit (inicjalizacja) |
| narzędzia kursu / agenta | `.cursor/**` | 57 file-hitów (głównie inicjalizacja + drobne reguły) |
| narzędzia kursu | `.agents/**` | 53 file-hity (prawie wyłącznie inicjalizacja) |
| scaffold | `*.scaffold` | 0 w historii commitów |
| raporty | `playwright-report/**` | 0 w historii |
| wygenerowany HTML | np. `artifact-2-archi.html` | 0 w historii commitów |

Dodatkowo **nie traktuję jako terytorium produktowego** (proces 10x, nie kod aplikacji):

- **14 commitów** typu *write back SHA / close out plan (epilogue) / archive* — zmieniają głównie `context/changes/*/plan.md` i `change.md`.
- Przeniesienie `context/changes/admin-moderation/**` → `context/archive/2026-08-07-admin-moderation/**` (2026-09-10): te same plany, inna ścieżka.
- Pliki w katalogu głównym z inicjalizacji (`.vscode/`, `public/template.png`, `idea-notes.md.md`, `mvp.txt`) — jednorazowy zrzut.

`package.json`, `astro.config.mjs`, `README.md`, `AGENTS.md` **nie** są lockfile’ami: zostają w analizie jako config / docs, ale nie jako „moduł domenowy”.

---

## Aktywne obszary

### Nacisk w czasie (kwartały i miesiące)

Historia nie pokrywa Q4 2025 ani Q1 2026. W praktyce są dwa kwartały:

| Okres | Commity | Nacisk (po odfiltrowaniu szumu) |
|---|---|---|
| **2026-Q2** (18–20 czerwca) | 2 | Bootstrap runtime/auth + pierwsza migracja schematu. Jednorazowy zrzut, nie rytm. |
| **2026-Q3** (lipiec–12 września) | 41 | Prawie cała praca produktowa. |

Miesiące:

| Miesiąc | Commity | Co realnie rosło |
|---|---|---|
| 2026-06 | 2 | Inicjalizacja + `supabase/migrations` (schemat domeny). |
| 2026-07 | 17 | **Najgęstszy hands-on:** onboarding dekoratora (profil/portfolio), discovery publiczne, dokończenie schematu/RLS/storage. |
| 2026-08 | 4 | Jeden gruby slice leada (`feat(contact-lead-flow)`), reszta to epilogi/SHA. |
| 2026-09 | 20 | **Najwięcej commitów**, ale sporo procesu: admin-moderacja + filtr kolejki, potem drobne fixy inquiries, e2e, dependency-cruiser. |

Wniosek czasowy: terytorium **nie jest równomierne**. Lipiec buduje pion dekoratora i wyszukiwarki; sierpień dokłada lead w jednym commicie; wrzesień zagęszcza admina i metadane planu.

### TOP katalogi / moduły (po inicjalizacji, bez `.cursor` / lockfile / `.agents`)

**Produkt (`src/`, `supabase/`, `tests/`):**

| # | Obszar | Commity | File-hity | Uwaga |
|---|---|---|---|---|
| 1 | `src/lib/` | 14 | 30 | Najstabilniejszy warsztat: schematy, auth API, discovery, inquiry, kolejka. |
| 2 | `src/pages/dashboard/` + `dashboard.astro` | 11 | 14 | Shell zalogowanego dekoratora/admina; najczęściej ruszany plik produktowy. |
| 3 | `src/pages/api/**` (łącznie) | 9 | ~20 | Publiczne API: profile, portfolio, inquiries, admin. |
| 4 | `src/components/decorator/` | 5 | 8 | Formularze profilu i portfolio. |
| 5 | `supabase/migrations/` | 5 | 5 | Schemat, RLS, storage, admin RLS — każdy plik zwykle 1 commit. |
| 6 | `src/pages/api/profile/` | 4 | 5 | CRUD profilu + avatar. |
| 7 | `src/pages/api/portfolio/` | 3 | 7 | CRUD + upload; pliki nadal w repo. |
| 8 | `src/pages/d/` | 3 | 3 | Publiczny profil dekoratora. |
| 9 | `src/layouts/` | 3 | 3 | Głównie `DashboardLayout.astro`. |
| 10 | `src/pages/api/inquiries/` + `tests/` | 2+2 | 4+4 | Lead i e2e — mało commitów, grube commity. |

**Proces (`context/`) — wysokie liczby, inny rodzaj aktywności:**

| Obszar | Commity | File-hity | Status ścieżki |
|---|---|---|---|
| `context/changes/admin-moderation/` | 9 | 16 | **Usunięte z tej ścieżki** (archiwum 2026-09-10). |
| `context/changes/domain-schema-foundation/` | 9 | 15 | Nadal w repo. |
| `context/changes/decorator-onboarding/` | 7 | 12 | Nadal w repo. |
| `context/foundation/` (głównie `roadmap.md`) | 7 | 7 | Nadal w repo. |
| `context/changes/contact-lead-flow/` | 4 | 9 | Nadal w repo. |
| `context/changes/admin-queue-filter/` | 4 | 7 | Nadal w repo. |

Grube katalogi bez schodzenia w dół kłamią: `context/` ma **38/43** commitów, ale większość to plany/SHA. Hands-on kodu to **`src/` w 19 commitach** (118 file-hitów w całym oknie włącznie z inicjalizacją; po inicjalizacji wciąż dominują `lib` + dashboard + API).

### TOP pliki produktowe (po inicjalizacji)

| # | Plik | Hity | Nadal w repo |
|---|---|---|---|
| 1 | `src/pages/dashboard.astro` | 6 | tak |
| 2 | `src/pages/dashboard/profile.astro` | 4 | tak |
| 3 | `astro.config.mjs` | 3 | tak |
| 4 | `src/lib/discovery-query.ts` (+ `.test.ts`) | 3+3 | tak |
| 5 | `src/pages/d/[id].astro` | 3 | tak |
| 6 | `src/lib/api-auth.ts` | 3 | tak |
| 7 | `src/lib/profile-schema.ts` | 3 | tak |
| 8 | `src/pages/api/profile/index.ts` | 3 | tak |
| 9 | `src/pages/api/portfolio/[id].ts` | 3 | tak |
| 10 | `src/pages/dashboard/portfolio.astro` / `PortfolioPanel.tsx` / `DashboardLayout.astro` | 3 | tak |

Gdyby nie odfiltrować procesu, ranking wygrałyby `plan.md` (8+8+7+4) i `roadmap.md` (7). To nie jest kod, który „żyje” w runtime.

---

## Co zmienia się razem

Liczone na **22 commitach produktowych** po inicjalizacji (commit musiał ruszyć `src/`, `supabase/` albo `tests/`).

### Top pary katalogów

| Commity | Para |
|---|---|
| **8** | `src/lib/` + `src/pages/dashboard/` |
| **4** | `src/lib/` + `src/pages/api/profile/` |
| **4** | `src/pages/api/profile/` + `src/pages/dashboard/` |
| **4** | `src/components/decorator/` + `src/lib/` |
| **4** | `src/components/decorator/` + `src/pages/dashboard/` |
| **3** | `src/lib/` + `src/pages/api/portfolio/` |
| **3** | `src/pages/api/portfolio/` + `src/pages/dashboard/` |
| **3** | `src/lib/` + `src/pages/d/` |
| **3** | `src/layouts/` + `src/pages/dashboard/` |
| **2** | `src/pages/d/` + `src/pages/search.astro` |

### Top trójki

| Commity | Trójka |
|---|---|
| **4** | `src/components/decorator/` + `src/lib/` + `src/pages/dashboard/` |
| **4** | `src/lib/` + `src/pages/api/profile/` + `src/pages/dashboard/` |
| **3** | `src/lib/` + `src/pages/api/portfolio/` + `src/pages/dashboard/` |
| **3** | `src/layouts/` + `src/lib/` + `src/pages/dashboard/` |

### Wnioski dla top 3 sprzężeń

1. **`lib` ↔ dashboard (8)**  
   To główne sprzężenie repo. Nowy slice (profil, portfolio, kolejka admina, zapytania) prawie zawsze ląduje w helperze w `src/lib/` i w shellu `dashboard.astro` / `dashboard/*`. Dashboard jest kompozytorem, nie osobną domeną.

2. **dekorator UI + `lib` + dashboard (4)**  
   Onboarding to pion: islandy `components/decorator/*` + schemat/helper + strona dashboardu. Nie widać osobnego „frontendu” i „backendu” w commitach — idą razem.

3. **`lib` + API profilu + dashboard (4)**  
   Drugi pion: `pages/api/profile/*` nie żyje samodzielnie; commity ciągną schemat (`profile-schema`) i widok `dashboard/profile.astro`. Analogicznie portfolio (3) — ten sam wzorzec dla `api/portfolio`.

Publiczny discovery (`d/[id]` + `search` + `discovery-query`) jest rzadszy (2–3 commity), ale spójny: te trzy ścieżki wchodzą razem, bez dashboardu dekoratora.

`context/changes/<slug>/` współwystępuje z `src/` głównie w commitach `feat`/`fix` (decorator-onboarding: 6/7 z `src`; admin-queue-filter: 3/4; admin-moderation: tylko 3/9 — reszta to SHA/epilog). To sprzężenie procesu z kodem, nie dwóch modułów runtime.

### Wspólny mianownik (hub poza podziałem na foldery)

Nie ma pliku tłumaczeń ani snapshotów. Kandydaci z historii:

| Plik | Hity (po init) | Ile obszarów produktowych w tych samych commitach | Werdykt |
|---|---|---|---|
| `src/pages/dashboard.astro` | 6 | 13 | **Prawdziwy hub produktowy** — admin, dekorator, inquiries, layout, lib. |
| `astro.config.mjs` | 3 | 13 | Hub konfiguracyjny (env / adapter) przy discovery i leadzie. |
| `src/pages/dashboard/profile.astro` | 4 | 11 | Hub onboardingu, nie całego repo. |
| `src/lib/api-auth.ts` + `src/middleware.ts` | 3+2 | (auth + admin) | Hub sesji/roli; mało hitów, ale przecina slice’y. |
| `context/foundation/roadmap.md` | 7 | — | Hub **procesu**, nie runtime. |
| `*/plan.md` | 4–8 | — | Hub metadanych 10x; część ścieżek już nie istnieje. |

`package-lock.json` pojawia się w 3 commitach (init, onboarding types, dependency-cruiser) — lockfile, nie mianownik domeny.

### Czy sprzężone pliki nadal są w repo?

**Tak dla całego kodu produktowego z rankingów:** `dashboard.astro`, `d/[id].astro`, `api/portfolio/[id].ts`, `api/admin/portfolio/[id].ts`, `api-auth.ts`, `middleware.ts`, `discovery-query.ts`, `inquiry-email.ts`, `ContactInquiryForm.tsx`, `ModerationQueue.tsx`, migracje w `supabase/migrations/`.

**Nie dla procesu admin-moderation pod starą ścieżką:**

- `context/changes/admin-moderation/plan.md` (8 hitów) — **brak**
- `context/changes/admin-moderation/change.md` (4 hity) — **brak**
- treść jest w `context/archive/2026-08-07-admin-moderation/` (commit `39e0e09`)

Dalsza analiza terytorium **nie powinna** opierać się na `context/changes/admin-moderation/**`.

---

## Przecięcia z warstwami runtime

Poniżej: commity **po inicjalizacji**, które ruszyły pliki z danej warstwy. Inicjalizacja (`b7d43c6`) dodała cały stos auth/SSR/Workers naraz — to tło, nie rytm.

### Runtime

**6 commitów.** Ścieżki: `astro.config.mjs` (3), `src/middleware.ts` (2), `src/lib/supabase.ts` (1), `src/env.d.ts` (1).  
Middleware wraca przy bramce admina (`optional-chain app_metadata`). `astro.config.mjs` przy publicznym search i leadzie. To cienka, ale powtarzalna oś żądania.

### Auth

**5 commitów** po init (+ cały stos w inicjalizacji: `pages/api/auth/*`, `pages/auth/*`, `components/auth/*`).  
Później auth **nie jest osobnym epickim folderem** — żyje w `src/lib/api-auth.ts` (3) i `middleware.ts` (2), z pojedynczymi poprawkami `signin`/`signup`. Subjecty: onboarding, admin-moderation. Auth jest przecięciem, nie terytorium tygodnia.

### Data

**13 commitów — najszersze przecięcie.**  
Migracje (po 1 hicie): `domain_schema`, `domain_rls`, `profiles_storage`, `portfolio_storage`, `admin_moderation_rls`, plus `supabase/seed.sql`.  
W `src/lib/`: `profile-schema`, `portfolio-schema`, `discovery-query`, `inquiry-schema` / `inquiry-abuse`, `types.ts`.  
Dane i walidacja są rozlane po slice’ach; nie ma osobnego katalogu `db/` poza `supabase/`.

### Public API

**9 commitów.** Aktywne grupy:

| Grupa | Hity (pliki) | Slice z subjectów |
|---|---|---|
| `src/pages/api/profile/` | 3+2 | decorator-onboarding |
| `src/pages/api/portfolio/` | 3+2+2 | decorator-onboarding |
| `src/pages/api/inquiries/` | 2+2 (handler + test) | contact-lead-flow + fix 201 |
| `src/pages/api/admin/portfolio/` | 1+1 | admin-moderation |
| `src/pages/api/auth/signin.ts` | 1 | onboarding (po init) |

API rośnie pionowo ze slice’em, nie jako osobna warstwa „backend only”.

### Integracje

**7 commitów.** Sygnały z nazw plików i subjectów, nie z lektury kodu:

- Supabase SSR / klient: `src/lib/supabase.ts`, migracje, seed.
- Storage: `profile-photo.ts`, `storage-url.ts`, migracje `*_storage.sql`.
- Mail leadów: `src/lib/inquiry-email.ts` (2 hity, w tym fix statusu 201).
- Env / adapter: `.env.example`, `astro.config.mjs`.

Brak commitów pod płatności, chat, kalendarz — zgodnie z twardymi regułami MVP (to wniosek z *braku* ścieżek w historii, nie z PRD).

### Build

**6 commitów** po init: `astro.config.mjs` (3), `package.json` (2), `playwright.config.ts` (1), `eslint.config.js` (1); plus init (`wrangler.jsonc`, `vitest.config.ts`, `.github/workflows/*`) i wrzesień `dependency-cruiser` + lockfile.  
Build jest tłem. CI w historii nie jest stałym polem bitwy.

---

## Co nie jest terytorium

Odłóż na bok przy kolejnych krokach mapy:

1. **Lockfile’y i manifesty narzędzi** — `package-lock.json`, `skills-lock.json`.
2. **`.cursor/` i `.agents/`** — skills kursu, prompty, reguły; wysokie hity, zero runtime.
3. **`*.scaffold`** — nie committowane; nie liczyć jako historii.
4. **Epilogi i write-back SHA** — 14 commitów, puste z punktu widzenia kodu.
5. **Martwa ścieżka** `context/changes/admin-moderation/**` — przeniesiona do archiwum.
6. **Inicjalizacyjny zrzut** `b7d43c6` — 163 pliki; przydatny jako data startu stosu, nie jako „często ruszane”.
7. **Brak w historii:** lokalizacje (`locales/`, `*.po`), snapshoty testowe, `playwright-report`, masowy format-only commit, wygenerowany HTML mapy.

---

## Skrót terytorium

Hands-on przez całe krótkie życie repo to **`src/lib/` + dashboard + `pages/api/{profile,portfolio,inquiries,admin}`**, z migracjami w **`supabase/migrations/`**. Slice’y wchodzą pionowo (lib + API + island + strona), a nie warstwowo. Hubem stron jest `dashboard.astro`; hubem procesu — `roadmap.md` i `plan.md` (ostrożnie: admin-moderation już tylko w archiwum). Auth/runtime są przecięciem rzadkim, ale centralnym. Okno 12 miesięcy = faktycznie czerwiec–wrzesień 2026.
