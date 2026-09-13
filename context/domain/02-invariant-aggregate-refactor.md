---
title: Plan refaktoryzacji agregatu niezmiennika
created: 2026-09-13
type: refactor-plan
---

# Agregat-strażnik: publiczna widoczność portfolio

Wybór #1 z `01-domain-distillation.md`: *pozycja portfolio nie jest publiczna, dopóki administrator jej nie zatwierdzi.* Nie implementować w tym dokumencie.

## 0. Kontekst

PRD: guardrail „Treści moderowane manualnie” (`prd.md:64`), FR-008 (`prd.md:105`), NFR + Open Question o timing (`prd.md:113`, `prd.md:147`). Stack: Astro SSR, React islands, Supabase RLS, Zod w `src/lib/`. Brak warstwy domenowej — reguły w SQL default, INSERT API, filtr `.astro`, PATCH admin.

## 1. Zidentyfikowane niezmienniki

| # | Reguła | Źródło | Kod |
|---|--------|--------|-----|
| A | Zapytanie tylko do opublikowanego profilu | US-01 / RLS | Egzekwowane: `inquiry-submit.ts:27-38`, `rls.sql:129-139` |
| B | Publish wymaga opisu + contact_email | `profile-schema.ts:69-88` | Egzekwowane w Zod; nie w DB |
| C | Gość widzi tylko `approved` zdjęcia | FR-005 + guardrail | Filtr `d/[id].astro:35`; default/insert **łamie** |
| D | Dekorator czyta tylko własne inquiry | FR-007 | RLS `rls.sql:123-127` |
| E | Email leada zawsze dochodzi | `prd.md:53` | Fail-soft `inquiry-email.ts:31-49` — **deklaracja, nie niezmiennik kodu** |
| F | Klient wysyła lead bez konta | `prd.md:78` | Egzekwowane (public POST) |
| G | Brak płatności / kalendarza / czatu | Non-Goals `prd.md:132-136` | Egzekwowane nieobecnością |

## 2. Klasyfikacja i wybór #1

Osie: (a) rdzeń produktu, (b) rozsmarowanie, (c) egzekucja.

| Reguła | (a) Rdzeń | (b) Warstwy / pliki | (c) Egzekucja |
|--------|-----------|---------------------|---------------|
| A zapytanie→published | Wysoki — mechanizm leada | Helper + RLS + testy (~3 warstwy, spójne) | Egzekwowana |
| B publish completeness | Średni | Zod only | Egzekwowana w app, nie w DB |
| **C approved-only public** | Średni-wysoki — jedyny guardrail treści | Schema default, 2× INSERT API, SSR galeria, admin PATCH, e2e hidden-portfolio | **Naruszałna** |
| D inbox own | Wysoki (prywatność) | RLS + inbox page | Egzekwowana |
| E email | Kanał, nie reguła zapisu | 1 plik | Świadomy fail-soft |

**Wybór C.** Jest najmniej rdzeniowa niż A, ale A jest już strzeżona po `inquiry-submit-extract`. C jest jedyną regułą jednocześnie **nazwaną w PRD jako guardrail** i **łamaną w persystencji**. Rozsmarowanie: SQL + API + page + admin — typowy „UI jest strażnikiem”.

Czy to *najgroźniejsza* w projekcie? **Tak na osi egzekucji i rozsmarowania; nie na osi rdzenia.** Najgroźniejszy *biznesowo* jest A (fałszywy lead na nieopublikowany profil) — ale ten atak RLS+helper już blokują. Najgroźniejszy *otwarty* jest C: dekorator publikuje profil i wrzuca zdjęcie → gość widzi je bez admina.

## 3. Diagnoza C

