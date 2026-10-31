# ReytUp 4.2 — Implementation Summary

- Premium responsive ReytUp interface and location-intelligence workflow retained.
- Google Places API (New) address/nearby enrichment remains server-side; OSM/Overpass is a fallback data source.
- Corrected analysis persistence SQL: 14 columns now receive exactly 14 values.
- Added an asynchronous database adapter supporting Supabase PostgreSQL through `DATABASE_URL` and SQLite for isolated local tests.
- Added an idempotent Supabase runtime schema migration with BIGINT identity IDs, foreign keys, indexes and Row Level Security enabled.
- Updated auth, analysis history, AI usage counters, contacts and Stripe webhook writes to use the selected database adapter.
- Stripe webhook event processing now uses an actual database transaction.
- Overpass requests use form-encoded query data and an identifiable User-Agent.
- Added placeholder connection-string validation, PostgreSQL SQL-translation tests and analysis-insert regression coverage.
- Render Blueprint now expects `DATABASE_URL`; no persistent SQLite disk is required for production.

See README.md for Supabase setup, credentials, limits, data limitations and deployment instructions.


## Latest operational update

- Stripe Checkout confirmation now maps the tier using the actual Checkout line-item Price ID and verifies session ownership/payment/subscription state. Metadata is not treated as proof of the purchased tier when configured Price IDs exist.
- Subscription period end reads modern Stripe subscription-item fields and legacy top-level fields.
- Account recovery accepts only active/trialing subscriptions with configured Professional/Business Price IDs.
- Overpass sequentially fails over across multiple public instances; requests are cached and rate-spaced.
- Google Places Nearby Search exposes available named place records (name, address, type, coordinates) to the nearby-competitor list. If Overpass is unavailable, the observed Google sample now produces a clearly labelled low-confidence provisional competition score; it is never presented as a complete unique competitor count.
- Competitor and transit Places searches are independent.
- Dashboard now includes metrics, recent-score chart, plan usage, source health, shortcuts and analysis history in a responsive layout.
- Verified stale-customer repair for a signed-in Checkout confirmation and Stripe webhook; added unit/smoke regression coverage.
- Latest local verification: `npm run check` and `npm test` (31/31). Live Supabase, Stripe, Google Places and Overpass connectivity remain environment-dependent.


## Account, billing, and grounded AI follow-up

- The authenticated Checkout confirmation and exact-email subscription recovery now treat verified Stripe sessions / active configured Price IDs as the source of truth. They can repair a stale Stripe customer link left by an earlier failed checkout, then verify the customer, subscription, and plan persisted to the user row.
- Account sign-out is visibly labeled in the workspace sidebar, including compact layouts.
- Repeated per-card confidence labels were removed; source coverage is summarized once and the confidence component is labeled as source coverage.
- Groq is an LLM inference provider, not a search index or live places database. ReytUp must retrieve factual places from Google Places / OpenStreetMap first, then give only those retrieved records to Groq for explanation and decision summaries. If providers return no data, Groq is explicitly instructed not to invent business names, distances, counts, or transport stops.
