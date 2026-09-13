# Analiza granic warstw — EventBook

**Data:** 2026-09-13  
**Projekt:** EventBook (Astro 6 SSR + React islands) — **nie** przykładowe repo `channels` / `platform` z lekcji.  
**Narzędzie:** dependency-cruiser 18.2.0, config `.dependency-cruiser.cjs` (bez zmian w commicie). Grafu Graphviz/DOT nie generowano.  
**Źródło hotspotów:** w repo **nie ma** `context/mapping/artifact-1-territory.md`. Terytorium wzięte z `context/foundation/test-plan.md` (hot-spot: `src`, `supabase`; churn admin/visibility + north-star inquiry), slice’ów F-01 i S-01–S-04 w `context/foundation/roadmap.md` oraz `context/mapping/artifact-1-frontend-cycles.md`.

## Mapowanie warstw lekcja → EventBook

| Lekcja | EventBook | Rola |
|---|---|---|
| `platform/types` (fundament) | `src/types.ts` | nie może importować pages, components ani lib |
| `platform/client` (poniżej feature’ów) | `src/lib`, `src/layouts`, `src/components/ui`, `src/middleware.ts` | wspólne usługi, shell, prymitywy UI |
| `channels/src` (feature’y) | `src/pages`, `src/pages/api`, `src/components/{admin,discovery,decorator,auth}` | strony, handlery, islandy domenowe |

Zakazane / zaskakujące kierunki: `types` → lib/components/pages; `lib` → components/pages/layouts; `ui` → foldery feature albo pages; `middleware` → pages albo islandy feature; feature A → feature B (admin ↔ discovery ↔ decorator) poza `lib` / `types` / `ui` / auth-jako-wspólne-formularze; page → inna page.

Odpowiedniki territory z lekcji (`admin_console`, `packages`, `client`, `types`):

| Territory (lekcja) | EventBook |
|---|---|
| `admin_console` | `src/components/admin`, `src/pages/api/admin`, `src/pages/dashboard.astro` |
| `packages` | `src/lib` (współdzielone serwisy) |
| `client` | `src/pages`, `src/layouts`, islandy w `src/components/*` |
| `types` | `src/types.ts` |

## Kluczowe obserwacje

1. **Zakazane kierunki w grafie TS/TSX są puste.** `types.ts` nic nie importuje z `src`. `src/lib` nie sięga do components/pages/layouts. `ui` i `middleware` nie wchodzą w feature’y ani strony. Feature A nie importuje feature B. Page `.ts` nie importuje innej page. Miejsca, które się najczęściej zmieniają (dashboard, discovery, `api-auth`, `discovery-query`), idą **w dół** — do `lib` / `types` / `ui` / auth-jako-formularze — a nie w bok.

2. **`✔ no dependency violations found` z committowanego configu nie jest werdyktem o warstwach.** Domyślne reguły to m.in. `no-circular`, orphans, unresolved. Warstw EventBook tam nie ma. Werdykt poniżej pochodzi z `--focus` / `--include-only` / `--reaches` i z ręcznego grep `.astro`.

3. **Koszt zmiany siedzi w hubach, nie w wyciekach warstw.** Metrics: `src/types.ts` Ca=15 Ce=0; `src/lib/api-error.ts` Ca=14 Ce=0; `src/lib` jako folder I=11%; `src/pages` I=100% (same wychodzące). Zmiana `ModerationStatus` albo `jsonError` uderza w admin, inquiry i portfolio naraz — przewidywalnie, bez zaskakującego importu wstecz.

4. **Jedyny „miękki” wyjątek to `components/auth` jako zestaw pól.** `FormField` (Ca=5) i `ServerError` (Ca=7) są używane przez admin, decorator i discovery. To jest **dozwolone** mapowaniem, ale zaskoczy kogoś, kto traktuje folder `auth` jako „tylko logowanie”. Auth sam nic nie wie o feature’ach.

5. **Ślepa plamka `.astro`.** W `.dependency-cruiser.cjs` `extensions` to tylko `.ts` / `.tsx` / `.d.ts`. Layouty, strony i `Topbar` / `Banner` / `Welcome` nie są w grafie. Najgorętszy plik 90d — `src/pages/dashboard.astro` (7 commitów) — cruiser w ogóle nie widzi. Ręczny grep: nadal jednokierunkowo (page → layout / lib / island / types).

