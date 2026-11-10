/**
 * Seed High-Yield Technical Interview Questions for TrueUp Leaders into MariaDB
 */

const pool = require('../db/db');

const TRUEUP_QUESTIONS = [
  // ── Supabase ──
  {
    category: 'leetcode_company',
    company_tag: 'Supabase',
    title: 'Postgres Logical Replication & WAL Decoder',
    difficulty: 'hard',
    topic: 'Database Internals & Streaming',
    url: 'https://supabase.com/blog/supabase-realtime',
    question_text: 'Explain how PostgreSQL Logical Decoding works using the pgoutput plugin. How does an external client consume the Write-Ahead Log (WAL) to emit real-time JSON events, and how do you handle replication slot disk bloat when a consumer lags?',
    answer_text: 'Postgres logical decoding decodes WAL records using an output plugin (such as pgoutput or wal2json) into a stream of tuple changes (INSERT, UPDATE, DELETE). A replication slot tracks the confirmed flush LSN (Log Sequence Number). If a consumer disconnects or falls behind, the database holds WAL files on disk, risking storage exhaustion. Mitigation: Set max_slot_wal_keep_size so PostgreSQL drops lagging slots before running out of disk space, and use heartbeats to advance LSN during low-activity tables.',
    frequency_pct: 95.0,
    source_repo: 'supabase_engineering'
  },
  {
    category: 'leetcode_company',
    company_tag: 'Supabase',
    title: 'Row-Level Security (RLS) In-Memory Evaluation',
    difficulty: 'medium',
    topic: 'Distributed Systems & Security',
    url: 'https://supabase.com/docs/guides/database/postgres/row-level-security',
    question_text: 'How can an application gateway evaluate PostgreSQL Row-Level Security (RLS) policies on a real-time CDC stream without querying the primary database for every single broadcast message?',
    answer_text: 'Pre-compile and cache user permission claims from JWTs (e.g., auth.uid(), roles) in memory. Parse table RLS expressions into abstract syntax trees (ASTs) in the gateway layer (e.g. in Elixir/Go) and evaluate row columns against the user context in-memory. Only fallback to database evaluation if the policy involves subqueries (SELECT ... from another table).',
    frequency_pct: 90.0,
    source_repo: 'supabase_engineering'
  },

  // ── Linear ──
  {
    category: 'leetcode_company',
    company_tag: 'Linear',
    title: 'Optimistic UI State Reconciliation with Rollbacks',
    difficulty: 'medium',
    topic: 'Client Architecture & State',
    url: 'https://linear.app/blog/scaling-the-linear-sync-engine',
    question_text: 'Design a client-side mutation store that applies user edits instantly to local UI state, assigns client-generated UUIDs, queues outbound synchronization deltas, and handles server conflict rollbacks without screen flicker.',
    answer_text: 'Implement a two-tier state store: Base State (acknowledged by server) + Mutation Queue (pending local operations). The UI renders State = reduce(BaseState, MutationQueue). When a mutation succeeds, its delta merges into BaseState and drops from the queue. On server rejection, remove the failed mutation from the queue and re-evaluate remaining mutations, triggering a smooth state update without tearing down components.',
    frequency_pct: 96.0,
    source_repo: 'linear_engineering'
  },
  {
    category: 'leetcode_company',
    company_tag: 'Linear',
    title: 'CRDT vs Operational Transformation in Offline Sync',
    difficulty: 'hard',
    topic: 'Distributed Algorithms',
    url: 'https://linear.app/method',
    question_text: 'Why do local-first applications like Linear prefer State-based or Operation-based CRDTs (Conflict-free Replicated Data Types) over centralized Operational Transformation (OT) for collaborative issue tracking?',
    answer_text: 'Operational Transformation requires a single authoritative central server to sequence and transform concurrent edits, preventing true offline multi-device peer collaboration. CRDTs satisfy mathematically provable commutativity, associativity, and idempotency, allowing any client to edit offline indefinitely and deterministically converge to the exact same state upon reconnection regardless of network packet arrival order.',
    frequency_pct: 92.0,
    source_repo: 'linear_engineering'
  },

  // ── Mistral AI ──
  {
    category: 'leetcode_company',
    company_tag: 'Mistral AI',
    title: 'FlashAttention-2 Kernel Shared Memory Tiling',
    difficulty: 'hard',
    topic: 'GPU Systems & CUDA',
    url: 'https://mistral.ai/news/mixtral-of-experts/',
    question_text: 'Why is standard Multi-Head Attention memory bandwidth bound rather than compute bound, and how does FlashAttention tiling in GPU SRAM solve the quadratic IO bottleneck?',
    answer_text: 'Standard attention computes S = Q * K^T and P = softmax(S), writing N x N intermediate matrices to High Bandwidth Memory (HBM) twice. Because GPU memory bandwidth (~3 TB/s on H100) is drastically slower than tensor core compute (nearly 2,000 TFLOPS), reading/writing this intermediate matrix throttles execution. FlashAttention tiles Q, K, and V into blocks that fit in on-chip SRAM (shared memory), calculates online softmax scaling incrementally without writing the full N x N matrix to HBM, reducing HBM IO from O(N^2) to O(N).',
    frequency_pct: 98.0,
    source_repo: 'mistral_engineering'
  },
  {
    category: 'leetcode_company',
    company_tag: 'Mistral AI',
    title: 'Mixture of Experts (MoE) All-to-All Dispatch',
    difficulty: 'hard',
    topic: 'Distributed Deep Learning Systems',
    url: 'https://mistral.ai/news/mixtral-of-experts/',
    question_text: 'In an MoE model like Mixtral 8x7B with Top-2 routing across 8 GPUs, how do you route tokens to their respective experts using NCCL collectives without causing GPU pipeline bubbles?',
    answer_text: 'Tokens are routed via a learned softmax gating network selecting top-k experts. Tokens are partitioned by destination GPU and exchanged using a non-blocking ncclAllToAllv collective. To prevent GPU idle bubbles caused by uneven expert load (load imbalance), apply an auxiliary routing loss during training, set an expert capacity factor with token dropping/overflow buffers, and sort tokens by expert ID before batch GEMM execution.',
    frequency_pct: 94.0,
    source_repo: 'mistral_engineering'
  },

  // ── ElevenLabs ──
  {
    category: 'leetcode_company',
    company_tag: 'ElevenLabs',
    title: 'Sub-150ms Streaming Audio Chunking & Jitter Buffering',
    difficulty: 'hard',
    topic: 'Low-Latency Media & Systems',
    url: 'https://elevenlabs.io/docs/api-reference/text-to-speech/stream',
    question_text: 'How do you stream auto-regressive voice synthesis over WebSockets such that the browser client plays the first audible syllable in under 150ms while preventing buffer underruns during packet jitter?',
    answer_text: 'Stream raw PCM audio framed into small Opus packets (10ms to 20ms frames) immediately as the neural vocoder produces chunks, rather than waiting for complete sentences. The client maintains an adaptive jitter buffer: it pre-buffers 30-50ms of audio before starting playback. If the packet arrival rate drops, dynamic time-stretching (WSOLA algorithm) subtly slows audio playback by 5% without changing pitch, buying time for the next GPU inference batch to arrive without audible clicks or silence.',
    frequency_pct: 97.0,
    source_repo: 'elevenlabs_engineering'
  },

  // ── Cognition AI ──
  {
    category: 'leetcode_company',
    company_tag: 'Cognition AI',
    title: 'Autonomous Coding Agent Tool Loop & Self-Correction',
    difficulty: 'hard',
    topic: 'AI Agent Architecture',
    url: 'https://cognition.ai/blog/introducing-devin',
    question_text: 'Design an autonomous agent planning loop that inspects a multi-file Python bug, runs a terminal test command, parses compiler traceback errors, and iteratively applies targeted diffs until tests pass.',
    answer_text: 'Architecture: 1) Perception: Run pytest in an ephemeral PTY shell; capture stdout/stderr exit codes. 2) Root Cause Analysis: Parse the stack trace into file path, line number, and exception type. 3) Context Assembly: Read relevant file AST snippets and definitions. 4) Code Generation: Produce a unified diff rather than rewriting entire files. 5) Sandboxed Verification: Apply diff with patch, rerun test command. 6) Termination: Break loop upon exit code 0 or rollback on regression after max retry threshold.',
    frequency_pct: 96.0,
    source_repo: 'cognition_engineering'
  },

  // ── Perplexity AI ──
  {
    category: 'leetcode_company',
    company_tag: 'Perplexity AI',
    title: 'Hybrid Dense-Sparse Vector Search (BM25 + HNSW)',
    difficulty: 'medium',
    topic: 'Search & Information Retrieval',
    url: 'https://www.perplexity.ai',
    question_text: 'Why does conversational search require hybrid retrieval combining BM25 keyword matching with dense neural vector embeddings, and how do you normalize scores across the two retrieval engines?',
    answer_text: 'Dense vector embeddings excel at semantic paraphrasing and conceptual similarity but fail on exact part numbers, technical keywords, and rare names. BM25 inverted indexes excel at exact keywords but miss semantic synonyms. Use Reciprocal Rank Fusion (RRF): RRF_score(d) = sum(1 / (k + rank_i(d))) where k=60. RRF eliminates the need to calibrate disparate raw score scales (BM25 unbounded vs cosine -1..1) and reliably promotes documents that appear in top tiers of both search methods.',
    frequency_pct: 95.0,
    source_repo: 'perplexity_engineering'
  },

  // ── Kalshi ──
  {
    category: 'leetcode_company',
    company_tag: 'Kalshi',
    title: 'Lock-Free Limit Order Book Matching in Sub-Microsecond Time',
    difficulty: 'hard',
    topic: 'Low-Latency FinTech & HFT',
    url: 'https://kalshi.com',
    question_text: 'How is a price-time priority limit order book implemented to achieve sub-microsecond insertion, cancellation, and execution without dynamic heap memory allocation during trading hours?',
    answer_text: 'Pre-allocate a fixed array of Order objects (Object Pool) at startup. The order book structure consists of: 1) A fixed-size array or B-Tree of PriceLevels indexed by tick. 2) Each PriceLevel contains a doubly-linked list of Orders. 3) An OrderID-to-pointer hash map for O(1) cancellations. Matching operates on the top-of-book pointer without locks on a single CPU pinned thread (Disruptor pattern), avoiding thread context switching and cache invalidation.',
    frequency_pct: 98.0,
    source_repo: 'kalshi_engineering'
  },

  // ── PostHog ──
  {
    category: 'leetcode_company',
    company_tag: 'PostHog',
    title: 'ClickHouse ReplacingMergeTree Partitioning & Deduplication',
    difficulty: 'hard',
    topic: 'Distributed Data Systems',
    url: 'https://posthog.com/handbook',
    question_text: 'How does ClickHouse’s ReplacingMergeTree table engine handle event deduplication, and why should analytics queries use FINAL or argMax instead of relying on immediate deduplication?',
    answer_text: 'ReplacingMergeTree deduplicates rows sharing the same ORDER BY sorting key only during background part merges, which occur asynchronously at unpredictable intervals. Immediate deduplication does not happen on INSERT. To query unique latest states, either use SELECT ... FINAL (which forces an on-the-fly merge at query time, increasing CPU overhead) or use aggregate functions like argMax(val, timestamp) grouped by ID, which runs significantly faster across large partitions.',
    frequency_pct: 94.0,
    source_repo: 'posthog_engineering'
  },

  // ── Cursor ──
  {
    category: 'leetcode_company',
    company_tag: 'Cursor',
    title: 'Sub-30ms Speculative Code Autocomplete Architecture',
    difficulty: 'hard',
    topic: 'Editor Internals & Low-Latency ML',
    url: 'https://cursor.com',
    question_text: 'How does an AI editor provide code suggestions within 30 milliseconds of a keystroke without waiting for a full 200ms remote LLM inference roundtrip?',
    answer_text: 'Use Speculative Decoding and Local Prompt Caching: 1) A lightweight local model (or fast draft model) or prefix-tree trie running on device generates candidate token completions in <10ms. 2) While the user types, characters are compared against the cached speculative stream. If keystrokes match the predicted prefix, suggestions render immediately with zero network latency. 3) Full model verifies tokens in parallel batches in the background.',
    frequency_pct: 96.0,
    source_repo: 'cursor_engineering'
  },

  // ── Vercel ──
  {
    category: 'leetcode_company',
    company_tag: 'Vercel',
    title: 'V8 Isolate Cold Starts & Edge Runtime Streaming',
    difficulty: 'medium',
    topic: 'Edge Compute & Systems',
    url: 'https://vercel.com/blog/edge-runtime-architecture',
    question_text: 'How does Vercel’s Edge Runtime run user JavaScript with <5ms cold starts compared to AWS Lambda container cold starts (>200ms)?',
    answer_text: 'Standard serverless functions spin up an entire Linux container / microVM with an OS kernel, node runtime, and file system mount. V8 Isolates run thousands of distinct lightweight sandboxes within a single persistent multi-tenant process. Each isolate has its own heap and global scope with zero memory sharing, allowing new isolates to initialize in under 5ms using pre-compiled V8 heap snapshots with minimal memory overhead (<5MB per isolate).',
    frequency_pct: 93.0,
    source_repo: 'vercel_engineering'
  },

  // ── Resend ──
  {
    category: 'leetcode_company',
    company_tag: 'Resend',
    title: 'High-Volume SMTP Queue Dispatcher & Rate Limiting',
    difficulty: 'medium',
    topic: 'Distributed Systems & Protocols',
    url: 'https://resend.com/blog',
    question_text: 'Design an outbound email dispatch queue that enforces recipient-domain rate limits (e.g., max 10 concurrent connections to mx.google.com) while preventing head-of-line blocking.',
    answer_text: 'Partition outbound email queues by destination MX host rather than customer ID. Each MX host has a dedicated rate limiter bucket and token queue. A worker pool dynamically pulls from queues that have available tokens. If an MX server responds with a temporary deferral (421/450 SMTP error), the queue enters an exponential backoff state while all other domain queues continue dispatching without interruption, preventing head-of-line blocking.',
    frequency_pct: 92.0,
    source_repo: 'resend_engineering'
  }
];

