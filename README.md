# 10x Astro Starter

![](./public/template.png)

A modern, opinionated starter template for building fast, accessible web applications.

## Tech Stack

- [Astro](https://astro.build/) v6 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication and the EventBook domain schema (profiles, portfolio, inquiries). Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

Domain schema plan: [`context/changes/domain-schema-foundation/plan-brief.md`](context/changes/domain-schema-foundation/plan-brief.md).

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Initialize the local Supabase project (creates a `supabase/` config folder) if missing:

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Apply migrations + seed comments (resets local DB):

```bash
npx supabase db reset
```

This applies SQL under `supabase/migrations/` (tables, RLS, `profiles` + `portfolio` storage buckets). `supabase/seed.sql` documents how to create profile rows after signup — it does not insert users.

5. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

For S-03 inquiry emails, add Resend variables when you want real delivery locally:

```
RESEND_API_KEY=<resend-api-key>
RESEND_FROM_EMAIL=leads@example.com
RESEND_TO_OVERRIDE=<optional-dev-inbox@example.com>
```

6. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

### Migrations (local and remote)

| Command                                 | When to use                                                   |
| --------------------------------------- | ------------------------------------------------------------- |
| `npx supabase db reset`                 | Local: recreate DB from migrations + seed                     |
| `npx supabase db push`                  | Remote: apply pending migrations to the linked hosted project |
| `npx supabase link --project-ref <ref>` | One-time: link this repo to a hosted Supabase project         |

Never commit service-role keys or `.env` / `.dev.vars`.

### Admin role (FR-008 hook)

Admin RLS uses JWT `app_metadata.role = 'admin'`. Assign it in the Supabase dashboard: **Authentication → Users → user → App Metadata**, e.g. `{ "role": "admin" }`. No admin UI ships in F-01.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

Then link and push migrations:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Confirm in the hosted **Table Editor** that `decorator_profiles`, `portfolio_entries`, and `contact_inquiries` exist.

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                             |
| `/auth/signup`        | Email/password sign-up form                                             |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/dashboard`          | Example protected page (redirects to `/auth/signin` if unauthenticated) |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

## Public URL

EventBook is a responsive **web** app — not App Store or Google Play (out of MVP scope). Production host is Cloudflare Workers (`wrangler.jsonc` name: `event-book`). After `npx wrangler deploy` the public URL is:

`https://event-book.<your-workers-subdomain>.workers.dev`

(or a custom domain attached in the Cloudflare dashboard). Source repository: https://github.com/aleksandrawczarska-a11y/Event-Book

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/).

1. Build the project:

```bash
npm run build
```

2. Deploy with Wrangler:

```bash
npx wrangler deploy
```

Set `SUPABASE_URL` and `SUPABASE_KEY` as secrets in your Cloudflare dashboard or via `npx wrangler secret put`.

For inquiry emails in S-03, also set:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM_EMAIL
# Optional local/dev override inbox:
npx wrangler secret put RESEND_TO_OVERRIDE
```

## CI

GitHub Actions runs lint + Vitest (`npm test`) + build on every push and PR to `master`. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets in GitHub for the build step. Playwright e2e stays local (needs a running app and seed).

## License

MIT