## Wyniki per granica

| Sprawdzana granica | Wynik | Dowód z dependency-cruiser | Dlaczego to ważne przy zmianie | Związek z artifact-1-territory.md (tu: test-plan + roadmap + artifact-1-frontend-cycles.md) | Co sprawdzić dalej |
|---|---|---|---|---|---|
| `src/types.ts` nie importuje lib / components / pages | **Trzyma się.** Czysty liść, największy Ca w repo. Brak krawędzi wychodzących. | `npx depcruise src/types.ts --include-only "^(src)" --output-type text` → **puste stdout**. `--focus "^src/types"` pokazuje wyłącznie *wchodzące*: `ModerationQueue`, `Portfolio*`, `Profile*`, `discovery-query`, `inquiry-email`, `moderation-queue`, `pages/api/{admin,inquiries,portfolio,profile}` → `src/types.ts`. Metrics: `src/types.ts` N=1, Ca=15, Ce=0, I=0%. | To odpowiednik `platform/types`. Gdyby types zaczęły importować zod ze schematów w `lib` albo DTO ze strony, każdy slice (profil, lead, moderacja) wpadłby w pętlę types ↔ reszta. Dziś zmiana kontraktu jest szeroka, ale **lokalna w jednym pliku**. | Territory `types`. Cycles: ten sam hub Ca=15. Test-plan risk #1–#6 i roadmap S-01–S-04 dzielą `DecoratorProfile` / `PortfolioEntry` / `ContactInquiry` / `ModerationStatus`. | Nie wciągać `lib/*` do `types.ts`. Rozważyć podział per bounded context dopiero gdy Ce > 0 (stałe, funkcje, schema). |
| `src/lib` nie importuje components / pages / layouts | **Trzyma się.** Lib jest środkiem stosu i dnem dla UI. `--reaches` z lib do warstw UI jest pusty. | `npx depcruise src/lib --include-only "^(src)" --reaches "^src/(components\|pages\|layouts)" --output-type text` → **puste stdout**. `--focus "^src/lib"`: wychodzące z lib to tylko `lib → lib` albo `lib → types` (`api-auth` → `api-error` + `supabase`; `discovery-query` / `profile-schema` → `decorator-taxonomy`; `inquiry-email` / `moderation-queue` → `types`). Metrics: folder `src/lib` Ca=34, Ce=4, I=11%. | W legacy `packages`/`utils` często zamykają cykl z UI. Tu zmiana helpera nie pociąga islandy ani strony — ale zmiana **kontraktu** `api-error` / `api-auth` / `supabase` rusza admin API, inquiry API i middleware naraz. | Territory `packages`. Test-plan #2: hot-spot `src/lib` + `src/pages` (admin gate). #3/#5: `inquiry-*`. Roadmap S-02: `discovery-query` (3 commity/90d, jak `api-auth` i `profile-schema`). Cycles: „lib nie wraca do pages/components”. | Nowy helper w `lib` nie może importować React / `@/components` / `@/pages`. `inquiry-schema` ma zostać na serwerze — nie iść do islandy „dla tych samych komunikatów” bez decyzji. |
| `src/components/ui` nie importuje feature’ów ani pages | **Trzyma się.** Jedyny widoczny moduł UI (`button.tsx`) idzie wyłącznie do `lib/utils`. Feature’y przychodzą do UI, nie odwrotnie. | `--focus "^src/components/ui"`: `button.tsx → src/lib/utils.ts`; krawędzie *do* buttona z `ModerationQueue`, `SubmitButton`, `Portfolio*`, `Profile*`, `ContactInquiryForm`. Metrics: `src/components/ui` Ca=7, Ce=1, I=13%. `LibBadge.astro` (poza cruiserem) nie ma importów. | Prymityw UI jest tani w zmianie wyglądu i drogi tylko przez `cn`/`utils`. Gdyby `button` zaimportował `ModerationQueue` albo stronę dashboardu, każda zmiana kolejki psułaby cały design system. | Territory `client` (wspólna skorupa). Cycles: `button` Ca=7, to samo dno UI. Roadmap S-01/S-04 dzielą ten przycisk między onboarding i moderację. | Nie dodawać domeny do `ui/`. `LibBadge.astro` zostawić liściem. Jeśli `FormField` urośnie o logikę domenową, wynieść go do `ui` albo `forms` *zanim* auth zacznie zależeć od discovery/admin. |
| `src/middleware.ts` nie importuje pages ani feature components | **Trzyma się.** Middleware jest cienkie: tylko klient Supabase. | `--focus "^src/middleware"`: jedyna krawędź `src/middleware.ts → src/lib/supabase.ts`. Metrics: Ce=1, Ca=0, I=100%. Grep: `defineMiddleware` + `createClient` z `@/lib/supabase` — nic z `@/pages` ani `@/components`. | Guard, który importuje dashboard, to klasyczny cykl legacy (page ↔ middleware). Tu nowa ścieżka chroniona idzie do `PROTECTED_ROUTES` i `locals.user` / `isAdmin`, nie do importu strony. Zmiana sesji i tak uderza szeroko przez hub `supabase` (Ca=7), ale kierunek jest przewidywalny. | Test-plan #2 (admin gate, fail-closed). Cycles: middleware = `platform/src`. Churn 90d: `middleware.ts` — 3 commity, obok `dashboard.astro` i `api-auth`. | Nie importować stron z middleware. `config-status` (używany przez `Layout.astro`, poza grafem) musi zostać liściem — gdyby zaczął importować layout/page, powstałby cykl SSR. |
| Feature A ↛ feature B (admin ↔ discovery ↔ decorator), wyjątek: auth jako wspólne formularze | **Trzyma się, z dozwolonym sprzężeniem przez auth.** Wewnątrz feature’ów tylko decorator → własne islandy. Zero krawędzi admin↔discovery↔decorator. | `--include-only "^(src/components/(admin\|discovery\|decorator))"`: tylko `PortfolioPanel → PortfolioEntryForm` i `ProfileForm → ProfileAvatarUpload`. `--reaches` na te foldery: ten sam zestaw intra-decorator. `--focus "^src/components/auth"`: `ModerationQueue → ServerError`; `PortfolioEntryForm` / `ProfileForm` / `ContactInquiryForm` → `FormField` + `ServerError`; auth sam → `ui/button` + `lib/utils`. Grep `@/components/(admin\|discovery\|decorator)` w components: wyłącznie intra-decorator. | Izolacja feature’ów znaczy, że zmiana kolejki moderacji (S-04) nie przebudowuje formularza leada (S-03) i odwrotnie. Wyjątek auth jest świadomy: zmiana `FormField` / `ServerError` *jednocześnie* rusza logowanie, profil, portfolio i lead — jak hub, tylko w UI. Gdyby `ModerationQueue` zaimportował `PortfolioPanel` „dla podglądu zdjęcia”, admin i decorator przestałyby być niezależne. | Territory `admin_console` vs reszta `channels/src`. Test-plan #1/#2 = admin; #3/#5 = discovery/inquiry; roadmap S-01 = decorator. Cycles: „trzy foldery dzielą auth jako zestaw pól”; ostrzeżenie przed `ModerationQueue → decorator/PortfolioPanel`. Churn: `PortfolioPanel.tsx` 3/90d. | `ModerationQueue` nie importuje `decorator/*`. Islandy nie importują `@/pages/*`. Gdy `FormField` zbierze domenę — wynieść go, zanim auth zaimportuje discovery/admin (to byłby pierwszy prawdziwy cykl w gorących UI). |
| Page nie importuje innej page | **Trzyma się** w `.ts` (cruiser) i w `.astro` (grep). API → tylko `lib` + `types`. Strony Astro składają layout + island + lib, nigdy inną page. | `--include-only "^(src/pages)"`: tylko test → handler (`api/admin/portfolio/[id].test.ts → [id].ts`, `api/inquiries/index.test.ts → index.ts`). Pełny `text` na `src`: żaden `pages/*.ts` nie wskazuje innego `pages/*`. Grep `from "@/pages/` w `src/pages` i `src/components`: **brak**. Metrics: folder `src/pages` Ca=0, Ce=30, I=100%. | W legacy page↔page znaczy „nie da się ruszyć URL-a bez drugiej strony”. Tu przeniesienie `/dashboard` albo `/d/[id]` nie ciągnie sąsiada. Składanie jest dozwolone *w dół*: `dashboard.astro` → `ModerationQueue` + `moderation-queue` + `types`; `d/[id].astro` → `ContactInquiryForm` + `profile-schema` + `storage-url`. To kompozycja w warstwie page, nie wyciek feature↔feature. | Territory `client`. Test-plan #1: `src/pages` + `src/components` (widoczność). #2: admin API. Roadmap S-03: `api/inquiries` + `d/[id].astro`. Churn 90d: `dashboard.astro` **7**, `dashboard/profile.astro` **4**, `d/[id].astro` **3**, `api/profile` / `api/portfolio` **3** — te pliki są poza grafem cruiser, ale grep pokazuje ten sam kierunek co API. Cycles: `dashboard.astro` = admin + lib w runtime. | Dodać `.astro` do one-off skanu (flaga CLI / temp config, bez commita). Upewnić się, że nowa strona nie robi `import X from "@/pages/other"`. `search.astro` → `discovery-query` ma zostać jedynym mostem discovery SSR, nie importem z `d/[id].astro`. |

