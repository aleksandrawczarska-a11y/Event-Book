# Ryzyka testowalności — EventBook

**Data:** 2026-09-13  
**Projekt:** EventBook (Astro 6 SSR + React islands) — **nie** przykładowe repo `channels` / `platform` z lekcji.  
**Ćwiczenie:** 3 (testability risks z grafu zależności).  
**Narzędzie:** dependency-cruiser 18.2.0, config `.dependency-cruiser.cjs` (bez zmian). Grafu Graphviz/DOT **nie** generowano.

Źródło hotspotów: w repo **nie ma** `context/mapping/artifact-1-territory.md` ani `artifact-1-layer-boundaries.md`. Aktywne obszary wzięte z `context/foundation/test-plan.md` (hot-spot scope: `src`, `supabase`; ryzyka #1–#6) oraz z `context/mapping/artifact-1-frontend-cycles.md` (zero cykli, huby zamiast pętli).

Istniejące testy: Vitest `src/**/*.test.ts` (9 plików); Playwright `tests/e2e` dla ryzyka #1 i #3.

## Mapowanie ścieżek lekcja → EventBook

| Ścieżka z lekcji | Odpowiednik w EventBook |
|---|---|
| `admin_console` | `src/components/admin`, `src/pages/api/admin`, `src/pages/dashboard.astro` |
| `packages/utils` | `src/lib` |
| `actionions` | `src/pages/api` |
| `platform/client` | `src/layouts`, `src/middleware.ts`, `src/components/ui` |
| `platform/types` | `src/types.ts` |
| discovery / inquiry (north star) | `ContactInquiryForm`, `src/pages/api/inquiries`, `inquiry-*` |

---

## Podsumowanie

Graf TS/TSX jest płytki i jednokierunkowy: **zero cykli**. `npx depcruise src tests` kończy się:

```
✔ no dependency violations found (74 modules, 158 dependencies cruised)
```

To nie jest „cichy warn” — `circular modules 0`. Trudność izolacji nie pochodzi z pętli, tylko z **hubów o wysokim Ca** (dużo zależnych) i **kompozytorów o wysokim Ce** (ciągną wiele importów + klienta API + env platformy).

`npx depcruise src --include-only "^src" --output-type metrics` (Ca = fan-in / afferent, Ce = fan-out / efferent, I = Ce/(Ca+Ce)):

```
type    name                                                   N     Ca     Ce  I (%)
module  src/pages/api/inquiries/index.ts                       1      1      6    86%
module  src/components/decorator/ProfileForm.tsx               1      0      7   100%
module  src/lib/api-auth.ts                                    1      7      2    22%
folder  src/components/auth                                    6      8      2    20%
folder  src/lib                                               22     34      4    11%
folder  src/pages                                             12      0     30   100%
module  src/lib/api-error.ts                                   1     14      0     0%
module  src/lib/supabase.ts                                    1      7      0     0%
module  src/types.ts                                           1     15      0     0%
module  src/components/auth/ServerError.tsx                    1      7      0     0%
module  src/components/ui/button.tsx                           1      7      1    13%
module  src/middleware.ts                                      1      0      1   100%
module  src/components/discovery/ContactInquiryForm.tsx        1      0      4   100%
module  src/components/admin/ModerationQueue.tsx               1      0      4   100%
```

Jak czytać te liczby przy testach:

- **Wysokie Ce** (`inquiries/index.ts` Ce=6, `ProfileForm` Ce=7) — moduł trudno odpalić w izolacji; bez mocków wciąga klienta API, mail, abuse albo cały zestaw UI.
- **Wysokie Ca, Ce=0** (`types.ts` Ca=15, `api-error.ts` Ca=14) — tanie w izolacji (liście), drogie w kontrakcie: zmiana typu albo kształtu błędu rusza admin, inquiry i portfolio naraz.
- **Wysokie Ca + realne zależności** (`api-auth` Ca=7, Ce=2 → `supabase` + `api-error`; `supabase` Ca=7, `astro:env/server` + `@supabase/ssr`) — tu mock jest prawie pewny przy unicie, a polityka danych i tak wymaga integracji.

Ślepa plamka: w `.dependency-cruiser.cjs` `extensions` to tylko `.ts` / `.tsx` / `.d.ts`. **Strony i layouty `.astro` nie są w grafie**, a to one spinają north star i admin w runtime (`d/[id].astro`, `dashboard.astro`, `dashboard/inquiries.astro`, `search.astro`). Cruiser tego nie potwierdza.

---

## Lista ryzyk testowych

Każdy punkt: **gdzie**, **dlaczego izolacja boli**, **mock vs integracja vs e2e**, **które ryzyko z test-plan.md**.

### 1. `src/pages/api/inquiries/index.ts` — najgrubszy handler (Ce=6)

**Graf (cytat `--output-type text`):**

```
src/pages/api/inquiries/index.ts → src/lib/api-error.ts
src/pages/api/inquiries/index.ts → src/lib/inquiry-abuse.ts
src/pages/api/inquiries/index.ts → src/lib/inquiry-email.ts
src/pages/api/inquiries/index.ts → src/lib/inquiry-schema.ts
src/pages/api/inquiries/index.ts → src/lib/supabase.ts
src/pages/api/inquiries/index.ts → src/types.ts
```

Metrics: Ca=1 (to jest `index.test.ts`), Ce=6, I=86%. To jedyny handler z Ce>4.

Istniejący `index.test.ts` już mockuje **trzy** granice naraz: `@/lib/supabase`, `@/lib/inquiry-email`, `@/lib/inquiry-abuse`. To tani sygnał na gałęzie 503 / honeypot / walidację, ale **nie** na „lead jest w panelu dekoratora”.

| Warstwa | Co testować tutaj |
|---|---|
| **Mock** | `createClient`, `sendInquiryNotification`, ewentualnie `fetch` Resend. Nie mockować `parseInquiryBody` — to czysty zod, już ma własny unit. |
| **Integracja** | POST z prawdziwym klientem Supabase: insert do `contact_inquiries` tylko gdy profil jest `is_published=true`; 404 na nieopublikowany. To najtańszy dowód na risk **#3** (dostarczenie leada) i część **#5** (odrzut nie ląduje w tabeli). |
| **E2E** | Już jest `tests/e2e/inquiry-confirmation-reaches-decorator.spec.ts` (risk **#3**): formularz → potwierdzenie → panel. Nie dublować tego Vitestem „przez fetch”. |

Test-plan: **#3**, **#5** (i wejście do **#4**, bo insert bez ownership check po stronie POST — ownership jest przy odczycie panelu).

### 2. `src/lib/supabase.ts` — klient API / platforma (Ca=7)

Liść w grafie (Ce=0), ale ciągnie `@supabase/ssr`, `AstroCookies` i **`astro:env/server`** (`SUPABASE_URL`, `SUPABASE_KEY`). Dependents (JSON, bez `*.test.ts`): `api-auth`, `config-status`, `middleware`, `api/auth/{signin,signout,signup}`, `api/inquiries`.

Strony `.astro` (poza cruiserem) wołają `createClient` jeszcze w `dashboard.astro`, `dashboard/inquiries.astro`, `dashboard/profile.astro`, `dashboard/portfolio.astro`, `d/[id].astro`, `search.astro` — realny Ca jest wyższy niż 7.

| Warstwa | Co testować tutaj |
|---|---|
| **Mock** | `vi.mock("@/lib/supabase")` na granicy factory — tak już robią `api-auth.test.ts` i `inquiries/index.test.ts`. `isSupabaseConfigured` jest czystą funkcją: unit **bez** mocka. |
| **Integracja** | Jeden test z prawdziwym `createClient` + lokalnym Supabase (ciasteczko sesji). Nie opłaca się mockować `createServerClient` w środku pliku. |
| **E2E** | Nie testować factory. E2E woła runtime, który i tak buduje klienta. |

Bez tego mocka żaden unit handlera/middleware nie wstanie poza Astro + env.

### 3. `src/lib/api-auth.ts` — wspólna bramka admin/portfolio/profile (Ca=7, Ce=2)

```
src/lib/api-auth.ts → src/lib/api-error.ts
src/lib/api-auth.ts → src/lib/supabase.ts
```

Dependents (bez testów): `api/admin/portfolio/[id].ts`, trzy handlery `api/portfolio/*`, dwa `api/profile/*`. Inquiry POST **nie** idzie przez `api-auth` (gość). Metrics Ca=7 wlicza `api-auth.test.ts`.

Istniejący unit **mockuje supabase** i sprawdza fail-closed `app_metadata.role === "admin"` — to jest właściwy cheap test na risk **#2** (część „gate”).  
`api/admin/portfolio/[id].test.ts` mockuje już **całe** `requireAdmin` i stubuje query builder — to test walidacji statusu, **nie** testu „non-admin nie zapisze”.

| Warstwa | Co testować tutaj |
|---|---|
| **Mock** | `createClient` / `auth.getUser` przy unicie `requireAdmin` / `requireDecoratorProfile`. |
| **Integracja** | PATCH `/api/admin/portfolio/:id` z prawdziwą sesją non-admin → 403 **i** brak zmiany w DB. Nie mockować `requireAdmin`, jeśli celem jest risk **#2**. |
| **E2E** | Non-admin na `/dashboard` nie widzi kolejki; admin widzi. Naturalne, gdy zmiana dotyczy `locals.isAdmin` + `dashboard.astro` (poza grafem). |

Test-plan: **#2**.

### 4. `src/lib/inquiry-email.ts` — env platformy + HTTP na zewnątrz

Dependents: tylko `api/inquiries/index.ts`. Importuje `RESEND_*` z `astro:env/server` i woła `fetch("https://api.resend.com/emails")`.

Test-plan wprost: *„email is a separate channel”* — HTTP 200 ≠ dostarczony mail.

| Warstwa | Co testować tutaj |
|---|---|
| **Mock** | `fetch` albo cały moduł (jak dziś w `index.test.ts`). |
| **Integracja** | Nie celować w prawdziwy Resend. Ewentualnie stub HTTP na granicy `fetch`. |
| **E2E** | **Nie.** Risk **#3** ma być „lead w panelu”, nie skrzynka. |

### 5. `src/lib/inquiry-abuse.ts` — stan globalny izolatu (Ca=2)

Liść (Ce=0). Dependents: handler + własny test. W module siedzi `Map` (`inquiryRateLimitBuckets`) i licznik `callsSinceSweep` — **globalny stan procesu/izolatu**, nie importy. Unit jest tani dzięki `resetInquiryRateLimitBuckets()` (już używane w `inquiry-abuse.test.ts`).

Handler **mockuje** abuse, więc ścieżka 429 + „nie ma insertu” nie jest sprawdzona razem.

| Warstwa | Co testować tutaj |
|---|---|
| **Mock** | Nie potrzebny do honeypota / IP / limitu. Handler-test może mockować, ale wtedy gubi risk **#5**. |
| **Integracja** | POST bez mocka abuse: 6. request → 429 i brak nowego wiersza. `cf-connecting-ip`, nie `x-forwarded-for`. |
| **E2E** | Powódź w przeglądarce jest droga i flakowa (izolaty Workers). Zostawić poza e2e. |

Test-plan: **#5**.

### 6. `src/middleware.ts` — sesja i `PROTECTED_ROUTES` (Ce=1, Ca=0)

```
src/middleware.ts → src/lib/supabase.ts
```

Ca=0, bo Astro wstrzykuje middleware — cruiser nie widzi konsumentów. Ustawia `locals.user` i fail-closed `locals.isAdmin`, tnie `/dashboard*` do `/auth/signin`.

| Warstwa | Co testować tutaj |
|---|---|
| **Mock** | `createClient` + `getUser`, jeśli wyciągniemy czystą funkcję gate. Sam `defineMiddleware` wymaga runtime Astro. |
| **Integracja** | Request na `/dashboard` i `/dashboard/inquiries` bez ciasteczka → 302 sign-in. Request z userem non-admin: `isAdmin===false` (kolejka nie renderuje się w `dashboard.astro`). |
| **E2E** | Naturalne przy zmianie listy `PROTECTED_ROUTES` albo semantyki roli. Risk **#2**. |

### 7. `src/components/discovery/ContactInquiryForm.tsx` — island north star (Ce=4)

```
src/components/discovery/ContactInquiryForm.tsx → src/components/auth/FormField.tsx
src/components/discovery/ContactInquiryForm.tsx → src/components/auth/ServerError.tsx
src/components/discovery/ContactInquiryForm.tsx → src/components/ui/button.tsx
src/components/discovery/ContactInquiryForm.tsx → src/lib/api-error.ts
```

Nie importuje `inquiry-schema` / `inquiry-abuse` (walidacja i limit zostają na serwerze). W runtime woła `fetch("/api/inquiries")`. Honeypot 204 jest **celowo nieodróżnialny od sukcesu** — izolowany test UI, który assercjuje „potwierdzenie = zapis”, skłamie przy spamcie.

| Warstwa | Co testować tutaj |
|---|---|
| **Mock** | `fetch` przy teście islandy (komunikaty `VALIDATION_FAILED`). Nie mockować `api-error` (to typ). |
| **Integracja** | Nie składać formularza React + handler w jsdom — za drogo względem e2e. |
| **E2E** | Już risk **#3**. Przy zmianie etykiet pól Playwright padnie (locatory `getByRole`). |

### 8. `src/pages/d/[id].astro` — poza grafem; publiczny profil + filtr approved

Ręczny skład (cruiser nie widzi): `Layout` + `Topbar` + `ContactInquiryForm` + `createClient` + `storage-url` / `profile-photo` + filtr `moderation_status = "approved"` i `is_published = true`.

To jest miejsce, w którym risk **#1** i część **#6** (nieopublikowany profil → 404) materializują się dla gościa. Query siedzi w stronie, nie w `lib`.

| Warstwa | Co testować tutaj |
|---|---|
| **Mock** | Słaby sygnał (skopiowana query jako wyrocznia — anti-pattern z test-plan). |
| **Integracja** | Odczyt profilu: pending/rejected nie wracają; `is_published=false` → 404. |
| **E2E** | Już `tests/e2e/guest-hidden-portfolio.spec.ts` (risk **#1**). Naturalny koniec, gdy zmiana dotyczy HTML galerii / SSR. |

### 9. `src/pages/dashboard.astro` + `ModerationQueue.tsx` — admin_console poza grafem

`dashboard.astro` (poza cruiserem) składa `locals.isAdmin` + `createClient` + `moderation-queue` + `ModerationQueue`. Island:

```
src/components/admin/ModerationQueue.tsx → src/components/auth/ServerError.tsx
src/components/admin/ModerationQueue.tsx → src/components/ui/button.tsx
src/components/admin/ModerationQueue.tsx → src/lib/api-error.ts
src/components/admin/ModerationQueue.tsx → src/types.ts
```

Ce=4, Ca=0. Fetch na `PATCH /api/admin/portfolio/:id`. Parser statusu (`moderation-queue.ts`, Ca=1, Ce=1 → tylko `types`) jest już unitem — **nie** wymaga mocka.

| Warstwa | Co testować tutaj |
|---|---|
| **Mock** | `fetch` w islandzie; `requireAdmin` tylko gdy testujesz walidację body, nie gate. |
| **Integracja** | Non-admin: brak wierszy pending w HTML + PATCH 403 (risk **#2**). Guest public view nie używa tej strony. |
| **E2E** | Gdy zmiana spina kolejkę UI + zapis statusu + to, co gość widzi na `/d/[id]` (mostek **#2 → #1**). Osobnego e2e #2 jeszcze nie ma. |

### 10. `src/pages/dashboard/inquiries.astro` — odczyt leada / ownership (poza grafem)

Tylko `createClient` + `types.ContactInquiry`. Filtr: `user.id` → `decorator_profiles.id` → `contact_inquiries.decorator_profile_id`. Brak osobnego helpera w `lib` — polityka żyje w stronie + RLS.

| Warstwa | Co testować tutaj |
|---|---|
| **Mock** | Nie — mock query ukryje RLS (anti-pattern test-plan: *„Mocking away the data-access policy”*). |
| **Integracja** | Dekorator A nie dostaje wierszy dekoratora B (risk **#4**). Najtańsza warstwa wg planu. |
| **E2E** | Naturalne tylko gdy zmieniamy chrome panelu albo logowanie do asercji #4. Dziś e2e #3 już wchodzi na ten URL po stronie „właściciela”. |

### 11. `src/pages/search.astro` + `src/lib/discovery-query.ts` — unpublished supply

`discovery-query.ts`: Ca=1, Ce=2 (`decorator-taxonomy`, `types`), I=67%. Parser filtrów jest czysty (już unit). `fetchPublishedDecorators` przyjmuje `SupabaseClient` — `discovery-query.test.ts` stubuje klienta, nie woła sieci.

`search.astro` (poza grafem) skleja `createClient` + `fetchPublishedDecorators` + `profile-photo`.

| Warstwa | Co testować tutaj |
|---|---|
| **Mock** | Stub `SupabaseClient` przy budowie query (już jest). |
| **Integracja** | Nieopublikowany profil nie wraca z prawdziwego PostgREST (risk **#6**). Nie używać pustej listy jako wyroczni „filtr działa”. |
| **E2E** | Tylko jeśli zmiana dotyczy HTML wyników / pustego stanu, którego integracja nie widzi. Plan: *nie* snapshotować całego search. |

### 12. `src/types.ts` i `src/lib/api-error.ts` — huby kontraktu, nie izolacji

`types.ts` Ca=15, Ce=0; `api-error.ts` Ca=14, Ce=0. JSON dependents `types` (bez testów): admin island, cztery islandy decorator, `discovery-query`, `inquiry-email`, `moderation-queue`, admin API, inquiry API, portfolio/profile API.

To odpowiednik `platform/types`. **Nie mockować.** Unit nie jest trudny — trudna jest szerokość zmiany (`ModerationStatus`, `ContactInquiry`, `DecoratorProfile.is_published`). Po zmianie kontraktu odpalic testy #1–#6, które ten kształt czytają, zamiast pisać „test typów”.

### 13. Shared UI `components/auth` + `components/ui` (Ca wysokie, logika niska)

`ServerError` Ca=7, `FormField` Ca=5, `button` Ca=7, folder `auth` I=20%. Używają ich admin, discovery i decorator — jak wspólne kontrolki z lekcji, tylko bez cyklu.

| Warstwa | Co testować tutaj |
|---|---|
| **Mock** | Nie. To liście UI (`utils` / lucide). |
| **Integracja** | Nieopłacalne. |
| **E2E** | Przy zmianie `label` / `id` w `FormField` padają locatory e2e #3. To koszt sprzężenia, nie powód do osobnego e2e auth. |

---

## Najbardziej podejrzane moduły

Posortowane po koszcie izolacji (Ce + platforma + stan), nie po samym Ca.

| Moduł | Ca | Ce | I | Dlaczego izolacja boli | Rekomendacja |
|---|---:|---:|---:|---|---|
| `src/pages/api/inquiries/index.ts` | 1 | **6** | 86% | Składa abuse + email + schema + supabase + types. Już 3 mocki w teście. | Integracja persistencji (#3/#5); mock tylko mail/env; e2e już jest (#3). |
| `src/lib/supabase.ts` | **7** | 0 | 0% | `astro:env/server` + `@supabase/ssr` + cookies. Ukryty Ca z `.astro`. | Mock factory w unitach; jedna integracja prawdziwego klienta. |
| `src/lib/api-auth.ts` | **7** | 2 | 22% | Jedyna bramka 6 handlerów; ciągnie supabase. | Unit z mockiem klienta (#2); integracja PATCH bez mocka gate. |
| `src/lib/inquiry-email.ts` | 1 | 1 | 50% | Env Resend + HTTP. | Zawsze mock; nigdy e2e. |
| `src/lib/inquiry-abuse.ts` | 2 | 0 | 0% | Globalny `Map` izolatu, nie graf. | Unit z `reset*`; integracja 429 na handlerze bez mocka. |
| `src/middleware.ts` | 0 | 1 | 100% | Framework-owned; `locals` + redirect. | Integracja/e2e redirectu `/dashboard` (#2). |
| `ContactInquiryForm.tsx` | 0 | 4 | 100% | `fetch` + shared auth UI; 204≡sukces. | Mock `fetch` tylko na UX błędów; happy-path = e2e #3. |
| `ModerationQueue.tsx` | 0 | 4 | 100% | `fetch` admin API + `types.ModerationStatus`. | Mock `fetch` islandy; gate = integracja #2. |
| `src/pages/d/[id].astro` | — | — | — | Poza grafem; query approved/published + island lead. | Integracja query; e2e #1 już jest. |
| `dashboard.astro` / `dashboard/inquiries.astro` | — | — | — | Poza grafem; `locals` + supabase + RLS. | Integracja #2/#4; e2e gdy spina UI. |
| `src/types.ts` | **15** | 0 | 0% | Nie boli test, boli ripple kontraktu. | Nie mockować; regresja przez testy #1–#6. |
| `src/lib/api-error.ts` | **14** | 0 | 0% | Wspólny kształt błędu API↔UI. | Nie mockować. |
| `ProfileForm.tsx` | 0 | **7** | 100% | Najwyższe Ce islandy (auth+avatar+utils+types). | Poza top-6 ryzyk; mock `fetch` gdy ruszamy onboarding. |
| `discovery-query.ts` | 1 | 2 | 67% | Czysty parser + klient w argumencie. | Unit parsera (jest); integracja unpublished (#6). |

Folder `src/lib` jako całość: Ca=34, Ce=4, I=11% — dno stosu, tanie w kierunku importów, drogie gdy ruszamy `supabase` / `api-error` / `api-auth`. Folder `src/pages`: Ca=0, Ce=30, I=100% — same wychodzące, zgodnie z warstwą `actionions`.

---

## Co sprawdzić dalej

1. **Nie rysować całego repo.** Zero cykli; pełny SVG nic nie doda do testowalności. Jeden fragment — patrz sekcja poniżej.
2. **Ślepa plamka `.astro`.** Ręcznie trzymać w głowie `d/[id].astro`, `search.astro`, `dashboard.astro`, `dashboard/inquiries.astro`. One wołają `createClient` i realizują #1/#4/#6, a cruiser ich nie liczy w Ca.
3. **Rozjazd mock vs risk #2.** `api-auth.test.ts` mockuje supabase (OK). `[id].test.ts` mockuje `requireAdmin` (OK na walidację statusu, **za mało** na „non-admin nie zapisze”). Brakuje integracji PATCH + DB.
4. **Rozjazd mock vs risk #5.** Handler-test mockuje abuse. Unit abuse jest izolowany. Brak mostka: 429 ⇒ brak insertu.
5. **Risk #4** nie ma taniego testu w `src/**/*.test.ts`. Polityka jest w `dashboard/inquiries.astro` + RLS — to kandydat na fazę 2 test-plan (integracja, nie mock).
6. **Risk #6** ma unit parsera/query buildera; brak potwierdzenia na prawdziwym `is_published`.
7. **Nie wciągać `inquiry-schema` do `ContactInquiryForm`** „żeby mieć te same komunikaty” — pierwszy krok do cyklu UI↔API i do podwójnej wyroczni.
8. **Nie importować z `lib` do `types.ts`.** Dziś Ce=0; pierwszy import zamienia hub kontraktu w kandydat na cykl.
9. Config committed: nie podnosić `no-circular` i nie dopisywać `.astro` do `extensions` w tym kroku (one-off ewentualnie później, bez commita).

---

## Opcjonalny kolejny krok: graf

**Nie renderować teraz.** Wybrać **jeden** fragment ryzyka testowego — nie cykl (cykli nie ma) i nie cały `src`.

Rekomendacja: **north-star inquiry** (najwyższe Ce + klient API + env + stan globalny + już istniejące mocki i e2e #3):

- `src/components/discovery/ContactInquiryForm.tsx`
- `src/pages/api/inquiries/index.ts`
- `src/lib/inquiry-abuse.ts`
- `src/lib/inquiry-email.ts`
- `src/lib/inquiry-schema.ts`
- `src/lib/supabase.ts`
- `src/lib/api-error.ts`
- `src/types.ts`

To pokaże w jednym obrazku: liście tanie w unicie (`inquiry-schema`, `api-error`, `types`), mock-granice (`supabase`, `inquiry-email`), stan izolatu (`inquiry-abuse`) i kompozytor, który bez integracji kłamie (`inquiries/index.ts`). `dashboard/inquiries.astro` i `d/[id].astro` i tak nie wejdą, dopóki cruiser nie dostanie `.astro` — nie dodawać tego w committed config tylko po to, by narysować stronę.

Alternatywy **nie** polecane jako pierwszy SVG: cały `src/lib` (huby bez historii testowej), pełny `src/pages` (Ce=30, szum auth/portfolio), cykl (nie istnieje).
