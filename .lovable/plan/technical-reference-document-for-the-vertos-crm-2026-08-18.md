# Technical Reference Document for the Vertos CRM

Produce a single, complete Markdown reference covering everything already built, written so that you (or another developer/AI) can add a new module without re-reading the whole codebase.

## Deliverable

One file, `VERTOS_TECHNICAL_REFERENCE.md`, delivered as a downloadable artifact (and previewable in chat).

## Contents

1. **Overview and stack**
   - Product summary, React 18 + Vite + TypeScript + Tailwind + shadcn/ui, React Query, React Router, backend on Lovable Cloud (Postgres, Auth, Storage, Edge Functions).
   - Exact dependency list with versions.

2. **Project structure**
   - Directory-by-directory map of `src/pages`, `src/components` (including the feature folders: dashboard, pipeline, contacts, companies, tasks, activities, settings, onboarding), `src/hooks`, `src/lib`, `src/integrations`, `supabase/`.
   - Routing table: every route, its page component, and whether it is public or auth-guarded.

3. **Data model (full reference)**
   - Every table with all columns, types, defaults, nullability, and foreign keys: profiles, user_roles, teams, team_members, companies, contacts, deals, pipelines, pipeline_stages, tasks, activities, notifications, email_templates.
   - Enums (`app_role`, `activity_type`), database functions and triggers with their purpose.
   - ER diagram in ASCII showing relationships.

4. **Security model**
   - Every RLS policy per table, in plain language plus the SQL predicate.
   - The role system (admin / manager / rep), the `has_role` security-definer pattern and why roles live in a separate table.
   - Storage bucket (`avatars`) and its access rules.

5. **Frontend patterns and conventions**
   - The data-hook pattern: how each `use*.ts` hook wraps React Query (query keys, mutations, cache invalidation, toast handling) with a worked example.
   - Design system: tokens in `index.css` / Tailwind config, theming and dark mode, component variants — and the rule against hardcoded colors.
   - Shared utilities: `formatters.ts` (INR currency, Lakh/Crore compact, IST date/time), `sanitize.ts`, `utils.ts`.
   - Auth flow, session handling and route protection.

6. **Backend features**
   - The `demo-login` edge function: what it seeds, how it resets, how it is configured public in `config.toml`.
   - Notifications trigger, onboarding/pipeline seeding RPC.
   - Import/export (CSV) behaviour.

7. **How to add a new module** — the practical part
   - Step-by-step checklist: migration (table + GRANTs + RLS in the required order) → regenerate types → create the hook → build the page → register the route → add sidebar nav → wire notifications/activities if relevant.
   - A concrete worked example (e.g. a "Products" module) with the SQL and hook skeleton.
   - Gotchas and house rules already learned in this project.

## Technical notes

The document is generated from the live schema (queried from the backend) plus the actual source files, so column lists and policies match reality rather than being written from memory. No application code changes are made — this task only produces the document.
