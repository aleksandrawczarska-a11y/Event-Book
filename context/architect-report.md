---
title: Raport architektoniczny — Moduł 4
created: 2026-09-13
type: architect-report
course: 10xArchitect
---

# Raport architektoniczny (Moduł 4)

Wszystkie wejścia z **jednego** repo: EventBook (`Event-Book`). Stos: Astro 6 SSR, React 19 islands, TypeScript, Supabase, Tailwind, deploy Cloudflare Workers (`context/foundation/tech-stack.md`). Skala: solo MVP, ~3 miesiące gita / 43 commity, jeden kontrybutor (`context/mapping/repo-map.md` — Teren).

| Wejście | Ścieżka | Repo |
|---------|---------|------|
| L2 mapa | `context/mapping/repo-map.md` | EventBook |
| L3 research | `context/changes/inquiry-flow-analysis/research.md` | EventBook |
| L4 plan | `context/changes/inquiry-submit-extract/plan.md` | EventBook |
| L5 DDD | `context/domain/01-domain-distillation.md`, `02-invariant-aggregate-refactor.md`, `03-anti-corruption-layer.md` | EventBook |

`context/domain/04-module-architecture-report.md` to szkic roboczy sprzed tego raportu — nie jest wejściem L2–L5.

## 1. Opisane projekty

Tylko EventBook. L2, L3, L4 i L5 powstały tu.

## 2. Mapa projektu (L2)

Źródło: `context/mapping/repo-map.md`.

1. Graf TS/TSX jest DAG: **0 cykli**, 74 moduły / 158 krawędzi (`src`+`tests`); stos `types ← lib ← API/islandy ← shelle .astro` (TL;DR).
2. Boli nie pętla, tylko **huby kontraktu** (`types.ts` Ca=15, `api-error.ts` Ca=14) i **kompozytorzy poza grafem** (`dashboard.astro`, `d/[id].astro`) plus jedyny handler Ce=6: `api/inquiries` (TL;DR; strefa ryzyka 1 i 3).
3. Entry pointy dnia 1: `types.ts` → `supabase.ts` → `middleware.ts` → `api-auth.ts` → `dashboard.astro` → `d/[id].astro` → `api/inquiries` → `ContactInquiryForm` (sekcja „Pierwszy dzień”).
4. North-star lead ma **2 commity** w oknie mapy — mało historii, cały slice w jednym miejscu (Teren, tabela).
5. Najważniejsze unknowns: cruiser **nie widzi `.astro`**; mapa zapisuje brak `artifact-1-territory.md` w momencie syntezy (`Ograniczenia`); `✔ no dependency violations` **nie** egzekwuje warstw EventBook.

## 3. Analiza ficzeru (L3)

Źródło: `context/changes/inquiry-flow-analysis/research.md` (Deep Focus; baseline `18aedd3`).

**Który przepływ i dlaczego.** Guest form na publicznym profilu → `POST /api/inquiries` → inbox dekoratora. Mapa wskazuje ten handler jako jedyny Ce=6 i ryzyka test-plan **#3 / #5** (Summary + Research Question; mapa strefa 3).

**Feature overview.** Gość otwiera opublikowane `/d/:id` (shell poza grafem), islanda `fetch("/api/inquiries")`. Handler bez `api-auth`: honeypot → zod → limiter `Map` → published profile → insert → fail-soft Resend → `201`. Dekorator czyta wiersz w `/dashboard/inquiries` (RLS `select_own`). HTTP 201 = „wiersz przyjęty”, nie „mail doszedł” (Summary; Feature overview kroki 1–12).

**Technical debt (2–3, z ast-grep).** (1) Brak dowodu **429 ⇒ no insert** — handler mockował abuse (Technical debt; D2b). (2) Jedyny Ce=6 compose w route — kandydat **C-submit** (klasyfikacja T-Ce; ranking). (3) Write `contact_inquiries` tylko w handlerze — ast-grep `from` dał 0 (parser), **grep** potwierdził write `index.ts:73` i read inbox (tabela weryfikacji, wiersz `contact_inquiries`). Potwierdzone ast-grep+grep: API eksportuje tylko `POST`; brak `src/lib/services/`; `CreateContactInquiryInput` nieużywane.

## 4. Plan refaktoryzacji (L4)

Źródło: `context/changes/inquiry-submit-extract/plan.md` (lock **B / C-submit**).

**Co i kształt.** Najpierw charakterystyka 429⇒brak insertu, potem `submitPublishedInquiry` w `src/lib/inquiry-submit.ts`; `POST` zostaje adapterem HTTP (503 / JSON / honeypot / zod → mapowanie unii). Limiter `Map` zostaje (Overview; Desired End State).

**Czego nie robimy.** Query helpers / FormField od nowa; KV/DO limiter; auth na publicznym POST; `services/`; GET inquiries; Zod w React; CI `npm test`; płatności/czat/kalendarz (`What We're NOT Doing`).

**Fazy + weryfikacja.** (1) Flood na żywym limiterze + wspólny mock insert — Vitest/eslint; ręcznie: oracle to „insert nie wołany”. (2) Extract + testy helpera — Vitest/eslint; ręcznie: `/d/:id` 201/thanks. (3) Leftover grep + depcruise + eslint; ręcznie: sign-in i labele Flory (Implementation Approach; Progress 1.1–3.5).

## 5. Domena / DDD (L5)

Źródła: `context/domain/01-*.md`, `02-*.md`, `03-*.md`.

**Język (3–5 + dryf).** Dekorator, Klient, zapytanie/`ContactInquiry`, profil `is_published`, portfolio + `moderation_status` (`01` tabela UL). Dryf: PRD „lead” / „Organizator” vs kod `ContactInquiry` / `client_*`; publish „z portfolio” vs Zod bez zdjęć; default SQL `'approved'` vs filtr galerii `approved` (`01` §4).

**Niezmiennik #1 i agregat.** *Zdjęcie nie jest publiczne, dopóki admin nie zatwierdzi* — `PortfolioEntry` / `upload`→`pending`, `approve`/`reject` (`02` §2–4). Inquiry→published jest bardziej rdzeniowe, ale już egzekwowane (helper + RLS).

**ACL.** `#1` `@supabase/supabase-js`: **8 plików, 3 warstwy** (lib / test / `env.d.ts`); pages **0**. `@supabase/ssr` tylko w `supabase.ts` (`03` §1–2, §6).

## 6. Decyzje, które należą do mnie

Ranking L3 stawiał C-submit wysoko; **pierwsze pytanie w wywiadzie było o opcję, nie o potwierdzenie gwiazdki**. Wybrałam **B (extract compose)**, ale **nie pozwoliłam ruszyć seamu 429 bez testu** — Phase 1 przed Phase 2, bez KV i bez drugiego równoległego `inquiry-rate-limit-proof`.

FormField i query helpers już poszły wcześniej; **nie mieszałam ich z tym extractem**. Ręcznie sprawdziłam Flora `/d/6c310b9e-…` (201/thanks) i — po review F1 — **sign-in**, nie tylko zrzut formularza.

W L5 **nie kupiłam** „najgroźniejszy = zawsze rdzeń”: inquiry→published zostawiam jako już strzeżone; **następny ruch to pending na portfolio**, nie kolejny extract POST i nie wymiana Supabase. ACL zostaje notatką, nie sprintem.

---

Ten plik jest jedynym załącznikiem do formularza 10xArchitect. Szczegóły liczb i grepów są w czterech wejściach powyżej.
