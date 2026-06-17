---
project: EventBook
context_type: greenfield
product_type: web-app
target_scale:
  users: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
created: 2026-05-29
updated: 2026-05-29
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: pain category
      decision: workflow friction, missing capability, data trapped on social media, coordination overhead
    - topic: insight
      decision: Booksy model works for beauty — same marketplace pattern can work for event decorators
    - topic: primary persona scope
      decision: two-sided marketplace — decorators and event organizers from MVP start
    - topic: auth strategy
      decision: email + password login for decorators; anonymous clients via contact form
    - topic: role model
      decision: two roles — decorator (authenticated) and anonymous client (no client account)
  frs_drafted: 8
  quality_check_status: accepted
---

# Shape Notes — EventBook

Seed source: `idea-notes.md.md`

## Vision & Problem Statement

Dekoratorzy eventowi i ślubni pozyskują klientów przez grupy na Facebooku, Instagram, polecenia i wiadomości prywatne — proces jest chaotyczny, czasochłonny i mało efektywny. Brakuje jednego miejsca na profesjonalne portfolio, lokalne dotarcie do klientów i system zbierania leadów.

Organizatorzy eventów (ślub, urodziny, baby shower, event firmowy, wieczór panieński) nie wiedzą gdzie szukać dekoratorów, przeglądają dziesiątki profili na Instagramie, nie mogą łatwo porównać ofert i tracą czas na szukanie kontaktów.

Insight: model Booksy działa w branży beauty — ta sama logika marketplace (discovery + kontakt + wizytówka online) może rozwiązać ten problem w branży eventowej. EventBook ma być „Instagramem + Booksy dla branży eventowej”.

## User & Persona

### Primary persona — Dekorator eventowy

Nazwa robocza: **Dekorator** (freelancer lub mała firma dekoracyjna).

Kontekst: prowadzi realizacje ślubne i eventowe, ma portfolio zdjęć rozproszone po Instagramie, codziennie szuka zleceń w grupach FB.

Moment: gdy chce dotrzeć do lokalnych klientów bez codziennego przeszukiwania grup i budować profesjonalną wizytówkę online.

### Secondary persona — Organizator eventu

Nazwa robocza: **Klient** (osoba organizująca wydarzenie).

Kontekst: planuje ślub, urodziny lub inny event, szuka inspiracji i dekoratora w swojej okolicy.

Moment: gdy chce znaleźć dekoratora pasującego stylem i lokalizacją, porównać realizacje i wysłać zapytanie bez przeszukiwania dziesiątek profili IG.

## Access Control

- **Dekorator**: rejestracja i logowanie email + hasło. Dostęp do panelu dekoratora (profil, portfolio, zapytania).
- **Klient**: brak konta w MVP. Przeglądanie feedu, wyszukiwarka i formularz kontaktowy dostępne anonimowo.
- **Administrator**: rola moderacji treści (manualna moderacja z notatek seed) — zakres uprawnień do doprecyzowania w FR.
- Brak OAuth, passwordless i social login w MVP.

## Success Criteria

### Primary

- Dekorator może założyć konto, opublikować profil z portfolio i otrzymać zapytanie kontaktowe od klienta znalezionego przez wyszukiwarkę.
- End-to-end flow (MVP rdzeń lead-gen):
  1. Dekorator rejestruje się i loguje.
  2. Dekorator uzupełnia profil i dodaje realizacje do portfolio.
  3. Klient (anonimowo) wyszukuje dekoratora po mieście / typie eventu / stylu.
  4. Klient przegląda profil i portfolio dekoratora.
  5. Klient wysyła formularz kontaktowy z datą eventu i opisem potrzeb.
  6. Dekorator otrzymuje zapytanie (email + widok w panelu).

### Secondary

- 30–50 aktywnych dekoratorów z minimum 5 zdjęciami portfolio (cel walidacji rynku z notatek seed).
- Klienci regularnie wysyłają formularze kontaktowe.

### Guardrails

- Brak płatności online, kalendarza rezerwacji, czatu realtime i ocen w MVP.
- Responsywna aplikacja webowa — bez natywnej aplikacji mobilnej.
- Treści moderowane manualnie przez administratora.
- Feed inspiracji i zapisywanie inspiracji — poza scope MVP rdzenia (v2).

## Functional Requirements

### Authentication & profiles

