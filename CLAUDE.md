# Sellabot

> Project bible. Read this before writing or changing code. Opinionated choices live here — deviate only with a documented reason.

---

## 1. Project Overview

**Sellabot** is a multi-agent system that automates the day-to-day operations of an online marketplace seller. The first supported platform is **Shopee**; the architecture is deliberately **platform-agnostic** so Lazada, TikTok Shop, and others can be added without rewriting agent logic.

**What it does**

Sellabot turns high-level seller intent ("restock the items running low", "match my competitor's price on SKU-123", "reply to unanswered buyer questions") into concrete, audited actions against a marketplace's seller API. It handles:

- Product listing (create / edit / delete, images, descriptions)
- Pricing (adjustments, competitor monitoring, flash deals)
- Inventory (stock updates, low-stock alerts)
- Customer service (buyer messages, reviews)
- Promotions (vouchers, campaigns, listing boosts)

**Architecture philosophy**

- **One agent per domain.** Each agent owns a single workflow area and nothing else. Agents never reach directly into another agent's domain — they request work through the Orchestrator.
- **Platform logic is isolated behind adapters.** Agents speak a normalized internal vocabulary; adapters translate to/from a specific marketplace's API. Adding a platform = adding an adapter, not editing agents.
- **Every action is auditable and reversible-by-record.** Every external mutation is logged as a task with inputs, outputs, and outcome before and after execution.
- **Human-in-the-loop by default for risky actions.** Price changes, deletions, and bulk operations require an approval policy check (see §8).

---

## 2. Agent Roster

Every agent implements the shared `Agent` contract (§5). Responsibilities are strictly scoped — if a task spans two domains, the Orchestrator decomposes it.

| Agent | Owns | Example tasks |
|-------|------|---------------|
| **Orchestrator Agent** | Task intake, intent parsing, routing, multi-agent coordination, approval gating | "Restock low items and drop their price 5%" → split into Inventory + Pricing subtasks, sequence them, aggregate results |
| **Product Agent** | Listings lifecycle: create / edit / delete, images, titles, descriptions, attributes, categories | Add a new SKU, swap a product photo, fix a description typo, deactivate a listing |
| **Pricing Agent** | Price reads/writes, competitor price monitoring, flash-deal scheduling | Set price, run a "match lowest competitor minus 1%" rule, schedule a flash deal window |
| **Inventory Agent** | Stock-level reads/writes, low-stock thresholds and alerts | Update stock for a SKU, set a low-stock alert at qty < 10, report items below threshold |
| **Customer Service Agent** | Reading and replying to buyer chat messages and product reviews | Draft/send replies to unanswered chats, respond to a 1-star review, flag messages needing a human |
| **Promotion Agent** | Vouchers, campaign enrollment, listing boosts | Create a 10%-off voucher, join an upcoming platform campaign, boost a listing |

**Hard rules**

- The Orchestrator is the **only** agent that talks to other agents. Domain agents are leaves.
- Agents are **stateless between tasks** — all state lives in storage (§3), passed in via the task envelope.
- An agent that can't safely complete a task returns a structured failure; it never silently partial-applies. (See error handling, §5.)

---

## 3. Tech Stack Decisions

Choices are opinionated. Each has a one-line justification so future changes are deliberate.

### Language & runtime — **TypeScript on Node.js (LTS, ≥ 20)**
- Marketplace APIs are HTTP/JSON and heavily async — Node's I/O model fits.
- Static types make the cross-agent contracts and API schemas safe to refactor as platforms multiply.
- Rich ecosystem for agent/LLM SDKs and queueing; consistent with the team's existing TS work.
- Package manager: **pnpm**. Module system: **ESM**. Type-check + lint enforced in CI.

### Agent communication — **Orchestrator-mediated task queue (BullMQ on Redis)**
- Agents do **not** call each other directly. The Orchestrator enqueues a typed `Task` onto a per-agent queue; the agent worker consumes, executes, and writes back a `TaskResult`.
- **Why a queue, not in-process calls:** durability (survive crashes), built-in **retries with backoff**, **rate limiting** (critical for Shopee — §5), concurrency control, and a natural seam to scale agents into separate processes/containers later.
- For local dev a single process runs all workers; in production each agent can scale independently. The code path is identical — only worker concurrency/config differs.

