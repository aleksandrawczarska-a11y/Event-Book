# Artefakt 2 — Struktura (graf zależności)

**Data:** 2026-09-13  
**Projekt:** EventBook (Astro 6 SSR + React islands) — **nie** przykładowe repo `channels` / `platform` z lekcji.  
**Ćwiczenie:** Wide Scan 2/3 — pytanie przewodnie: **co realnie zależy od czego?**

To jest skrót pomocniczy z trzech analiz sesji (cykle, granice warstw, ryzyka testowe). Nie ma `artifact-1-territory.md` — aktywne obszary wzięte z `context/foundation/test-plan.md` (ryzyka #1–#6, hot-spot `src` + `supabase`) oraz slice’ów F-01 i S-01–S-04 w `context/foundation/roadmap.md`.

## Zakres skanu

| | |
|---|---|
| Narzędzie | dependency-cruiser **18.2.0** |
| Config | `.dependency-cruiser.cjs` (reguła `no-circular` = `warn`; warstw EventBook **nie** ma w `forbidden`) |
| Resolve | `tsconfig.json`; `enhancedResolveOptions.extensions` = `.ts` / `.tsx` / `.d.ts` |
| Aktywny analog `channels` / `platform` | `src` + `tests` |
| Wykluczenia | `node_modules` (`doNotFollow`); strony, layouty i shell `.astro` **poza grafem** |
| Testy | **były skanowane** (`npm run depcruise` = `depcruise src tests`). To nie jest opcjonalny skip — 74/158 zawiera `*.test.ts` |

**Metryki z grafu** (Ca = fan-in / afferent, Ce = fan-out / efferent, I = Ce/(Ca+Ce)):

| Zakres | Moduły | Krawędzie | Cykle | Naruszenia |
|---|---:|---:|---:|---|
| `src` + `tests` | 74 | 158 | **0** | **0** (`✔ no dependency violations found`) |
| `src` only (`--include-only "^(src)"`) | 50 | 88 | **0** | **0** |

JSON: `circular modules 0`. To nie jest „cichy warn” — graf TS/TSX jest DAG-iem. Grafu Graphviz/DOT **nie** generowano.

---

## TL;DR

1. **Cykle: zero.** 74 moduły / 158 krawędzi (`src` + `tests`) i 50 / 88 (`src`) — `circular modules 0`, zero naruszeń committowanego configu. Koszt zmiany nie idzie od pętli.

2. **Granice warstw trzymają się.** `types.ts` jest fundamentem (Ce=0). `lib` jest poniżej feature’ów i nie importuje components/pages. Feature A ↛ feature B. Page ↛ page. Zakazane kierunki w grafie TS/TSX są puste.

3. **Najbardziej obciążony plik: `src/types.ts` (Ca=15, Ce=0).** Drugi hub to `src/lib/api-error.ts` (Ca=14). Zmiana `ModerationStatus` / `ContactInquiry` / `DecoratorProfile` albo kształtu `jsonError` uderza w admin, inquiry i portfolio naraz — szeroko, ale lokalnie w jednym liściu.

4. **Najbardziej obciążony obszar: `src/lib` (folder Ca=34, Ce=4, I=11%).** Dno stosu: tanie w kierunku importów, drogie w kontrakcie (`api-error`, `api-auth` Ca=7, `supabase` Ca=7). Folder `src/pages` jest odwrotnością: Ca=0, Ce=30, I=100% — same wychodzące.

5. **Zaskakujący orchestrator to nie cykl, tylko kompozycja poza grafem + jeden gruby handler.** `dashboard.astro` (poza cruiserem) składa admin + `moderation-queue` + `supabase` + `locals.isAdmin`. `src/pages/api/inquiries/index.ts` (Ce=6) składa abuse + email + schema + supabase + types — jedyny handler z Ce>4. Islandowy rekord Ce to `ProfileForm` (Ce=7), poza top-6 ryzyk test-plan.

---

## 1. Cykle w aktywnych obszarach

**Werdykt: 0 cykli, 0 naruszeń.** Nie wymyślono pętli. Ryzyko przy zmianie to **huby** (wysokie Ca), nie pierścienie.

| Obszar | Cykle | Dowód | Dlaczego ważne | Związek z art. 1 |
|---|---:|---|---|---|
| `src` + `tests` (cały aktywny skan) | **0** | `✔ no dependency violations found (74 modules, 158 dependencies cruised)`; JSON `circular modules 0` | W legacy cykl = zmiana w jednym miejscu przebudowuje pierścień. Tu tego pierścienia nie ma. | Cykle: obs. 1. Territory z test-plan (brak `artifact-1-territory.md`). |
| `src/lib` | **0** | `--focus "^src/lib"`: tylko `lib → lib` / `lib → types`. `--reaches` z lib do components/pages/layouts = puste. Folder Ca=34, Ce=4, I=11%. | `utils` w starym monolicie często zamyka cykl z UI. Tu lib jest dnem — zmiana kontraktu `api-error` / `supabase` rusza admin, inquiry i middleware, ale **w dół**, nie w pętli. | Cykle + granice: „lib nie wraca do pages/components”. Test-plan #2, #3, #5. |
| `src/pages` + `src/pages/api` | **0** (to, co cruiser widzi: handlery `.ts`) | `--include-only "^(src/pages)"`: tylko test → handler. Folder Ca=0, Ce=30, I=100%. Strony `.astro` **poza grafem**. | Jednokierunkowe API jest zdrowe. Cykl page↔service jeszcze nie istnieje — o ile Astro zostanie jednokierunkowe. | Cykle: dashboard / `d/[id]` składają obszary w runtime. Granice: page ↛ page (grep). |
| `src/components/admin` | **0** | `ModerationQueue` → `auth/ServerError`, `ui/button`, `api-error`, `types`. Folder I=100%, Ca=0. | Kolejka jest liściem UI. Droga jest zmiana `types.ModerationStatus` + `api-auth`, nie komponentu. | Cykle + granice: odpowiednik `admin_console`. Test-plan #1/#2, S-04. |
| `src/components/discovery` | **0** | `ContactInquiryForm` → auth/ui + `api-error`. **Nie** importuje `inquiry-schema` / `inquiry-abuse`. | North-star (S-03) jest rozdzielony: walidacja/abuse na serwerze. Cykl form↔service jeszcze nie. | Cykle + testowalność: risk #3/#5. Ostrzeżenie: nie wciągać schematu do islandy. |
| `src/components` (auth / decorator / ui) | **0** | Decorator → własne islandy + auth + ui. Auth → `ui` / `utils`. Zero krawędzi admin↔discovery↔decorator. | Wspólne `FormField` (Ca=5) / `ServerError` (Ca=7) zachowują się jak hub UI, ale auth nic nie wie o feature’ach — hierarchia trzyma. | Cykle: „auth jako zestaw pól”. Granice: dozwolony wyjątek. |
| `src/middleware.ts` + layouty | **0** (middleware); layouty poza cruiserem | `middleware.ts` → tylko `supabase` (Ce=1, Ca=0, I=100%). | Guard importujący dashboard to klasyczny cykl legacy. Tu middleware jest cienkie. | Cykle: `platform/src`. Test-plan #2. |
| `src/types.ts` | **0** — czysty liść | Metrics: N=1, Ca=15, Ce=0, I=0%. `--include-only` na samym pliku = puste stdout (brak krawędzi wychodzących). | Odpowiednik `platform/types`. Gdyby types zaimportowały `lib`, każdy slice wpadłby w pętlę. Dziś Ce=0. | Cykle + granice: największy Ca. Test-plan #1–#6 dzielą ten kontrakt. |

---

## 2. Granice warstw

Mapowanie lekcja → EventBook (konwencja, **nie** reguła w `.dependency-cruiser.cjs`):

| Lekcja | EventBook | Rola |
|---|---|---|
| `platform/types` | `src/types.ts` | fundament; nie może importować pages, components ani lib |
| `platform/client` | `src/lib`, `src/layouts`, `src/components/ui`, `src/middleware.ts` | usługi, shell, prymitywy |
| `channels/src` | `src/pages`, `src/pages/api`, `src/components/{admin,discovery,decorator,auth}` | strony, handlery, islandy |

`✔ no dependency violations found` z committowanego configu **nie** jest werdyktem o warstwach — config nie egzekwuje tych granic. Werdykt pochodzi z `--focus` / `--reaches` / `--include-only` oraz ręcznego grep `.astro`.

| Granica | Werdykt | Dowód (skrót) |
|---|---|---|
| `types` ↛ lib / components / pages | **Trzyma się.** Czysty liść, Ca=15, Ce=0. | `npx depcruise src/types.ts --include-only "^(src)" --output-type text` → puste. Same krawędzie *wchodzące*. |
| `lib` ↛ components / pages / layouts | **Trzyma się.** Lib jest środkiem stosu. | `--reaches "^src/(components\|pages\|layouts)"` z `src/lib` → puste. Wychodzące: `lib → lib` albo `lib → types`. Folder I=11%. |
| `ui` ↛ feature / pages | **Trzyma się.** `button.tsx` → tylko `lib/utils`. | `--focus "^src/components/ui"`: feature’y przychodzą do buttona (Ca=7, Ce=1, I=13%), nie odwrotnie. |
| `middleware` ↛ pages / feature islandy | **Trzyma się.** Tylko `supabase`. | `--focus "^src/middleware"`: jedna krawędź. Grep: brak `@/pages` i `@/components`. |
| Feature A ↛ feature B (wyjątek: auth jako wspólne formularze) | **Trzyma się.** Zero admin↔discovery↔decorator. | `--include-only` na trzech folderach: tylko intra-decorator (`PortfolioPanel → PortfolioEntryForm`, `ProfileForm → ProfileAvatarUpload`). Auth jest konsumowany, sam nie importuje feature’ów. |
| Page ↛ page | **Trzyma się** w `.ts` (cruiser) i w `.astro` (grep). | Żaden `pages/*.ts` nie wskazuje innego `pages/*`. Grep `from "@/pages/"` w `src/pages` i `src/components`: brak. Folder `src/pages` I=100%. |

Miękki wyjątek (dozwolony mapowaniem): `components/auth` jako zestaw pól. `FormField` i `ServerError` używają admin, decorator i discovery. To nie jest cykl i nie jest wyciek feature↔feature — ale zaskoczy kogoś, kto traktuje folder `auth` jako „tylko logowanie”.

**Ślepa plamka `.astro`:** cruise `src --include-only "^(src)"` widzi 50/88 — bez layoutów i stron. Ręczny grep (kierunek nadal dozwolony): `dashboard.astro` → `ModerationQueue` + `moderation-queue` + `storage-url` + `supabase` + `types`; `d/[id].astro` → `ContactInquiryForm` + lib + types; `search.astro` → `discovery-query` (bez islandy discovery); `dashboard/inquiries.astro` → layout + `supabase` + `types` (bez islandy). Brak: page → page, layout → feature admin/discovery/decorator, `ui` → pages.

---

## 3. Load-bearing / fan-in

Zmiana w wierszu o wysokim Ca **promieniuje** do wszystkich dependentów naraz. To zachowuje się jak dług legacy przy zmianie, tylko bez formalnej pętli.

| Moduł | Ca | Ce | I | Co rusza zmiana kontraktu |
|---|---:|---:|---:|---|
| `src/types.ts` | **15** | 0 | 0% | Admin island, islandy decorator, `discovery-query`, `inquiry-email`, `moderation-queue`, API admin / inquiry / portfolio / profile. Wspólny kontrakt S-01–S-04 i test-plan #1–#6. |
| `src/lib/api-error.ts` | **14** | 0 | 0% | Ten sam przekrój admin + inquiry + portfolio — kształt błędu API↔UI. |
| `src/lib/api-auth.ts` | **7** | 2 | 22% | `api/admin/portfolio/[id]`, trzy handlery `api/portfolio/*`, dwa `api/profile/*`. Inquiry POST **nie** idzie tędy (gość). Ciągnie `supabase` + `api-error`. |
| `src/lib/supabase.ts` | **7** | 0 | 0% | W grafie: `api-auth`, `config-status`, middleware, `api/auth/*`, `api/inquiries`. Realny Ca wyższy: strony `.astro` też wołają `createClient` (`dashboard*`, `d/[id]`, `search`). |
| `src/components/auth/ServerError.tsx` | **7** | 0 | 0% | Moderacja, lead form, portfolio, profil, sign-in/up — jedna zmiana komunikatu błędu. |
| `src/components/ui/button.tsx` | **7** | 1 | 13% | Onboarding (S-01) i moderacja (S-04) dzielą ten przycisk. Jedyny import: `lib/utils`. |
| `src/components/auth/FormField.tsx` | **5** | — | — | Logowanie + profil + portfolio + lead. Zmiana `label` / `id` psuje locatory e2e #3. |

Folder `src/lib` jako całość: **Ca=34**, Ce=4, I=11% — load-bearing area. Folder `src/components/auth`: Ca=8, Ce=2, I=20%. Folder `src/pages`: Ca=0, Ce=30 — nie jest hubem; jest warstwą kompozycji.

Najwyższe Ce (kompozytorzy, trudni w izolacji — nie to samo co load-bearing):

| Moduł | Ce | Rola |
|---|---:|---|
| `src/components/decorator/ProfileForm.tsx` | **7** | Najgrubsza islanda (auth + avatar + utils + types). Poza top-6 ryzyk test-plan. |
| `src/pages/api/inquiries/index.ts` | **6** | Jedyny handler z Ce>4: abuse + email + schema + supabase + types. |
| `ContactInquiryForm.tsx` / `ModerationQueue.tsx` | **4** | Islandy north-star / admin; `fetch` + shared auth UI + `api-error`. |

---

## 4. Ryzyka testowe (skrót)

Izolacja boli przez **huby o wysokim Ca** i **kompozytorów o wysokim Ce** (+ klient API + `astro:env/server` + stan izolatu) — nie przez cykle. Pełna lista 13 punktów: [`artifact-1-testability-risks.md`](./artifact-1-testability-risks.md).

| Gdzie | Mock | Integracja | E2E |
|---|---|---|---|
| `api/inquiries` (Ce=6) | `createClient`, mail; **nie** `parseInquiryBody` | POST + prawdziwy Supabase: insert tylko przy `is_published`; 404 na nieopublikowany (#3, część #5) | Już `inquiry-confirmation-reaches-decorator` (#3) — nie dublować Vitestem |
| `supabase.ts` (Ca=7) | `vi.mock` factory w unitach handlerów | Jeden test prawdziwego `createClient` | Nie testować factory |
| `api-auth.ts` (Ca=7) | `getUser` przy unicie `requireAdmin` | PATCH admin bez mocka gate: 403 + brak zmiany w DB (#2) | Non-admin nie widzi kolejki na `/dashboard` |
| `inquiry-email.ts` | Zawsze (`fetch` / cały moduł) | Nie celować w Resend | **Nie** — mail ≠ dostarczenie leada |
| `inquiry-abuse.ts` | Niepotrzebny do limitu; handler-test dziś mockuje i gubi #5 | 6. request → 429 i brak wiersza | Nie (izolaty Workers) |
| `middleware.ts` | Factory, jeśli wyciągniemy czysty gate | `/dashboard*` bez ciasteczka → 302 (#2) | Przy zmianie `PROTECTED_ROUTES` |
| `ContactInquiryForm` | `fetch` na UX błędów; 204 honeypot ≡ sukces | Nie składać React + handler w jsdom | Już #3 |
| `d/[id].astro` / `dashboard*.astro` | Słaby sygnał (poza grafem) | Query approved/published (#1, #6); ownership panelu (#4); non-admin (#2) | #1 już jest; #4 gdy chrome panelu |
| `types.ts` / `api-error.ts` | **Nie mockować** | — | Regresja przez testy #1–#6, nie „test typów” |

**Jeden przyszły SVG (nie teraz, nie cały `src`):** subgraph north-star inquiry —

`ContactInquiryForm.tsx` → `api/inquiries/index.ts` → `inquiry-abuse` / `inquiry-email` / `inquiry-schema` / `supabase` / `api-error` / `types`.

To pokaże liście tanie w unicie, granice mocka i kompozytor, który bez integracji kłamie. `dashboard/inquiries.astro` i `d/[id].astro` i tak nie wejdą, dopóki cruiser nie dostanie `.astro` — nie dopisywać `.astro` do committed `extensions` tylko po to, by narysować stronę.

Nie polecane jako pierwszy SVG: cały `src/lib`, pełny `src/pages` (Ce=30), cykl (nie istnieje).

---

## Źródła

Analizy tej sesji (2026-09-13):

- [`artifact-1-frontend-cycles.md`](./artifact-1-frontend-cycles.md)
- [`artifact-1-layer-boundaries.md`](./artifact-1-layer-boundaries.md)
- [`artifact-1-testability-risks.md`](./artifact-1-testability-risks.md)

Terytorium (brak `artifact-1-territory.md`): `context/foundation/test-plan.md` (ryzyka #1–#6), `context/foundation/roadmap.md` (F-01, S-01–S-04).

Komendy dependency-cruiser (config `.dependency-cruiser.cjs`, `tsconfig.json`):

```text
npm run depcruise
# = depcruise src tests
# → ✔ no dependency violations found (74 modules, 158 dependencies cruised)

npx depcruise src --include-only "^(src)" --output-type err-long
# → ✔ no dependency violations found (50 modules, 88 dependencies cruised)

npx depcruise src --include-only "^src" --output-type metrics
npx depcruise src tests --output-type text
npx depcruise src --include-only "^(src)" --focus "^src/lib" --output-type text
npx depcruise src/lib --include-only "^(src)" --reaches "^src/(components|pages|layouts)" --output-type text
```

Grafu DOT/SVG w tej sesji nie renderowano.
