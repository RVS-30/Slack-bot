# MemGo Slack Bot — Session Handoff Document v3
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
- Context-aware responses — per user per channel session window
- External integrations (Notion, GitHub, Google Docs) — planned
- API layer / webhooks — planned

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
├── index.js
├── debug.js
├── src/
│   ├── config/
│   │   ├── database.js
│   │   └── environment.js
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
│   │   └── awareness.queue.js
│   ├── repositories/
│   │   └── message.repository.js     # ALL SQL lives here
│   ├── schedulers/
│   │   └── embedding.scheduler.js
│   ├── services/
│   │   ├── awareness.service.js
│   │   ├── context.service.js        # ← NEW Phase 4
│   │   ├── embedding.service.js
│   │   ├── membership.service.js     # ← NEW Security
│   │   ├── message.service.js
│   │   ├── rag.service.js
│   │   ├── search.service.js         # ← NEW Phase 4
│   │   └── summary.service.js        # ← NEW Phase 4
│   ├── workers/
│   │   ├── awareness.worker.js
│   │   └── startAwarenessWorker.js
│   └── utils/
└── .env
```

---

## Database Schema (Supabase)

### `messages` table
- `workspace_id`, `channel_id`, `user_id`, `thread_ts`
- `text`, `slack_timestamp`, `channel_type`, `raw_payload`
- `message_type`, `importance_score`, `entities` (JSONB), `topic_tags` (JSONB)
- `edited_at`, `deleted`, `deleted_at`, `processed`

### `thread_embeddings` table
- `workspace_id`, `channel_id`, `thread_ts` (unique composite key)
- `content` (full enriched thread text)
- `embedding` (vector(768))
- `message_count`, `last_message_at`, `needs_embedding`, `embedded_at`, `updated_at`

**HNSW index:**
```sql
CREATE INDEX ON thread_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### `users` table
- `workspace_id`, `user_id` (composite PK)
- `display_name`, `avatar_url`, `fetched_at`

### `interaction_log` table ← replaces `memory_queries`
Audit log of every command interaction — powers context window.
- `id` (UUID), `workspace_id`, `user_id`, `channel_id`
- `command_type` — `'ask'` | `'summarize'` | `'search'` | `'decisions'`
- `input` — question/query, NULL for summarize/decisions
- `output` — generated response or raw result text
- `metadata` (JSONB) — `threadsUsed`, `resultCount`, `messageCount`, `channelsExposed`, etc.
- `created_at`

```sql
CREATE INDEX idx_interaction_log_context
ON interaction_log (workspace_id, user_id, channel_id, command_type, created_at DESC);
```

### `user_channel_memberships` table ← NEW Security
Caches which channels each user is a member of — used to gate all search queries.
- `workspace_id`, `user_id`, `channel_id` (composite PK)
- `is_private` (BOOLEAN)
- `synced_at` — re-synced from Slack API if older than 10 minutes

```sql
CREATE INDEX idx_memberships_lookup
ON user_channel_memberships (workspace_id, user_id);
```

---

## Environment Variables (.env)

```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
GEMINI_API_KEY=...
REDIS_URL=redis://...
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
PORT=4390
```

---

## Full Phase Roadmap & Task Tracking

### ✅ PHASE 1 — Infrastructure (COMPLETE)
### ✅ PHASE 2 — Message Storage Layer (COMPLETE)
### ✅ PHASE 2.5 — Message Enrichment Pipeline (COMPLETE)
### ✅ PHASE 2.6 — Thread Dirty Flag + thread_embeddings (COMPLETE)
### ✅ PHASE 3 — Embedding + RAG Pipeline (COMPLETE)

---

### ✅ PHASE 4 — Knowledge Layer (COMPLETE — Topic Clustering intentionally skipped)

