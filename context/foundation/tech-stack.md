---
starter_id: 10x-astro-starter
package_manager: npm
project_name: event-book
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

EventBook to responsywny web-app na 3 tygodnie after-hours, solo, z auth dekoratorów, uploadem zdjęć portfolio, formularzem lead-gen i małą skalą użytkowników. 10x Astro Starter (Astro + React + TypeScript + Supabase + Tailwind) daje gotowe auth, PostgreSQL i storage pod zdjęcia bez budowania infrastruktury od zera; wszystkie cztery bramki agent-friendly są spełnione. Hosting produkcyjny: **Cloudflare Workers** (`@astrojs/cloudflare`, `wrangler deploy`) — zgodnie z domyślnym starterem; szczegóły w @context/foundation/infrastructure.md. CI: GitHub Actions (lint + build); auto-deploy na Workers konfigurowany w M1L5. Płatności, realtime i AI są poza scope MVP zgodnie z PRD.
