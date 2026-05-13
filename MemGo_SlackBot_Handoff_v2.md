# MemGo Slack Bot — Session Handoff Document v2
## For the next chat: read this fully before writing any code.

---

## What This Project Is

A **full organizational memory system** built as a Slack bot called **MemGo**. Not a simple Q&A bot — this is enterprise-grade infrastructure that captures everything said in a Slack workspace, enriches it with AI, embeds it into a vector database, and makes it queryable via slash commands.

**The vision:** Persistent, searchable, structured knowledge base for any Slack workspace. Think Slack AI but with real storage, decision tracking, cross-channel memory, and external integrations.

**What makes it different from Slack AI:**
- Persistent knowledge (not ephemeral summaries)
- Structured database with full audit trail
- Decision ledger — automatically detected and stored
- Searchable history with semantic vector search
- External integrations (Notion, GitHub, Google Docs)
- API layer / webhooks

**Stack:**
- Node.js + Slack Bolt SDK
- PostgreSQL on Supabase (pgvector enabled)
- BullMQ + Redis (RedisLabs) for job queues
- Gemini 2.5 Flash for classification + generation
- Gemini `gemini-embedding-001` for 768-dim vectors
- `node-cron` for embedding scheduler
- ngrok for local tunnel during dev
- `@google/genai` SDK (new SDK — important, always match this import style)

---

## Project File Structure

```
Slack-bot/
├── index.js                          # Entry point
├── debug.js                          # One-off test scripts (not production)
├── src/
│   ├── config/
│   │   ├── database.js               # PostgreSQL pool
│   │   └── environment.js            # Config + env validation
│   ├── listeners/
│   │   ├── commands/
│   │   │   └── memory.js             # /memory slash command handler
│   │   └── events/
│   │       ├── app-mention.js
│   │       ├── message.js
│   │       └── index.js
│   ├── middleware/
│   │   └── logger.middleware.js
│   ├── models/
│   │   └── message.model.js
│   ├── queues/
│   │   └── awareness.queue.js        # BullMQ queue backed by Redis
│   ├── repositories/
│   │   └── message.repository.js     # ALL SQL lives here — repository pattern
│   ├── schedulers/
│   │   └── embedding.scheduler.js    # node-cron, runs every 5 min
│   ├── services/
│   │   ├── awareness.service.js      # Gemini classification
│   │   ├── embedding.service.js      # Gemini embedding generation
│   │   ├── message.service.js        # Message processing logic
│   │   └── rag.service.js            # RAG pipeline — embed question → search → generate
│   ├── workers/
│   │   ├── awareness.worker.js       # BullMQ worker
│   │   └── startAwarenessWorker.js
│   └── utils/
└── .env
```

---

## Database Schema (Supabase)

### `messages` table
Stores every Slack message with full lifecycle tracking.
- `workspace_id`, `channel_id`, `user_id`, `thread_ts`
- `text`, `slack_timestamp`, `channel_type`, `raw_payload`
- `message_type`, `importance_score`, `entities` (JSONB), `topic_tags` (JSONB)
- `edited_at`, `deleted`, `deleted_at`, `processed`

### `thread_embeddings` table
One row per thread. Stores the vector + metadata.
- `workspace_id`, `channel_id`, `thread_ts` (unique composite key)
- `content` (full thread text built for embedding — includes names + timestamps)
- `embedding` (vector(768) — pgvector)
- `message_count`, `last_message_at`
- `needs_embedding` (dirty flag)
- `embedded_at`, `updated_at`

**HNSW index live on Supabase:**
```sql
CREATE INDEX ON thread_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### `users` table
Caches Slack user display names — resolved once at message ingestion, never re-fetched.
- `workspace_id`, `user_id` (composite primary key)
- `display_name`, `avatar_url`
- `fetched_at`

### `memory_queries` table
Audit log of every `/memory ask` query.
- `id` (UUID), `workspace_id`, `user_id`, `channel_id`
- `question`, `answer`, `threads_used`
- `responded_at`

---

## Environment Variables (.env)

```bash
# Slack — https://api.slack.com/apps → your app → OAuth & Permissions
SLACK_BOT_TOKEN=xoxb-...