- [x] `/memory decisions` — scoped to current channel, LEFT JOIN users
- [x] `/memory summarize` — last 7 days, enriched with names + timestamps, temporal reasoning
- [x] `/memory search` — hybrid vector + keyword, deep-links to original threads
- [x] `interaction_log` table — unified audit log replacing `memory_queries`
- [x] Context window — per user per channel, 2hr session, registry-driven
- [x] `context.service.js` — registry, fetch, format, log
- [x] `summary.service.js` — summarization with context injection
- [x] `search.service.js` — hybrid search with context injection

**Topic Clustering — intentionally skipped**, will revisit post Phase 5.

---

### ✅ Security Hardening (COMPLETE — done before Phase 5)

- [x] DMs blocked at ingestion — `channel_type === 'im' || 'mpim'` guard in `message.service.js`
- [x] `user_channel_memberships` table — caches Slack API membership per user
- [x] `membership.service.js` — `resolveAccessibleChannels()` syncs if stale (10 min TTL)
- [x] `searchThreads` and `searchHybrid` channel-gated — `AND channel_id = ANY($n::text[])` at SQL level
- [x] Every `ask` and `search` command resolves membership before touching the DB
- [x] Context window re-validated — `getContextForCommand` filters stale channel interactions
- [x] `channelsExposed` logged in `interaction_log.metadata` for full audit trail
- [x] Decisions scoped to current channel — no cross-channel exposure
- [x] Block Kit 3000 char truncation guard — `truncateForSlack()` in `memory.js`
- [x] Ephemeral full summary — sent privately to user when truncation occurs
- [x] Embedding lag notice — footer on `/memory ask` and `/memory search`
- [x] Thread deduplication — `Set` dedup on `thread_ts` between context window and live results

---

### 🔄 PHASE 5 — Slack UX Layer (STARTING NEXT)

- [ ] `/memory save` — force-embed a message immediately, bypass scheduler. Accept message link or quoted text. Confirm to user in Slack.
- [ ] Automated daily summary cron job — second cron, per channel, stores to `summaries` table
- [ ] Slack Home Tab dashboard
  - [ ] Recent decisions
  - [ ] Recent queries
  - [ ] Top topics
- [ ] Scheduled daily summary DM (opt-in per user)
- [ ] Weekly digest posted to a designated channel

**Start with `/memory save` first** — it's foundational and the simplest Phase 5 item.

---

### 🔜 PHASE 6 — External Integrations (NOT STARTED)
- [ ] Notion auto-sync
- [ ] GitHub PR ↔ Slack thread linking
- [ ] Google Docs export
- [ ] Webhooks / MCP API layer

---

### 🔜 PHASE 7 — Web Dashboard (NOT STARTED)
- [ ] Next.js frontend
- [ ] Authentication
- [ ] Analytics dashboard
- [ ] Billing, advanced search UI, query history, decision ledger UI

---

### 🔜 Production Deployment (NOT STARTED)
- [ ] Replace ngrok with real domain
- [ ] Deploy to Render / Railway / AWS / Fly.io
- [ ] Move embedding scheduler from `node-cron` to BullMQ for horizontal scaling
- [ ] Multi-workspace onboarding flow

---

## Current State of Key Files

### `repositories/message.repository.js`
Functions present:
- `insertMessage`, `updateMessageText`, `markMessageDeleted`, `getMessageById`
- `updateMessageEnrichment`, `getThreadMessages`
- `upsertThreadDirty`, `getDirtyThreads`, `upsertThreadEmbedding`, `deleteThreadEmbedding`
- `searchThreads(workspaceId, embedding, allowedChannels, limit)` ← channel-gated
- `searchHybrid(workspaceId, embedding, keyword, allowedChannels, limit)` ← channel-gated
- `upsertUser`, `getUsersByIds`
- `getSummaryMessages(workspaceId, channelId, fromUnix, toUnix)`
- `getDecisions(workspaceId, channelId, limit)` ← channel-scoped
- `upsertUserChannels(workspaceId, userId, channels)`
- `getAccessibleChannels(workspaceId, userId)`
- `isMembershipStale(workspaceId, userId)`

