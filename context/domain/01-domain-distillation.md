---
title: EventBook domain distillation
created: 2026-09-13
type: domain-distillation
---

# Destylacja domeny EventBook

Źródła: `context/foundation/prd.md` (wizja, US-01, FR, Business Logic, Non-Goals), `AGENTS.md`, `src/types.ts`, migracje `supabase/migrations/20260620120000_domain_schema.sql` i `20260620130000_domain_rls.sql`, warstwy `src/lib/`, `src/pages/`, `src/components/`. Stack: Astro 6 SSR + React islands + Supabase + Zod w `src/lib/`. Logika biznesowa żyje w **lib + RLS + API routes**; UI jest cienkie; **nie ma** warstwy `src/domain/` ani `src/lib/services/`.

Ograniczenie: PRD jest `status: draft`; Open Questions 1–2 zostawiają proces moderacji niedomknięty.

## 1. Ubiquitous Language

| Pojęcie | Definicja (cytat) | Dokument | Kod |
|---------|-------------------|----------|-----|
| Dekorator | „freelancer lub mała firma dekoracyjna” | `prd.md:28` | Konto `auth.users` + wiersz `decorator_profiles` (`20260620120000_domain_schema.sql:6-8`). Brak typu `Decorator`. |
| Klient / Organizator | „osoba organizująca wydarzenie”; US-01: „anonimowy klient” | `prd.md:36`, `prd.md:71` | Pola `client_*` na `ContactInquiry` (`types.ts:35-37`). **BRAK w kodzie** nazwy `Organizator`. |
| Lead / zapytanie | „system zbierania leadów”; „dekorator otrzymuje lead” | `prd.md:18`, `prd.md:123` | Encja `ContactInquiry` / tabela `contact_inquiries` (`types.ts:32`, schema `:35`). Słowo **lead** tylko w e2e (`tests/e2e/inquiry-confirmation-reaches-decorator.spec.ts:1`). **BRAK w kodzie** typu `Lead`. |
| Profil publiczny | FR-002: company name, photo, description, location, Instagram, contact | `prd.md:87` | `DecoratorProfile` (`types.ts:3-18`); publikacja = `is_published` (`schema.sql:18`). |
| Portfolio / realizacja | FR-003: zdjęcia + opis eventu, styl, lokalizacja, tagi | `prd.md:89` | `PortfolioEntry` (`types.ts:20-30`); tabela `portfolio_entries` (`schema.sql:23-33`). |
| Discovery | Klient filtruje po mieście / typie eventu / stylu | `prd.md:50`, `prd.md:94` | `event_types`, `decoration_styles`, `city` + `fetchPublishedDecorators` (`discovery-query.ts:68-73`). |
| Moderator / Administrator | „Treści moderowane manualnie przez administratora” | `prd.md:64`, `prd.md:105` | `is_admin()` (`20260620130000_domain_rls.sql:3-10`); `ModerationStatus` (`types.ts:1`). |
| Opublikowany profil | Success: „opublikować profil z portfolio” | `prd.md:46` | `is_published` + Zod: description + contact_email (`profile-schema.ts:67-88`). **BRAK w kodzie** wymogu zdjęć portfolio przy publikacji. |
| Approved photo | NFR: treści portfolio moderowane przed lub po publikacji (TBD) | `prd.md:113` | Enum + filtr galerii `.eq("moderation_status", "approved")` (`d/[id].astro:35`). Default kolumny: `'approved'` (`schema.sql:31`). |
| Honeypot / rate limit | **BRAK w PRD** | — | `hasInquiryHoneypotContent` (`inquiry-abuse.ts` + `index.ts:34`); limiter 5/10 min (`inquiry-abuse.ts:1-2`). Pojęcia **techniczne**, nie biznesowe. |
| Booksy / rezerwacja | Insight „Instagram + Booksy” | `prd.md:22` | **BRAK w kodzie** (Non-Goals: brak kalendarza, `prd.md:135`). |

## 2. Subdomeny

| Obszar | Klasa | Uzasadnienie |
|--------|-------|--------------|
| Discovery + zapytanie kontaktowe (lead-gen) | **Core** | Success Criteria Primary + Business Logic: „wyszukiwanie → przegląd → zapytanie → dekorator otrzymuje lead” (`prd.md:46-53`, `prd.md:115-123`). Guardrail: brak płatności/czatu/kalendarza (`prd.md:62`). |
| Profil dekoratora + taksonomie (miasto, typ, styl) | **Core** (wspiera discovery) | Wejścia Business Logic (`prd.md:119`); bez opublikowanego profilu nie ma leada (RLS insert, `rls.sql:129-139`). |
| Portfolio + moderacja zdjęć | **Supporting** | FR-003/FR-008 i guardrail „treści moderowane” (`prd.md:64`). Nie jest mechanizmem leada; otwarte pytanie kiedy moderować (`prd.md:147`). |
| Auth dekoratora | **Generic** | FR-001; email+hasło, bez OAuth (`prd.md:130`). |
| Email transakcyjny (Resend) | **Generic** | Kanał dostawy leada; kod traktuje jako fail-soft (`inquiry-email.ts:31-49`). |
| Abuse (honeypot, limiter) | **Generic** | Brak w PRD; ochrona publicznego POST. |
| Płatności, czat, kalendarz, oceny, feed inspiracji | **Poza domeną MVP** | Non-Goals (`prd.md:132-142`). |