# Slack — https://api.slack.com/apps → your app → Basic Information → Signing Secret
SLACK_SIGNING_SECRET=...

# Google AI Studio — https://aistudio.google.com/apikey
GEMINI_API_KEY=...

# RedisLabs — your database → Configuration → Public endpoint
# Format: redis://default:<password>@<host>:<port>
REDIS_URL=redis://...

# Supabase — Settings → Database → Connection string → URI (Node.js, port 6543 pooler)
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres

PORT=4390
```

---

## Full Phase Roadmap & Task Tracking

### ✅ PHASE 1 — Infrastructure (COMPLETE)
- [x] Slack App (MemGo) created with OAuth
- [x] Event subscriptions configured
- [x] Slash commands configured (`/memory`)
- [x] Slack Bolt SDK — `app-mention` + `message` listeners
- [x] Logger middleware
- [x] ngrok on port 4390

---

### ✅ PHASE 2 — Message Storage Layer (COMPLETE)
- [x] PostgreSQL on Supabase
- [x] Full `messages` schema with lifecycle tracking
- [x] Repository pattern — zero raw SQL outside `message.repository.js`
- [x] `insertMessage`, `updateMessageText`, `markMessageDeleted`
- [x] Thread context via `thread_ts`
- [x] Edited + deleted message lifecycle handling

---

### ✅ PHASE 2.5 — Message Enrichment Pipeline (COMPLETE)
- [x] BullMQ awareness queue on Redis
- [x] Every message → Gemini 2.5 Flash classification
- [x] Classifies: `message_type`, `importance_score`, `entities`, `topic_tags`
- [x] Message types: `decision`, `task`, `question`, `information`, `conversation`
- [x] Worker uses full repository pattern
- [x] Retry logic with exponential backoff
- [x] Classification prompt updated with explicit definitions per type

---

### ✅ PHASE 2.6 — Thread Dirty Flag + thread_embeddings (COMPLETE)
- [x] `thread_embeddings` table with pgvector
- [x] `upsertThreadDirty()` with WAL-optimized UPSERT
- [x] Every message (including edits/deletes) marks its thread dirty
- [x] Standalone messages treated as threads of one
- [x] Ghost rows (zero non-deleted messages) deleted entirely

---

### ✅ PHASE 3 — Embedding + RAG Pipeline (COMPLETE)

#### Embedding Scheduler
- [x] `node-cron` fires every 5 minutes
- [x] Fetches dirty threads → builds enriched content string → generates 768-dim vectors
- [x] Upserts into `thread_embeddings` → clears dirty flag atomically
- [x] Per-thread try/catch
- [x] Ghost row cleanup

#### User Identity Layer
- [x] `users` table — caches `user_id → display_name + avatar_url`
- [x] `upsertUser()` in repository
- [x] `getUsersByIds()` in repository — returns `{ user_id: display_name }` map
- [x] `resolveAndCacheUser()` in `message.service.js` — fires non-blocking on every new message
- [x] Backfill script for existing messages (run via `debug.js` — one-time use)
- [x] `message.js` listener passes `client` to `handleIncomingMessage`

#### Enriched Thread Content
- [x] `buildThreadContent(messages, usersMap)` — formats each message as:
  `[May 10, 2026, 4:30 PM] Rajveer Singh: message text`
- [x] Scheduler resolves users via `getUsersByIds` before building content
- [x] Deduplicates user IDs with `[...new Set(...)]` — one DB call per thread

#### RAG Service (`rag.service.js`)
- [x] `answerFromMemory(workspaceId, userId, channelId, question)`
- [x] Embeds question with same model + dimensions as stored threads
- [x] `searchThreads()` — pgvector cosine similarity, HNSW index, top 5
- [x] Prompt includes today's date, attribution guidelines, temporal context
- [x] Error classification — 503, 429, 400 all return clean user-safe messages
- [x] Non-blocking `insertMemoryQuery()` call after every answer

#### `/memory ask` Command
- [x] Loading state → replaced with final answer (Slack `replace_original`)
- [x] Block Kit formatting — bold question, divider, answer, footer with user + timestamp
- [x] Full try/catch — user sees clean error message, never a stack trace
- [x] `memory_queries` table logging every query

#### Query Logging
- [x] `memory_queries` table created in Supabase
- [x] `insertMemoryQuery()` in repository
- [x] Wired into `rag.service.js` — non-blocking
- [x] Colored terminal logs (CYAN for query, YELLOW for threads count, GREEN for answer)

---

### 🔄 PHASE 4 — Knowledge Layer (IN PROGRESS)

#### `/memory decisions` — ✅ COMPLETE
- [x] `getDecisions(workspaceId, limit)` in repository
- [x] LEFT JOIN with `users` table — name resolved inline
- [x] Ordered by `slack_timestamp DESC` — most recent first
- [x] Block Kit formatting — decision text, name, timestamp, topic tags
- [x] Header block, per-decision dividers, footer with count
- [x] Empty state handled

#### `/memory summarize` — 🔜 NOT STARTED
- [ ] Subcommand: `/memory summarize` (default: today) or `/memory summarize last 7 days`
- [ ] `getSummaryMessages(workspaceId, channelId, from, to)` in repository
- [ ] Time range parsing from command text
- [ ] Gemini prompt for channel summarization
- [ ] `summaries` table — store generated summaries (daily/weekly per channel)
- [ ] Second cron job for automated daily summarization

#### `/memory search` — 🔜 NOT STARTED
- [ ] Hybrid search — semantic (vector) + keyword
- [ ] Subcommand: `/memory search <query>`
- [ ] Returns matching messages/threads with context
- [ ] Different from `ask` — returns raw results, not a generated answer

#### Topic Clustering — 🔜 NOT STARTED
- [ ] Group messages by `topic_tags`
- [ ] Surface top topics per channel per time period
- [ ] Foundation for future dashboard analytics

---

### 🔜 PHASE 5 — Slack UX Layer (NOT STARTED)
- [ ] `/memory save` — force-embed a message immediately, bypass scheduler
- [ ] Slack Home Tab dashboard
  - [ ] Recent decisions
  - [ ] Recent queries
  - [ ] Top topics
- [ ] Scheduled daily summary DM (opt-in per user)
- [ ] Weekly digest posted to a designated channel

---

### 🔜 PHASE 6 — External Integrations (NOT STARTED)
- [ ] Notion auto-sync — push summaries to a Notion database
- [ ] GitHub PR ↔ Slack thread linking
- [ ] Google Docs export
- [ ] Webhooks / MCP API layer for external consumers

---

### 🔜 PHASE 7 — Web Dashboard (NOT STARTED — post real users)
- [ ] Next.js frontend
- [ ] Authentication
- [ ] Analytics dashboard
- [ ] Billing
- [ ] Advanced search UI
- [ ] Query history viewer
- [ ] Decision ledger UI

---

### 🔜 Production Deployment (NOT STARTED)
- [ ] Replace ngrok with real domain (`https://api.yourapp.com/slack/events`)
- [ ] Deploy to Render / Railway / AWS / Fly.io
- [ ] Load balancer
- [ ] Move embedding scheduler from `node-cron` to BullMQ (for horizontal scaling)
- [ ] Multi-workspace onboarding flow

