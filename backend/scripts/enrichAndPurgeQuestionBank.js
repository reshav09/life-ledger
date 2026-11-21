/**
 * Enrich & Cleanse Question Bank
 * 1. Purges Quant/HFT questions (Optiver, Citadel, Jane Street, Kalshi) from the question bank.
 * 2. Seeds targeted, high-yield practice questions for:
 *    - MAP_IT Bhopal (FastAPI, Async DB, State Portals)
 *    - CSIR-AMPRI Bhopal (Applied ML, ResNet, XGBoost, Imbalanced Data)
 *    - ECIL (Embedded C, Deterministic Ring Buffers vs Dynamic Malloc)
 *    - PhonePe (High-Concurrency Distributed Ledger, Optimistic Locking)
 *    - Zerodha (WebSocket Ticker Broadcast, Compact Binary Feeds, Dropping Slow Consumers)
 *    - Ather Energy (IoT MQTT Telemetry Ingestion, Time-Series Storage)
 *    - Porter (Geospatial Indexing, Uber H3 / GeoHash, Nearest Driver Match)
 *    - Persistent Systems (Microservices Circuit Breaker, Resilience4j / Tenacity)
 */

const pool = require('../db/db');

async function updateQuestionBank() {
  console.log('=====================================================');
  console.log('🧹 PURGING QUANT/HFT & ENRICHING QUESTION BANK');
  console.log('=====================================================');

  // 1. Purge Quant/HFT and Wall Street proprietary questions
  const [delRes] = await pool.query(
    'DELETE FROM jobhunt_question_bank WHERE company_tag IN ("Optiver", "Citadel", "Jane Street", "Kalshi")'
  );
  console.log(`✓ Purged ${delRes.affectedRows} Quant/HFT questions.`);

  // 2. High-yield targeted questions for Indian PSUs, Govt Labs, and Premier Tech
  const newQuestions = [
    {
      category: 'psu_cs_cbt',
      company_tag: 'MAP_IT',
      title: 'Python Async/Await & Non-Blocking Database I/O (FastAPI)',
      difficulty: 'medium',
      topic: 'Web Backend & Concurrency',
      url: 'https://fastapi.tiangolo.com/async/',
      question_text: 'In FastAPI, what happens if an endpoint is declared as async def but executes a synchronous blocking function (e.g. time.sleep() or legacy blocking DB driver)? How do you prevent event loop starvation in state government cloud services?',
      answer_text: 'Declaring an endpoint as async def causes FastAPI to run it directly on the main asyncio event loop. Calling synchronous blocking I/O blocks the entire thread, halting all concurrent requests. To fix: either (1) use native async drivers (like asyncpg / aiomysql), or (2) offload blocking work to threadpool workers using starlette.concurrency.run_in_threadpool or asyncio.to_thread, or (3) declare the endpoint as standard def, which FastAPI automatically executes in a separate threadpool.',
      frequency_pct: 95.0,
      source_repo: 'psu_pyq'
    },
    {
      category: 'psu_cs_cbt',
      company_tag: 'CSIR-AMPRI',
      title: 'Machine Learning — Handling Imbalanced Sensor Data in Material Defect Detection',
      difficulty: 'medium',
      topic: 'Applied Machine Learning',
      url: 'https://scikit-learn.org/stable/modules/ensemble.html',
      question_text: 'When training a computer vision or tree-based model (e.g. ResNet / XGBoost) for defect identification where defective samples constitute < 2% of the dataset, accuracy is misleading. Which evaluation metrics and sampling techniques should be used?',
      answer_text: '1. Evaluation Metrics: PR-AUC (Precision-Recall Area Under Curve), F1-Score (specifically F-beta with beta=2 to penalize false negatives), and Cohen\'s Kappa. 2. Loss & Weighting: In XGBoost use scale_pos_weight = (count(neg) / count(pos)); in deep neural nets use Focal Loss to focus gradients on hard negative examples. 3. Resampling: Stratified K-Fold CV combined with SMOTE (Synthetic Minority Over-sampling Technique) applied strictly inside the training folds to avoid data leakage.',
      frequency_pct: 94.0,
      source_repo: 'csir_research'
    },
    {
      category: 'psu_cs_cbt',
      company_tag: 'ECIL',
      title: 'Embedded Systems & C Memory Management — Dynamic Allocation vs Static Ring Buffer',
      difficulty: 'medium',
      topic: 'Systems Programming & C',
      url: 'https://en.wikipedia.org/wiki/Circular_buffer',
      question_text: 'Why is dynamic memory allocation (malloc/free) strictly discouraged in mission-critical real-time embedded systems? Explain the advantages of a statically allocated circular buffer.',
      answer_text: '1. Determinism & Predictability: malloc() execution time is non-deterministic (heap search time varies), violating hard real-time deadlines. 2. Memory Fragmentation: Continuous allocation/deallocation leads to external heap fragmentation where total free memory exists but contiguous chunks fail, causing system crash (OOM). 3. Memory Leaks: In long-running embedded firmware, unfreed pointers cause catastrophic failure. Solution: A pre-allocated static circular buffer (FIFO) uses fixed memory at compile time, guarantees O(1) deterministic enqueue/dequeue, and requires zero heap management.',
      frequency_pct: 92.0,
      source_repo: 'psu_pyq'
    },
    {
      category: 'leetcode_company',
      company_tag: 'PhonePe',
      title: 'System Design — High-Concurrency Distributed Wallet Ledger with Optimistic Locking',
      difficulty: 'medium',
      topic: 'Distributed Systems & Databases',
      url: 'https://martinfowler.com/eaaCatalog/optimisticOfflineLock.html',
      question_text: 'How do you design a wallet debit/credit ledger service handling 50,000 TPS on peak festival days without double-spending, race conditions, or database table locks?',
      answer_text: '1. Ledger Immutability: Treat wallet ledger as append-only double-entry bookkeeping (never overwrite account balance directly; record CREDIT/DEBIT ledger entry with signed hash). 2. Concurrency Control: Use Optimistic Concurrency Control (OCC) with version columns: UPDATE accounts SET balance = balance - :amt, version = version + 1 WHERE id = :id AND version = :cur_version AND balance >= :amt. 3. Sharding & Cache: Partition account balances into Redis clusters by hash(account_id); use Redis Lua scripts for atomic pre-check and balance deduction, syncing asynchronously to MariaDB/TiDB in batches. 4. Idempotency: Every transaction carries a unique idempotency_key stored with TTL.',
      frequency_pct: 97.0,
      source_repo: 'snehasishroy'
    },
    {
      category: 'leetcode_company',
      company_tag: 'Zerodha',
      title: 'Real-Time Market Data Ticker Broadcast via WebSockets (Memory & Concurrency)',
      difficulty: 'medium',
      topic: 'Concurrency & Network Protocols',
      url: 'https://kite.trade/docs/connect/v3/websocket/',
      question_text: 'A broker ticker service receives 100,000 tick updates per second from stock exchanges and must broadcast relevant ticks to 500,000 connected user WebSockets. How do you design this with minimal memory footprint and zero socket buffer bloat in Go / Python?',
      answer_text: '1. Fan-out Pub/Sub Architecture: Group incoming exchange ticks by instrument token. Maintain an in-memory subscription map (token -> list of client channel channels). 2. Binary Encoding: Do not transmit JSON; encode ticks into compact binary buffers (e.g. 28 bytes per tick with struct pack: timestamp, token, ltp, volume). 3. Drop Slow Consumers: Give each client WebSocket connection a bounded buffer channel (e.g. 1024 slots). If a slow client channel is full, immediately drop old market depth ticks rather than blocking the broadcaster thread or bloating RAM. 4. Connection pooling with epoll/kqueue (Go goroutines or uvloop in Python).',
      frequency_pct: 96.0,
      source_repo: 'snehasishroy'
    },
    {
      category: 'leetcode_company',
      company_tag: 'Ather Energy',
      title: 'IoT Telemetry Ingestion Pipeline & Time-Series Aggregation',
      difficulty: 'medium',
      topic: 'Distributed Systems & Time-Series Data',
      url: 'https://mqtt.org/',
      question_text: 'Design an ingestion pipeline for 100,000 electric scooters transmitting battery temperature, motor RPM, and GPS coordinates every 5 seconds over MQTT/Cellular. How is data aggregated for live alerts and long-term analytics?',
      answer_text: '1. Ingestion: Scooters connect via MQTT over TLS to EMQX/Mosquitto broker brokers with QoS 0 or 1. 2. Streaming Buffer: MQTT brokers bridge telemetry messages into Apache Kafka / Redpanda partitioned by vehicle_id. 3. Real-Time Alerting: A stream processor (Apache Flink / Faust Python) computes 30-second rolling averages of battery temperature and fires thermal anomaly alerts if temperature gradient > 2 deg C/min. 4. Analytical Storage: Ingest raw logs into a time-series column store (ClickHouse / TimescaleDB) partitioned by month with rollups on 5-minute averages to minimize disk storage.',
      frequency_pct: 93.0,
      source_repo: 'snehasishroy'
    },
    {
      category: 'leetcode_company',
      company_tag: 'Porter',
      title: 'Geospatial Indexing & Nearest Logistics Driver Match',
      difficulty: 'medium',
      topic: 'Geospatial Algorithms & Redis',
      url: 'https://redis.io/commands/geosearch/',
      question_text: 'When a customer requests a mini-truck on Porter, how do you efficiently query the nearest available drivers within a 5 km radius in real-time, accounting for moving vehicles?',
      answer_text: '1. Geospatial Indexing: Use Uber H3 spatial index (hexagonal hierarchical spatial index) or Google S2 / GeoHash. Hexagonal cells maintain equidistant neighbors, unlike square grids. 2. Storage: Store active driver locations in Redis using GEOADD drivers:active <longitude> <latitude> <driver_id>. 3. Proximity Query: Execute GEOSEARCH drivers:active FROMLONLAT <cust_lon> <cust_lat> BYRADIUS 5 km WITHDIST WITHCOORD ASC COUNT 10. 4. Matching Engine: Filter the candidate drivers by vehicle type (e.g. Tata Ace vs 3-Wheeler) and driver state (online & unassigned) in memory, and dispatch matching intent with 15-second response timers.',
      frequency_pct: 94.0,
      source_repo: 'snehasishroy'
    },
    {
      category: 'leetcode_company',
      company_tag: 'Persistent Systems',
      title: 'Microservices Circuit Breaker & Resilient API Design (Resilience4j / Tenacity)',
      difficulty: 'medium',
      topic: 'Microservices & Distributed Systems',
      url: 'https://resilience4j.readme.io/docs/circuitbreaker',
      question_text: 'Explain the three states of the Circuit Breaker pattern (Closed, Open, Half-Open). How does it prevent cascading failures across microservices when a third-party dependency suffers high latency?',
      answer_text: '1. Closed State: Normal operation. Requests pass to the downstream service. Failures are tracked over a sliding window. 2. Open State: If the failure rate or slow call rate exceeds a threshold (e.g. 50%), the circuit opens immediately. Subsequent requests fail-fast immediately (returning fallback/cached data or HTTP 503) without making downstream network calls, preventing thread starvation and queue backup in the calling service. 3. Half-Open State: After a cooldown wait duration (e.g. 30 seconds), the circuit permits a configurable number of trial requests. If successful, it returns to Closed; if failures persist, it reopens. Implemented via Resilience4j in Spring Boot or Tenacity/pybreaker in Python.',
      frequency_pct: 92.0,
      source_repo: 'snehasishroy'
    }
  ];

  let addedCount = 0;
  for (const q of newQuestions) {
    const [[exists]] = await pool.query(
      'SELECT id FROM jobhunt_question_bank WHERE title = ? AND category = ? LIMIT 1',
      [q.title, q.category]
    );
    if (!exists) {
      await pool.query(
        `INSERT INTO jobhunt_question_bank 
         (category, company_tag, title, difficulty, topic, url, question_text, answer_text, frequency_pct, source_repo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [q.category, q.company_tag, q.title, q.difficulty, q.topic, q.url, q.question_text, q.answer_text, q.frequency_pct, q.source_repo]
      );
      addedCount++;
    }
  }

  console.log(`✓ Added ${addedCount} high-yield target questions.`);
  const [total] = await pool.query('SELECT count(*) as cnt FROM jobhunt_question_bank');
  console.log('✓ Total questions now in DB:', total[0].cnt);
}

if (require.main === module) {
  updateQuestionBank()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = updateQuestionBank;