## Ślepa plamka `.astro` (uzupełnienie poza cruiserem)

Config: `enhancedResolveOptions.extensions = [".ts", ".tsx", ".d.ts"]`. Cruise `src --include-only "^(src)"` widzi **50 modułów / 88 krawędzi** — bez layoutów i stron.

Ręczny grep importów w `.astro` (kierunek nadal dozwolony):

| Plik | Importuje | Ocena |
|---|---|---|
| `pages/dashboard.astro` (7 commitów/90d) | `DashboardLayout`, `admin/ModerationQueue`, `lib/moderation-queue`, `lib/storage-url`, `lib/supabase`, `types` | page → client + jeden feature + packages + types |
| `pages/dashboard/profile.astro` | `DashboardLayout`, `decorator/ProfileForm`, taxonomy, `profile-photo`, `supabase`, `types` | j.w., feature decorator |
| `pages/dashboard/portfolio.astro` | `DashboardLayout`, `decorator/PortfolioPanel`, `storage-url`, `supabase`, `types` | j.w. |
| `pages/dashboard/inquiries.astro` | `DashboardLayout`, `supabase`, `types` | page bez islandy discovery/admin |
| `pages/d/[id].astro` | `Layout`, `Topbar`, `discovery/ContactInquiryForm`, `supabase`, `profile-schema`, `profile-photo`, `storage-url`, `types` | north-star S-03: page → discovery + lib |
| `pages/search.astro` | `Layout`, `Topbar`, `supabase`, `profile-photo`, `discovery-query` | S-02: page → lib, bez islandy discovery |
| `pages/auth/*` | `Layout` + `SignInForm` / `SignUpForm` | page → auth (własny feature) |
| `layouts/Layout.astro` | `Banner`, `lib/config-status` | client → shared shell + lib |
| `layouts/DashboardLayout.astro` | `Layout.astro` | layout → layout |
| `Welcome.astro` | `Topbar` | shared shell, nie feature folder |

Brak: page → page, layout → feature admin/discovery/decorator, `ui` → pages.

## Jak czytać ten wynik

Często zmieniane miejsca **używają warstw przewidywalnie**. Nie ma importu, który przy zmianie admina nagle wciąga discovery, albo helpera z `lib`, który ciągnie islandę. Zaskoczenie przy zmianie będzie inne: **szerokość hubów** (`types`, `api-error`, `api-auth`/`supabase`, `auth/FormField`) i fakt, że najgorętsze pliki są `.astro` i nie wchodzą do cruiser.

Domyślny `npx depcruise src --include-only "^(src)" --output-type err-long`:

```
✔ no dependency violations found (50 modules, 88 dependencies cruised)
```

To potwierdza brak cykli / unresolved — **nie** to, że config egzekwuje warstwy. Warstwy są dziś konwencją, widoczną w `--focus` / `--reaches` / grep.

Następny sensowny krok kursowy: pilnować kierunku przy kolejnym slice (szczególnie żeby `types` i `lib` nie zaczęły iść w górę) oraz one-off skan `.astro`, bez rysowania grafu całego repo i bez zmiany committowanego configu.