| Warstwa | Gdzie żyje | Problem |
|---------|------------|---------|
| Persystencja | `schema.sql:31` `DEFAULT 'approved'` | Nowy wiersz jest publiczny bez decyzji admina |
| API write | `portfolio/index.ts:73-83` — insert bez `moderation_status` | Dziedziczy default |
| API write | `portfolio/upload.ts:100-110` — to samo | Druga dziura |
| API admin | `admin/portfolio/[id].ts:9,32-50` | PATCH tylko `approved`\|`rejected`; kolejka zakłada `pending`, którego insert nie tworzy |
| SSR public | `d/[id].astro:31-35` | Filtr `approved` — **jedyny** strażnik gościa |
| Dashboard | `dashboard/portfolio.astro` ładuje własne wpisy bez filtra statusu | OK (właściciel) |
| UI | brak klienta-strażnika statusu przy uploadzie | Upload = natychmiast publiczne jeśli default approved |
| Test | `tests/e2e/guest-hidden-portfolio.spec.ts` | Dowód, że *pending/rejected* da się ukryć — nie że nowe wpisy startują jako pending |

Połykanie błędów: insert 500 jest fail-closed; problemem nie jest swallow, tylko **legalna ścieżka tworząca od razu approved**.

## 4. Projekt agregatu `PortfolioEntry` (root w `DecoratorPortfolio`)

Root: `DecoratorPortfolio` (id = `decorator_profile_id`) albo pojedynczy `PortfolioEntry` z niezmiennikiem na mutacjach. Prościej: **entry jest rootem**; kolekcja nie potrzebuje atomowości między wpisami.

```
class PortfolioEntry
  constructor(id, decoratorProfileId, storagePath, meta, status: ModerationStatus)

  static upload(cmd): PortfolioEntry
    // always status = pending
    // throw InvalidStoragePath if pending/ prefix or not owner folder

  approve(): void
    // throw NotPending if status !== pending (or allow re-approve no-op)
    status = approved

  reject(): void
    throw NotPending if status !== pending
    status = rejected

  isPubliclyVisible(): boolean
    return status === approved
```

Błędy domenowe (fail-fast): `InvalidStoragePath`, `NotPending`, `NotAdmin` (na porcie, nie w encji).

Port:

```
interface PortfolioRepository {
  get(id): PortfolioEntry | null
  save(entry): void  // jedna transakcja: row + (opcjonalnie) storage already uploaded
  listPublic(profileId): PortfolioEntry[]  // only approved
  listPending(): PortfolioEntry[]
}
```

Cienkie API:

- `POST /api/portfolio` i `upload` → `PortfolioEntry.upload` → 201 z `pending`
- `PATCH /api/admin/portfolio/:id` → `entry.approve()|reject()` → map `NotPending` → 409
- `d/[id].astro` → `listPublic` (zero wiedzy o enum stringach)

Default SQL zmienić na `'pending'`. CHECK/constraint: public select policy już filtruje approved (`portfolio_entries_select_public_approved` w RLS).

## 5. Before / after, fazy, testy

| Miejsce dziś | After |
|--------------|-------|
| `schema.sql:31` DEFAULT approved | DEFAULT pending + migracja |
| `portfolio/index.ts` insert bez statusu | `PortfolioEntry.upload` ustawia pending |
| `portfolio/upload.ts` insert | to samo |
| `d/[id].astro:35` inline `.eq(approved)` | `listPublic` / helper analogiczny do `inquiry-query` |
| Admin PATCH surowy update | metody `approve`/`reject` |

Fazy (test-first tam, gdzie jest Vitest):

1. **Characterization** — test: insert przez obecne API zwraca `approved` (czerwony dowód dryfu) + e2e #1 już pokrywa ukrycie pending.
2. **Schema** — migracja DEFAULT pending; istniejące approved zostają.
3. **Write path** — oba INSERT-y ustawiają `pending` jawnie (nawet przed agregatem).
4. **Extract** — `src/lib/portfolio-entry.ts` (lub analog) z `upload`/`approve`/`reject`; route cienkie.
5. **Read** — public gallery przez helper; usunąć inline `.eq` z `d/[id].astro`.

Przypadki testowe:

- upload → status pending; public list nie zawiera
- approve → widoczny na `/d/:id`
- reject → niewidoczny
- PATCH `pending` jako body → 400 (już)
- approve już approved → 409 lub no-op (wybrać w fazie 4)
- insert z ręcznym `moderation_status: approved` w body → zignorowany / 400

Load-bearing nazwy: `PortfolioEntry.upload`, `approve`, `reject`, `listPublicApproved`, `NotPending`.

Nie ruszać w tym planie inquiry-submit (już wyciągnięte) ani KV limitera.