---

## Current State of Key Files

### `repositories/message.repository.js`
Functions present:
- `insertMessage`
- `updateMessageText`
- `markMessageDeleted`
- `getMessageById`
- `updateMessageEnrichment`
- `getThreadMessages`
- `upsertThreadDirty`
- `getDirtyThreads`
- `upsertThreadEmbedding`
- `deleteThreadEmbedding`
- `searchThreads` ← added Phase 3
- `upsertUser` ← added Phase 3
- `getUsersByIds` ← added Phase 3
- `insertMemoryQuery` ← added Phase 3
- `getDecisions` ← added Phase 4

### `services/rag.service.js`
- `answerFromMemory(workspaceId, userId, channelId, question)`
- Error classification: 503, 429, 400 → clean user-safe strings
- Colored terminal logs
- Non-blocking `insertMemoryQuery` call

### `services/embedding.service.js`
- `buildThreadContent(messages, usersMap)` — enriched with names + timestamps
- `generateEmbedding(content)` — 768-dim via `gemini-embedding-001`

### `services/message.service.js`
- `handleIncomingMessage(event, body, client)` — now accepts `client`
- `resolveAndCacheUser(client, workspaceId, userId)` — non-blocking, fire-and-forget

### `listeners/events/message.js`
- Passes `client` to `handleIncomingMessage`