### LLM / reasoning layer — **Anthropic Claude (claude-sonnet-4-6 default)**
- The Orchestrator uses an LLM for intent parsing and task decomposition; domain agents use it sparingly (e.g. CS Agent drafting replies, Product Agent writing descriptions).
- LLM calls are wrapped in a single `llm/` module so the model/provider is swappable and every call is logged + cost-tracked.
- **Deterministic actions stay deterministic.** Price math, stock math, and API calls are plain code — the LLM decides *what* to do, code decides *how* and validates *whether it's allowed*.

### Marketplace integration — **Shopee Open Platform API v2 via a Platform Adapter**
- All Shopee access goes through `platforms/shopee/`. Agents never import Shopee code directly — they call the `PlatformAdapter` interface (§5).
- Shopee v2 requires **HMAC-SHA256 signed requests** (`partner_id` + `partner_key` + `timestamp` + path, plus `shop_id`/`access_token` for shop-scoped calls). All signing lives in one signer module — never inline.
- Pagination, error-code mapping, and Shopee's quirks (e.g. item vs. model IDs, region hosts) are the adapter's problem, not the agent's.

### Auth & credential management — **OAuth2 per shop + encrypted token store + secrets via env/secrets manager**
- **Partner-level secrets** (`partner_id`, `partner_key`) come from environment / a secrets manager — never committed, never in the DB in plaintext.
- **Shop-level auth** uses Shopee's OAuth flow → `access_token` (~4h) + `refresh_token`. Tokens are stored **encrypted at rest** (AES-256-GCM with a key from `ENCRYPTION_KEY`) in the `shop_credentials` table.
- A token-refresh service proactively refreshes before expiry; adapters request a valid token from the credential store, never read tokens directly.

### Storage — **PostgreSQL (Prisma) for state/history, Redis for queue + cache + rate-limit tokens**
- **PostgreSQL** is the system of record: shops, credentials (encrypted), tasks, task results, audit log, agent config, price/stock snapshots. Accessed only through **Prisma** — no raw SQL outside `db/`.
- **Redis** backs BullMQ, caches short-lived Shopee reads, and holds the rate-limiter token buckets.
- **Audit log is append-only.** Every external mutation writes a row before execution (intent) and updates it after (outcome).

---

## 4. Project Structure

```
sellabot/
├── CLAUDE.md                  # this file
├── package.json
├── tsconfig.json
├── .env.example               # documents every required env var (§7)
├── prisma/
│   └── schema.prisma          # DB schema (shops, credentials, tasks, audit, snapshots)
├── src/
│   ├── index.ts               # entrypoint: boots Orchestrator + agent workers
│   ├── config/                # env loading + validated config object (zod)
│   │   └── index.ts
│   ├── core/                  # platform- and agent-agnostic primitives
│   │   ├── agent.ts           # Agent interface/contract (§5)
│   │   ├── task.ts            # Task, TaskResult, TaskEnvelope types
│   │   ├── queue.ts           # BullMQ wrappers (enqueue/consume)
│   │   ├── errors.ts          # error taxonomy: RetryableError, FatalError, NeedsApproval
│   │   ├── retry.ts           # backoff policy + retry helpers
│   │   ├── ratelimit.ts       # token-bucket limiter (per platform, per endpoint)
│   │   └── audit.ts           # append-only audit logging
│   ├── agents/                # one folder per domain agent
│   │   ├── orchestrator/
│   │   ├── product/
│   │   ├── pricing/
│   │   ├── inventory/
│   │   ├── customer-service/
│   │   └── promotion/
│   │       └── index.ts       # each: implements Agent, registers its queue worker
│   ├── platforms/             # platform adapters — the ONLY place platform APIs live
│   │   ├── types.ts           # PlatformAdapter interface + normalized domain models
│   │   ├── registry.ts        # maps platform id → adapter instance
│   │   └── shopee/
│   │       ├── adapter.ts     # implements PlatformAdapter
│   │       ├── client.ts      # low-level HTTP client
│   │       ├── signer.ts      # HMAC-SHA256 request signing
│   │       ├── auth.ts        # OAuth flow + token refresh
│   │       └── mappers.ts     # Shopee DTO <-> normalized model
│   ├── llm/                   # single wrapper around the LLM provider
│   │   └── index.ts
│   ├── db/                    # Prisma client + repositories
│   │   ├── client.ts
│   │   └── repositories/
│   ├── services/              # cross-cutting services (credential store, token refresher)
│   └── api/                   # optional HTTP API for task intake + OAuth callbacks
│       └── server.ts
├── scripts/                   # one-off ops scripts (e.g. shopee:auth)
└── test/
    ├── unit/
    └── integration/
```

