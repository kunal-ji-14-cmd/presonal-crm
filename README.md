# Nexus AI CRM

A premium, AI-ready customer relationship management workspace for growing businesses.

## Current foundation
- Responsive CRM overview dashboard, light/dark themes and demo lead interactions
- Supabase email/password authentication (sign in, sign up and email confirmation callback)
- Session refresh and protected routes when Supabase is configured
- Tenant-aware PostgreSQL schema for organizations, memberships, companies, contacts, leads, deals and tasks
- Row Level Security policies that scope CRM records to organization membership

## Run locally
Requires Node.js 20.9+.

```bash
cp .env.example .env.local
# Add your Supabase project URL and anon/publishable key to .env.local
npm install
npm run dev
```

Open http://localhost:3000.

## Supabase setup
1. Create a project in the Supabase dashboard.
2. Copy the Project URL and anon/publishable key into `.env.local`.
3. Open **SQL Editor** in Supabase and run `supabase/migrations/0001_initial_crm.sql`.
4. In **Authentication → URL Configuration**, set the Site URL to your local app URL and add `http://localhost:3000/auth/callback` to Redirect URLs.
5. For production, add your deployed app URL and its `/auth/callback` URL too.
6. Start the app with `npm run dev`.

New signups create an organization using the submitted business name and automatically become its owner. If email confirmation is enabled, the user must confirm the email before signing in.

## Security notes
- The browser uses only the Supabase anon/publishable key.
- Never commit `.env.local` or a Supabase service-role key.
- RLS is enabled on all tenant-owned tables in the starter schema.
- Organization membership is checked inside PostgreSQL policies; do not rely on client-side filtering for tenant isolation.

## Roadmap
1. Complete auth and organization onboarding
2. Connect dashboard to persistent CRM data
3. Add role-aware CRUD for leads, contacts, companies, deals and tasks
4. AI assistant, lead scoring and follow-up generation
5. WhatsApp, email and voice integrations
6. Reports, forecasting and workflow automation

> Demo note: the overview currently uses sample data in browser state. Authentication and database schema are implemented as a foundation, but the dashboard CRUD and AI/messaging integrations are not connected yet.