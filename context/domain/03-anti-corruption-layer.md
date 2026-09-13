---
title: Anti-Corruption Layer — wyciek Supabase
created: 2026-09-13
type: refactor-plan
---

# ACL: odciąć domenę od `@supabase/supabase-js`

Plan, nie implementacja. Wybór po inwentaryzacji wycieków — nie założony z góry.

## 0. Kontekst

`tech-stack.md` wybiera Supabase jako starter (auth + Postgres + storage). `AGENTS.md:9` i `CLAUDE.md` deklarują **jedyny** factory: `createClient()` w `src/lib/supabase.ts`; **zakaz** `import '@supabase/supabase-js'` w pages/components. To jest deklaracja wymienialności klienta, nie tabel.

Warstwy dziś: `src/pages/` (SSR + API), `src/components/` (islands), `src/lib/` (schematy, query, submit), `src/middleware.ts`, SQL. Brak `src/domain/`.

## 1. Zidentyfikowane wycieki

| Zależność | Warstwy | Pliki (zweryfikowane) |
|-----------|---------|------------------------|
| **`@supabase/supabase-js` (typ `SupabaseClient` / `User`)** | lib + ambient types + testy | `inquiry-submit.ts:1`, `inquiry-query.ts:1`, `discovery-query.ts:1`, `storage-url.ts:1`, `profile-photo.ts:1`, `inquiry-query.test.ts:2`, `discovery-query.test.ts:2`, `env.d.ts:3` |
| `@supabase/ssr` | 1 plik (już adapter) | `supabase.ts:1` |
| Resend HTTP | 1 plik | `inquiry-email.ts:56` (`api.resend.com`) |
| `zod` | tylko lib schema | `inquiry-schema.ts:1`, `profile-schema.ts:1`, `portfolio-schema.ts:1` |
| PostgREST stringi tabel (nie pakiet) | API + SSR + lib | `.from("decorator_profiles"\|"portfolio_entries"\|"contact_inquiries")` w pages: profile, dashboard, `d/[id].astro:32`, portfolio API, admin, `api-auth.ts` |

Pages **nie** importują `@supabase/supabase-js` — factory trzyma się. Wyciek to **typ SDK w sygnaturach „domenowych”** oraz **słownik tabel w page/API**.

React islands nie importują Supabase ani Zod — OK.

## 2. Klasyfikacja i #1

| Kandydat | (a) warstwy/pliki | (b) koszt wymiany dziś | (c) deklaracja wymienialności |
|----------|-------------------|------------------------|-------------------------------|
| `@supabase/supabase-js` | 8 plików TS (lib/test/env); pages czyste od pakietu | Wysoki: sygnatury + każdy `.from` | **Tak** — `AGENTS.md:9` |
| `@supabase/ssr` | 1 | Niski (już izolowany) | Ta sama reguła |
| Resend fetch | 1 | Niski | Brak w PRD; już ACL |
| zod | 3 schematy | Średni | Brak deklaracji |

**#1: `@supabase/supabase-js` + sprzężenie PostgREST.** Najgorszy wyciek: dokumenty mówią „tylko `createClient`”, a helpery lead/discovery są typowane na `SupabaseClient`. Wymiana bazy wymaga edycji lib **i** ~12 call site’ów `.from` w pages. Resend i Zod są już za wąskim portem.

## 3. Diagnoza

- Factory: `supabase.ts` jedyny import `@supabase/ssr` — zgodne z AGENTS.
- Dryf: `submitPublishedInquiry(supabase: SupabaseClient, …)` (`inquiry-submit.ts:16-17`) — compose domenowy zna SDK.
- `fetchPublishedDecoratorProfile` / `listInquiriesForProfile` / `fetchPublishedDecorators` — to samo.
- SSR `d/[id].astro:32-35` woła `.from("portfolio_entries")` bezpośrednio (galeria poza helperem).
- `env.d.ts:3` — `locals.user` to `User` z pakietu; wymiana auth = zmiana kontraktu middleware.
- Nie ma wciągnięcia SDK do bundle klienta (islands nie importują). To nie jest „server lib w przeglądarce”; to **przeciek typu i słownika persystencji do warstwy aplikacji**.

Cytat intencji vs kod: `AGENTS.md:9` zabrania importu w pages (spełnione) — **nie** zabrania `SupabaseClient` w lib, więc helpery legalnie cementują vendor.

## 4. Projekt ACL

Domain types zostają w `src/types.ts` (już czyste: `DecoratorProfile`, `ContactInquiry`, `PortfolioEntry`).

```
// port — jedyne, co zna compose
interface ProfileCatalog {
  getPublished(id: string): Promise<PublishedProfile | null>
}
interface InquiryStore {
  insert(input: InquiryBody & { id: string }): Promise<{ ok: true } | { ok: false }>
}
interface PortfolioGallery {
  listApproved(profileId: string): Promise<PortfolioEntry[]>
}

// adapter — JEDYNY import @supabase/supabase-js
class SupabaseInquiryStore implements InquiryStore {
  constructor(private client: SupabaseClient) {}
  async insert(...) { return this.client.from("contact_inquiries").insert(...) }
}
```

`createClient` zostaje w `supabase.ts` (auth/cookies). Adaptery w `src/lib/adapters/supabase/`. `submitPublishedInquiry` przyjmuje porty, nie `SupabaseClient`.

Resend: zostawić `inquiry-email.ts` jako istniejący adapter (`InquiryNotifier`).

## 5. Dowód izolacji + before/after

Wymiana Supabase → Postgres/Drizzle **po** ACL dotyka tylko `src/lib/adapters/supabase/**` + `supabase.ts`. Nie: `types.ts`, `inquiry-schema.ts`, `ContactInquiryForm.tsx`, shape `{ inquiry, notification }` w POST, UI labels.

| Dziś | After |
|------|-------|
| `inquiry-submit.ts` import type SupabaseClient | port `InquiryStore` + `ProfileCatalog` |
| `d/[id].astro` `.from("portfolio_entries")` | `listApproved` |
| `env.d.ts` `User` z pakietu | własny `SessionUser { id, email }` mapowany w middleware |
| Pages `createClient` + `.from` | `createClient` + port z factory `createStores(client)` |

UI dostaje `DecoratorProfile` / `PortfolioEntry`, nie `PostgrestResponse`.

## 6. Kryterium sukcesu i plan

**Sukces:** `rg "@supabase/supabase-js" src` zwraca **wyłącznie** `src/lib/supabase.ts` + `src/lib/adapters/supabase/**` (oraz testy adaptera). Dziś (2026-09-13):

```
src/lib/inquiry-submit.ts
src/lib/inquiry-query.ts
src/lib/inquiry-query.test.ts
src/lib/discovery-query.ts
src/lib/discovery-query.test.ts
src/lib/storage-url.ts
src/lib/profile-photo.ts
src/env.d.ts
```

8 plików, **3 warstwy**: lib (query/submit/storage), test, ambient `env.d.ts`. Pages: **0**. `@supabase/ssr`: 1 plik.

Po refaktorze te 8 znikają z grep poza adapterem.

Fazy:

1. Wprowadź `SessionUser`; odetnij `env.d.ts` od pakietu.
2. Porty pod inquiry (już jeden compose) — najmniejszy blast.
3. Discovery + gallery (`d/[id].astro`).
4. Profile/portfolio/admin `.from` → repozytoria.
5. Zostaw `createClient` jako jedyny runtime import SDK.

Nie ruszać Zod (już w lib). Nie wyciągać Resend (już 1 plik).