## 3. Kandydaci na agregaty i niezmienniki

| Kandydat (root) | Niezmiennik | Źródło | Status w kodzie |
|-----------------|-------------|--------|-----------------|
| **PublishedDecorator** | Zapytanie ląduje tylko na profilu `is_published = true`. | US-01 + FR-006; RLS comment path `rls.sql:129-139` | **Egzekwowany**: `submitPublishedInquiry` (`inquiry-submit.ts:27-38`) + RLS `contact_inquiries_insert_published_target`. |
| **ContactInquiry** | Formularz wymaga daty, opisu potrzeb, kontaktu; klient widzi potwierdzenie bez konta. | `prd.md:77-78` | **Egzekwowany** (Zod `inquiry-schema.ts`; honeypot 204). Email **deklarowany** w PRD (`prd.md:53`), w kodzie **fail-soft** (`inquiry-email.ts:31-49`; 201 mimo `sent: false`). |
| **DecoratorProfile** | Publikacja = kompletna wizytówka (PRD: profil **z** portfolio). | `prd.md:46` | **Częściowo**: Zod wymaga opisu + email (`profile-schema.ts:69-88`). Portfolio **ignorowane**. DB nie egzekwuje publish gate. |
| **PortfolioEntry** | Publiczna galeria pokazuje tylko zatwierdzone treści; admin moderuje ręcznie. | `prd.md:64`, `prd.md:113` | **Niespójnie**: galeria filtruje `approved` (`d/[id].astro:35`), ale INSERT **nie ustawia** `pending` (`portfolio/index.ts:73-83`), default SQL `'approved'` (`schema.sql:31`). |
| **InquiryInbox** | Dekorator widzi tylko własne zapytania. | FR-007; Access Control `prd.md:127` | **Egzekwowany**: RLS `select_own` (`rls.sql:123-127`) + filtr po własnym `profile.id`. |

## 4. MODEL vs KOD

| Dokument mówi | Kod robi | Dowód |
|---------------|----------|-------|
| Success: opublikować profil **z portfolio** | Można opublikować bez żadnego `portfolio_entries` | `profile-schema.ts:69-88` vs brak checka liczby zdjęć |
| Secondary: min. 5 zdjęć portfolio (walidacja rynku) | Brak limitu / asercji | `prd.md:57` — **BRAK w kodzie** |
| Dekorator otrzymuje zapytanie **emailem** i w panelu | Panel: insert; email fail-soft; HTTP 201 i tak | `prd.md:53`; `inquiry-submit.ts:59-65`; `inquiry-email.ts:42-49` |
| Moderacja treści (przed/po — TBD) | Nowe zdjęcie jest od razu `approved` | `schema.sql:31`; `portfolio/index.ts:73-83` |
| Ubiquitous „lead” | Encja `ContactInquiry`; brak `Lead` | `prd.md:123` vs `types.ts:32` |
| Persona „Organizator” | Tylko `client_*` | `prd.md:36` vs `types.ts:35` |
| NFR: doprecyzować timing moderacji | Default approved + filtr approved na public | `prd.md:147` vs `d/[id].astro:35` |
| Insight Booksy (rezerwacja) | Świadomy brak kalendarza | `prd.md:22` vs `prd.md:135` — zgodne z Non-Goals, nie z metaforą |

## 5. Ranking refaktoru

| # | Kandydat | Wartość (rdzeń) | Ryzyko (słaba egzekucja) |
|---|----------|-----------------|--------------------------|
| **1** | **PortfolioEntry / moderacja** | Supporting, ale guardrail PRD i FR-008 | Default `approved` + brak `pending` na INSERT = niezmiennik „gość widzi tylko zatwierdzone” jest trywialny do ominięcia (upload = public) |
| 2 | PublishedDecorator + zapytanie | Core lead-gen | Już w helperze + RLS po `inquiry-submit-extract`; pozostały dryf to fail-soft email (świadomy) |
| 3 | DecoratorProfile „kompletna oferta” | Core discovery | Publish bez portfolio rozjeżdża Success Criteria; tanie do dociągnięcia, nie łamie leada |
| 4 | Słownik Lead vs ContactInquiry | Język | Kosmetyka; nie zmienia reguł |

**#1 do refaktoru:** niezmiennik *„pozycja portfolio nie jest publiczna, dopóki administrator jej nie zatwierdzi”*. Jest jedynym guardrailem treści w PRD i dziś **deklarowanym w filtrze UI**, a **łamanym w schemacie i w POST**. Zapytanie→opublikowany profil jest ważniejsze biznesowo, ale już ma podwójną egzekucję (app + RLS).

## Podsumowanie

Artefakt mapuje język PRD na trzy tabele i typy w `src/types.ts`. Rdzeń to discovery + zapytanie na opublikowany profil. **Adnotacje „BRAK w kodzie”:** Organizator, typ `Lead`, wymóg portfolio przy publikacji, próg 5 zdjęć, status leada, Booksy/rezerwacja (celowo). Najcenniejsze rozjazdy: (1) default `moderation_status = approved`, (2) publish bez portfolio, (3) email leada fail-soft wobec „otrzymuje emailem”. #1 refaktoru = agregat-strażnik portfolio/moderacji, nie ponowny extract POST inquiries.
