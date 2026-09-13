---
title: Raport architektoniczny M4 (EventBook)
created: 2026-09-13
type: architecture-report
---

# Raport do formularza 10xArchitect — Moduł 4

Repo: EventBook. Astro 6 SSR, React islands, Supabase, Cloudflare Workers. Lead-gen MVP (brak płatności / czatu / kalendarza).

## Artefakty z lekcji

| Lekcja | Co powstało | Ścieżka |
|--------|-------------|---------|
| L2 mapa | Terytorium, cruiser, contributors → `repo-map.md` | `context/mapping/repo-map.md` (+ `artifact-1-*`, `artifact-2-*`, `artifact-3-*`) |
| L3 research slice | North-star inquiry: Feature overview + dług + ast-grep | `context/changes/inquiry-flow-analysis/research.md` |
| L4 refaktor | Ranking → lock **B (C-submit)** → extract `submitPublishedInquiry` | `context/changes/inquiry-submit-extract/` (implemented + `reviews/impl-review.md` APPROVED) |
| L5 DDD | Destylacja, agregat, ACL | `context/domain/01-domain-distillation.md`, `02-invariant-aggregate-refactor.md`, `03-anti-corruption-layer.md` |

Sibling: `inquiry-query-helpers`, `refactor-opportunities` (FormField), `inquiry-rate-limit-proof` Phase 1 (flood absorbed by submit-extract).

## Jedno zdanie domeny

EventBook klasyfikuje opublikowanych dekoratorów (miasto / typ eventu / styl) i przyjmuje anonimowe zapytanie, które ląduje tylko na opublikowanym profilu (panel + fail-soft email).

## Wnioski do kolejnego cyklu (`/10x-shape` → roadmap → research → plan)

1. **Nie powtarzać extract POST inquiries** — compose jest w `src/lib/inquiry-submit.ts`; leftover grepy zielone.
2. **Następny niezmiennik:** portfolio startuje jako `pending`, nie `approved` (default SQL + dwa INSERT-y). To #1 z destylacji i plan agregatu.
3. **ACL:** `@supabase/supabase-js` w sygnaturach lib (8 plików / 3 warstwy); pages już używają `createClient`. Porty pod inquiry/discovery zanim padnie wymiana bazy.
4. **Język:** PRD mówi „lead” / „Organizator”; kod mówi `ContactInquiry` / `client_*`. Świadomy dryf, nie bug.

Event Storming (opcjonalny canvas) — nieodpalony; hotspot #1 z destylacji wystarcza jako wejście do warsztatu: *zdjęcie portfolio widoczne bez decyzji admina*.

## Załączniki (checklist formularza)

- [x] Mapa repo (L2)
- [x] Research wybranego wycinka (L3)
- [x] Plan + implementacja refaktoru (L4)
- [x] Notatki DDD (L5, trzy pliki + ten raport)