### `services/context.service.js`
- `CONTEXT_REGISTRY` — declares which command types each command cares about
- `getContextForCommand(workspaceId, userId, channelId, commandType, client)` — session-bounded, membership-validated
- `formatContextForPrompt(contextRows)` — human-readable context string
- `logInteraction(workspaceId, userId, channelId, commandType, input, output, metadata)`

### `services/membership.service.js`
- `resolveAccessibleChannels(client, workspaceId, userId)` — syncs if stale, returns `[channel_id, ...]`
- Paginates `client.users.conversations` — handles large workspaces
- 10-minute TTL on cached membership

### `services/rag.service.js`
- `answerFromMemory(workspaceId, userId, channelId, question, client)`
- Resolves membership → embeds question → searches channel-gated threads → deduplicates against context window → generates answer
- Logs `channelsExposed` in metadata

### `services/summary.service.js`
- `summarizeChannel(workspaceId, userId, channelId, client)`
- Fetches last 7 days, formats with names + timestamps + message_type tags
- Temporal reasoning — reframes time-bound statements relative to today
- Context injection from prior session

### `services/search.service.js`
- `searchMemory(workspaceId, userId, channelId, query, client)`
- Hybrid vector + keyword search, channel-gated
- Returns raw formatted results with similarity score + deep-link to original thread
- Logs `channelsExposed` in metadata

### `listeners/commands/memory.js`
- `client` destructured from command handler — required for membership sync + ephemeral messages
- `/memory ask` ✅
- `/memory decisions` ✅ channel-scoped
- `/memory summarize` ✅ with truncation guard + ephemeral full summary
- `/memory search` ✅ with deep-links + similarity scores
- `truncateForSlack(text, limit = 2900)` utility at top of file
- `/memory save` — stub only
- `CONTEXT_REGISTRY` extension pattern: add one line to register a new command

---

## Key Architecture Decisions (Never Undo These)

| Decision | Reason |
|---|---|
| Repository pattern — all SQL in `message.repository.js` | SOLID, zero raw SQL in workers/services |
| Thread-level embedding not message-level | Full thread = meaningful semantic chunk |
| Dirty flag on `thread_embeddings` | One row per thread, avoids mass UPDATEs |
| `outputDimensionality: 768` | Matches `vector(768)` column exactly |
| `node-cron` over BullMQ for scheduler | Single instance; move to BullMQ when horizontal scaling |
| `workspace_id` on every query | Multi-tenant isolation from day one |
| `@google/genai` SDK | New SDK — always match this import style |
| `JSON.stringify(embedding)` + `::vector` cast | `pg` driver limitation |
| `users` table as name cache | Avoids Slack API rate limits at volume |
| `resolveAndCacheUser` fire-and-forget | Name resolution never blocks message ingestion |
| Error classification in service layer | Service owns error context — command handler stays clean |
| `logInteraction` non-blocking | Logging never slows user-facing response |
| Context window per user per channel | Team-size independent, no cross-user pollution |
| Registry pattern for context | Adding a new command = one line in `CONTEXT_REGISTRY` |
| Membership sync with 10-min TTL | Fresh enough for security, cheap enough for performance |
| Channel-gating at SQL level | Security enforced in DB, not application logic |
| DMs blocked at ingestion | Private content never enters the pipeline |
| `channelsExposed` in interaction_log metadata | Full forensic audit trail |
| `slack_timestamp::numeric` cast in queries | Stored as Unix float string — must cast for range comparisons |
| Ephemeral messages for full summary | Only visible to the requesting user |
| `truncateForSlack(text, 2900)` | 100-char buffer below Slack's 3000-char hard limit |

---

## Working Style (Important for Next Chat)

- **One step at a time.** Write → test → confirm → next. Never skip ahead.
- **Always ask for existing file contents** before writing into them — match patterns exactly.
- **Smoke test every new service** in `debug.js` before wiring to Slack.
- **Never add multiple features at once** — each sub-step is isolated and testable.
- **Confirm from the user before moving to next step.**
- Enterprise-scale thinking on every decision — multi-tenant, high-volume, production-ready.
