CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  persona_name TEXT NOT NULL,
  persona_domain TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_status TEXT NOT NULL DEFAULT 'idle' CHECK (processing_status IN ('idle', 'running')),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  initialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- These additions keep the original foundation schema upgradeable if it was applied locally.
ALTER TABLE agents ADD COLUMN IF NOT EXISTS persona_name TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS persona_domain TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS active BOOLEAN;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS processing_status TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS locked_by TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS initialized_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE agents
SET
  persona_name = COALESCE(persona_name, 'Legacy agent'),
  persona_domain = COALESCE(persona_domain, 'Technology'),
  active = COALESCE(active, TRUE),
  next_run_at = COALESCE(next_run_at, initialized_at, created_at, NOW()),
  processing_status = COALESCE(processing_status, 'idle'),
  consecutive_failures = COALESCE(consecutive_failures, 0),
  initialized_at = COALESCE(initialized_at, created_at, NOW()),
  updated_at = COALESCE(updated_at, created_at, NOW())
WHERE persona_name IS NULL
   OR persona_domain IS NULL
   OR active IS NULL
   OR next_run_at IS NULL
   OR processing_status IS NULL
   OR consecutive_failures IS NULL
   OR initialized_at IS NULL
   OR updated_at IS NULL;

ALTER TABLE agents ALTER COLUMN persona_name SET NOT NULL;
ALTER TABLE agents ALTER COLUMN persona_domain SET NOT NULL;
ALTER TABLE agents ALTER COLUMN active SET NOT NULL;
ALTER TABLE agents ALTER COLUMN next_run_at SET NOT NULL;
ALTER TABLE agents ALTER COLUMN processing_status SET NOT NULL;
ALTER TABLE agents ALTER COLUMN consecutive_failures SET NOT NULL;
ALTER TABLE agents ALTER COLUMN initialized_at SET NOT NULL;
ALTER TABLE agents ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS agents_worker_claim_index
  ON agents (active, processing_status, next_run_at);

CREATE TABLE IF NOT EXISTS discovered_topics (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  source_name TEXT,
  source_published_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered', 'rejected', 'selected', 'published', 'failed')),
  UNIQUE (agent_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS discovered_topics_recent_index
  ON discovered_topics (agent_id, discovered_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS editorial_decisions (
  topic_id TEXT PRIMARY KEY REFERENCES discovered_topics(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('rejected', 'selected')),
  reason TEXT NOT NULL,
  score REAL CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  topic_id TEXT REFERENCES discovered_topics(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  rationale TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Preserve data from the initial foundation schema if it was applied before Phase 2.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS topic_id TEXT REFERENCES discovered_topics(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'content'
  ) THEN
    EXECUTE 'UPDATE posts SET text = COALESCE(text, content) WHERE text IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'published_at'
  ) THEN
    EXECUTE 'UPDATE posts SET created_at = COALESCE(created_at, published_at) WHERE created_at IS NULL';
  END IF;
END $$;

UPDATE posts SET created_at = NOW() WHERE created_at IS NULL;
ALTER TABLE posts ALTER COLUMN text SET NOT NULL;
ALTER TABLE posts ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS posts_feed_index ON posts (agent_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS post_sources (
  id BIGSERIAL PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  UNIQUE (post_id, position)
);

ALTER TABLE post_sources ALTER COLUMN title SET DEFAULT '';

CREATE INDEX IF NOT EXISTS post_sources_post_index ON post_sources (post_id, position);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  stage TEXT,
  selected_topic_id TEXT REFERENCES discovered_topics(id) ON DELETE SET NULL,
  published_post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  error_summary TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS agent_runs_recent_index ON agent_runs (agent_id, started_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS agent_memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  topic_title TEXT NOT NULL,
  summary TEXT,
  post_text TEXT NOT NULL,
  rationale TEXT NOT NULL,
  source_urls TEXT[] NOT NULL DEFAULT '{}',
  fingerprint TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'processing', 'synced', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, post_id)
);

CREATE INDEX IF NOT EXISTS agent_memories_recent_index ON agent_memories (agent_id, published_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS memory_outbox (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  memory_id TEXT NOT NULL REFERENCES agent_memories(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'synced', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, memory_id)
);

CREATE INDEX IF NOT EXISTS memory_outbox_status_index ON memory_outbox (status, attempts, created_at ASC);