**Where things go — quick rules**

- New marketplace API call? → `platforms/<platform>/`. Never elsewhere.
- New normalized concept (e.g. `Voucher`)? → `platforms/types.ts`, then each adapter maps to it.
- New workflow in an existing domain? → that agent's folder.
- Shared logic two agents need? → `core/`. If it touches a platform, it's wrong — push it into the adapter.

---

## 5. Development Guidelines

### Adding a new platform (Lazada, TikTok Shop, …)

The whole point of the structure. To add a platform you should touch **zero agent code**:

1. Create `src/platforms/<platform>/` with an `adapter.ts` implementing `PlatformAdapter`.
2. Implement the platform's auth (OAuth/signing) in that folder.
3. Map the platform's DTOs to the **normalized domain models** in `platforms/types.ts` (`Product`, `PriceUpdate`, `StockUpdate`, `Voucher`, `Message`, etc.).
4. Register the adapter in `platforms/registry.ts`.
5. Add platform credentials to `.env.example` and the credential store.

If an agent needs to know which platform it's on, the design has leaked — fix the abstraction, don't branch on platform inside an agent.

### The Agent contract

Every agent implements this interface (defined in `core/agent.ts`). Keep it small and stable:

```ts
interface Agent {
  /** Stable unique id, e.g. "pricing". Used for queue routing. */
  readonly name: AgentName;

  /** Task kinds this agent can handle, for Orchestrator validation. */
  readonly handles: TaskKind[];

  /** Pure-ish handler: receives a fully-typed task + a platform adapter,
   *  returns a structured result. MUST NOT call other agents directly. */
  handle(task: Task, ctx: AgentContext): Promise<TaskResult>;
}
```

- `AgentContext` provides: the resolved `PlatformAdapter` for the task's shop, a scoped logger, the audit logger, and the LLM client. Agents get dependencies **injected** — no module-level singletons reaching into platforms.
- `handle` is responsible for **validating inputs**, **checking approval policy**, **performing the action via the adapter**, and **returning a `TaskResult`** (`success | failure | needs_approval`). It writes audit entries around any mutation.
- Agents are **idempotent where possible**: include an idempotency key in the task so retries don't double-apply (e.g. don't create two vouchers).

### Error handling & retry conventions

- **Three error classes** (`core/errors.ts`):
  - `RetryableError` — transient (network, 5xx, Shopee rate-limit/`error_busy`). The queue retries with **exponential backoff + jitter** up to a max attempts cap.
  - `FatalError` — bad input, auth permanently invalid, business-rule violation. **No retry**; surfaced to the user/audit immediately.
  - `NeedsApproval` — action is blocked pending human approval (§8). Not an error per se; the task parks until approved or rejected.
- **Never swallow errors.** Map unknown errors to `FatalError` by default — fail loud, not silent.
- **No partial application without a record.** If a multi-step task fails midway, log what was applied; prefer designs where each step is its own idempotent task the Orchestrator sequences.
- All retries and failures are written to the audit log with the attempt count and final disposition.

### Rate limiting (Shopee, and every platform)

- Shopee enforces per-API rate limits and returns busy/throttle errors. Treat the limit as **ours to respect**, not theirs to enforce.
- A **token-bucket limiter** (`core/ratelimit.ts`, backed by Redis) gates every adapter call, configured **per platform and per endpoint class**. Adapters acquire a token before each request.
- BullMQ worker concurrency + the limiter together cap throughput. On a 429/busy response, throw `RetryableError` so backoff kicks in — do **not** hot-loop.
- Cache idempotent reads (prices, stock) in Redis with short TTLs to cut call volume.