- FR-001: Dekorator can register and log in with email and password. Priority: must-have
  > Socrates: Brak counter-argumentu; zostaje.
- FR-002: Dekorator can create and edit a public profile (company name, photo, description, location, Instagram link, contact details). Priority: must-have
  > Socrates: Brak counter-argumentu; zostaje.
- FR-003: Dekorator can add portfolio entries with photos, event description, decoration style, location, and tags. Priority: must-have
  > Socrates: Brak counter-argumentu; zostaje.

### Discovery & contact

- FR-004: Klient can search and filter decorators by city, event type, and decoration style. Priority: must-have
  > Socrates: Brak counter-argumentu; wyszukiwarka jest kluczowa dla discovery — zostaje.
- FR-005: Klient can view a decorator's public profile and portfolio gallery. Priority: must-have
  > Socrates: Brak counter-argumentu; zostaje.
- FR-006: Klient can submit a contact inquiry with event date, needs description, and contact details. Priority: must-have
  > Socrates: Brak counter-argumentu; formularz to główny mechanizm lead-gen — zostaje.

### Decorator panel & moderation

- FR-007: Dekorator can view incoming inquiries in a panel. Priority: must-have
  > Socrates: Brak counter-argumentu; zostaje.
- FR-008: Administrator can manually moderate portfolio content. Priority: must-have
  > Socrates: Brak counter-argumentu; manualna moderacja z notatek seed — zostaje.

## User Stories

### US-01: Klient wysyła zapytanie do dekoratora

- **Given** anonimowy klient na stronie wyszukiwarki
- **When** filtruje dekoratorów po mieście i stylu, otwiera profil z portfolio i wypełnia formularz kontaktowy z datą eventu
- **Then** dekorator otrzymuje zapytanie emailem i widzi je w panelu

#### Acceptance Criteria

- Formularz wymaga daty eventu, opisu potrzeb i danych kontaktowych klienta
- Po wysłaniu klient widzi potwierdzenie (bez konieczności konta)
- Dekorator widzi nowe zapytanie w panelu w ciągu tej samej sesji (po odświeżeniu)

## Business Logic

Platforma klasyfikuje dekoratorów według lokalizacji, typu eventu i stylu dekoracji, umożliwiając klientom discovery i wysłanie zapytania do wybranego dekoratora.

Wejścia widoczne dla użytkownika: miasto, typ eventu, styl dekoracji (filtry wyszukiwarki); dane profilu i portfolio dekoratora; treść formularza kontaktowego (data eventu, opis potrzeb, kontakt klienta).

Wyjście: uporządkowana lista dekoratorów pasujących do kryteriów; przekierowane zapytanie kontaktowe do wybranego dekoratora (email + panel).

Użytkownik doświadcza tego jako: wyszukiwanie → przegląd portfolio → wysłanie zapytania → dekorator otrzymuje lead.

## Non-Functional Requirements

- Aplikacja działa stabilnie na urządzeniach mobilnych (responsywny web).
- Dodawanie zdjęć do portfolio jest szybkie i proste (onboarding dekoratora ≤ kilka minut).
- Formularz kontaktowy dostarcza potwierdzenie widoczne dla klienta po wysłaniu.
- Treści portfolio moderowane manualnie przez administratora przed lub po publikacji (proces do doprecyzowania).

## Non-Goals

- Brak płatności online (zaliczki, subskrypcje, prowizje od rezerwacji).
- Brak kalendarza rezerwacji i synchronizacji terminów.
- Brak natywnej aplikacji mobilnej — tylko responsywny web.
- Brak AI (rekomendacje, analiza zdjęć, automatyczne matchowanie stylów).
- Brak komunikatora — czat realtime i wiadomości prywatne; kontakt przez formularz, email, Instagram.
- Brak funkcji social (obserwowanie profili, komentarze, video feed).
- Brak systemu ocen, opinii i rankingów.
- Brak automatycznej moderacji treści w MVP.
- Feed inspiracji i zapisywanie inspiracji — poza rdzeniem MVP (v2).

## Quality cross-check

- Access Control: present
- Business Logic: present (reguła klasyfikacji + lead routing)
- Project artifacts: present
- Timeline-cost ack: present (3 tygodnie after-hours)
- Non-Goals: present
- Preserved behavior: n/a (greenfield)

## Forward: tech-stack

(brak — użytkownik nie podał preferencji technologicznych; następny krok: tech-stack selection po PRD)