### `listeners/commands/memory.js`
- `/memory ask` ✅
- `/memory decisions` ✅
- `/memory summarize` — stub only (listed in available commands, not implemented)
- `/memory search` — stub only
- `/memory save` — stub only

---

## Immediate Next Steps — Do These In Order

### Step 1 — `/memory summarize`
Decide the interface first:
- Option A: `/memory summarize` → summarizes current channel, last 7 days
- Option B: `/memory summarize last 7 days` or `/memory summarize today` → user-specified range

Then:
1. Add `getSummaryMessages(workspaceId, channelId, from, to)` to repository
2. Add time range parser utility
3. Create summarization prompt in `rag.service.js` (or separate `summary.service.js`)
4. Wire subcommand in `memory.js`
5. Create `summaries` table for caching generated summaries
6. Add second cron job for automated daily summarization

### Step 2 — `/memory search`
1. Add hybrid search (vector + keyword `ILIKE`) to repository
2. Wire subcommand in `memory.js`
3. Return formatted thread results (not generated answer)

### Step 3 — `/memory save`
1. Accept a message link or quoted text
2. Immediately embed without waiting for scheduler
3. Confirm to user in Slack

---

## Key Architecture Decisions (Never Undo These)

| Decision | Reason |
|---|---|
| Repository pattern — all SQL in `message.repository.js` | SOLID, zero raw SQL in workers/services |
| Thread-level embedding not message-level | Full thread = meaningful semantic chunk |
| Dirty flag on `thread_embeddings` not `messages` | One row per thread, avoids mass UPDATEs |
| `WHERE needs_embedding = false` on UPSERT | Prevents redundant WAL writes at scale |
| `outputDimensionality: 768` | Matches `vector(768)` column exactly |
| `node-cron` over BullMQ for scheduler | Single instance; move to BullMQ when horizontal scaling |
| Standalone messages as threads of one | Uniform pipeline, no separate code path |
| `workspace_id` on every query | Multi-tenant isolation from day one |
| `@google/genai` SDK | New SDK — always match this import style |
| `JSON.stringify(embedding)` + `::vector` cast | `pg` driver limitation — doesn't natively understand pgvector type |
| `users` table as name cache | Avoids Slack API rate limits at volume — resolve once, reuse forever |
| `resolveAndCacheUser` fire-and-forget | Name resolution never blocks message ingestion |
| Error classification in `rag.service.js` | Service layer owns error context — command handler stays clean |
| `insertMemoryQuery` non-blocking | Query logging never slows down user-facing response |
| `buildThreadContent` enriched with names + timestamps | Embedding carries identity + temporal context — improves RAG quality significantly |

---

## Working Style (Important for Next Chat)

- **One step at a time.** Write → test → confirm → next. Never skip ahead.
- **Always ask for existing file contents** before writing into them — match patterns exactly.
- **Smoke test every new service** in `debug.js` before wiring to Slack.
- **Never add multiple features at once** — each sub-step is isolated and testable.
- **Confirm from the user before moving to next step** — they may have questions, edge cases, or optimizations to discuss first.
- Enterprise-scale thinking on every decision — multi-tenant, high-volume, production-ready.