### Coding conventions

- TypeScript `strict` on. No `any` without a `// reason:` comment.
- Validate all external input (task payloads, API responses, env) with **zod** at the boundary.
- Secrets never logged. The logger redacts known secret keys.
- Keep platform quirks in adapters and business rules in agents — don't blur the line.

---

## 6. Key Commands

> Assumes **pnpm**. Adjust if the lockfile says otherwise.

```bash
pnpm install                 # install dependencies
pnpm dev                     # run Orchestrator + all agent workers locally (watch mode)
pnpm build                   # type-check + compile to dist/
pnpm start                   # run compiled build (production)

pnpm typecheck               # tsc --noEmit
pnpm lint                    # eslint
pnpm format                  # prettier --write

pnpm test                    # run unit + integration tests
pnpm test:unit               # unit tests only
pnpm test:watch              # tests in watch mode

pnpm db:migrate              # prisma migrate dev
pnpm db:generate             # prisma generate
pnpm db:studio               # prisma studio (inspect data)

pnpm shopee:auth             # script: run Shopee OAuth flow to authorize a shop
```

Local infra (Postgres + Redis) is expected via `docker compose up -d` (compose file added with first real code).

---

## 7. Environment Variables

Document **every** var in `.env.example` (committed, no real values). Never commit `.env`.

```bash
# --- Runtime ---
NODE_ENV=development                 # development | production | test
LOG_LEVEL=info                       # debug | info | warn | error
PORT=3000                            # HTTP API (task intake + OAuth callbacks)

# --- Database / Cache ---
DATABASE_URL=postgresql://user:pass@localhost:5432/sellabot
REDIS_URL=redis://localhost:6379

# --- Security ---
ENCRYPTION_KEY=                      # 32-byte key (base64) for AES-256-GCM token encryption

# --- LLM provider ---
ANTHROPIC_API_KEY=
LLM_MODEL=claude-sonnet-4-6

# --- Shopee Open Platform (partner-level secrets) ---
SHOPEE_PARTNER_ID=
SHOPEE_PARTNER_KEY=
SHOPEE_REGION=SG                     # SG | MY | TH | ... (selects API host)
SHOPEE_REDIRECT_URL=http://localhost:3000/auth/shopee/callback
SHOPEE_ENV=test                      # test | live (sandbox vs production host)

# --- Future platforms (add when adapters land) ---
# LAZADA_APP_KEY=
# LAZADA_APP_SECRET=
# TIKTOKSHOP_APP_KEY=
# TIKTOKSHOP_APP_SECRET=
```

Config is loaded once in `src/config/`, validated with zod, and accessed only through that module — no scattered `process.env` reads.

---

## 8. Out of Scope / Constraints

Sellabot intentionally does **not** (for now):

- **No fully autonomous high-risk actions.** Price changes beyond a configured threshold, listing deletions, and bulk operations require **human approval** (the `NeedsApproval` flow). Sellabot proposes; a human confirms.
- **No web scraping / browser automation.** Sellabot uses **official seller APIs only**. Competitor "monitoring" is limited to data the platform's API exposes — no headless-browser scraping of marketplace pages.
- **No financial operations.** No withdrawals, payouts, bank-detail changes, or anything touching money movement.
- **No buyer-side automation.** Sellabot acts only as a **seller**. It does not place orders or operate buyer accounts.
- **No multi-tenant SaaS billing/accounts (yet).** Early versions assume a small, trusted set of operators. Tenancy, RBAC, and billing come later.
- **No marketing content generation beyond listings/replies.** No ad-campaign creative, no external social posting.
- **English + the platform's supported locales only.** No custom translation layer yet.
- **Not a real-time guarantee system.** Actions are queued and rate-limited; Sellabot favors correctness and auditability over instant execution.

When a request bumps into one of these limits, the correct response is to **surface the constraint**, not to work around it.

---

*Keep this file current. If a decision here stops being true, update it in the same PR that changes the behavior.*