async function seedTrueUpQuestions() {
  console.log('[SeedQuestions] Seeding company-tagged interview questions...');
  let inserted = 0;
  let skipped = 0;

  for (const q of TRUEUP_QUESTIONS) {
    const [[existing]] = await pool.query(
      'SELECT id FROM jobhunt_question_bank WHERE company_tag = ? AND title = ? LIMIT 1',
      [q.company_tag, q.title]
    );

    if (existing) {
      skipped++;
    } else {
      await pool.query(
        `INSERT INTO jobhunt_question_bank 
         (category, company_tag, title, difficulty, topic, url, question_text, answer_text, frequency_pct, source_repo, is_solved)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          q.category,
          q.company_tag,
          q.title,
          q.difficulty,
          q.topic,
          q.url,
          q.question_text,
          q.answer_text,
          q.frequency_pct,
          q.source_repo
        ]
      );
      inserted++;
      console.log(`[SeedQuestions] + Added: [${q.company_tag}] ${q.title} (${q.difficulty})`);
    }
  }

  console.log(`[SeedQuestions] Completed. Inserted: ${inserted}, Skipped: ${skipped}`);
  process.exit(0);
}

seedTrueUpQuestions().catch(err => {
  console.error('[SeedQuestions] Fatal error:', err);
  process.exit(1);
});
