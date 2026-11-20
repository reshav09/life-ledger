const pool = require('../db/db');
const { getEvidenceBase } = require('./jobhuntEvidence');
const {parseJson}=require('./jobhuntDocuments');

/**
 * Generate 5 role-specific interview questions strictly grounded in:
 * 1. Target Opportunity requirements
 * 2. Submitted Document Package (or candidate's verified profile evidence)
 */
async function generateQuestionsForSession({ opportunity, targetRole, targetCompany, sessionType, packageDoc }) {
  const evidence = parseJson(packageDoc?.evidence_snapshot,null) || await getEvidenceBase();
  const expClaims=evidence.work_experience || [],projClaims=evidence.project || [],skillClaims=evidence.skill || [];
  const exp1=expClaims[0]?.claim || 'Choose a confirmed work example from your own experience.';
  const exp2=expClaims[1]?.claim || exp1;
  const proj1=projClaims[0]?.claim || 'Choose one of your own verified projects.';
  const topSkills=skillClaims.slice(0,8).map(x=>x.claim).join(', ') || 'Use the technologies relevant to the posting.';

  const questions = [];

  if (sessionType === 'behavioral_star') {
    questions.push({
      id: 1,
      type: 'behavioral_star',
      category: 'Project Execution & Overcoming Obstacles',
      question: `In your work at ${targetCompany ? `prior roles relevant to ${targetCompany}` : 'prior positions'}, tell me about a critical technical blocker you encountered on a production system and how you methodically resolved it.`,
      groundedEvidence: exp1,
      starGuidance: {
        situation: 'Describe the production context, the scale of the system, and why the bug/blocker was high-severity.',
        task: 'Identify your personal ownership and what needed to be delivered under timeline pressure.',
        action: 'Detail the root cause analysis, telemetry/logs analyzed, and architectural or code fix implemented.',
        result: 'State quantifiable impact (uptime, latency improvement, or engineering hours saved).'
      },
      userAnswer: '',
      feedback: null
    });

    questions.push({
      id: 2,
      type: 'behavioral_star',
      category: 'Cross-functional Collaboration & Disagreement',
      question: `Describe a situation where you had a differing technical opinion with a senior engineer or product manager regarding architecture or delivery trade-offs. How did you arrive at consensus?`,
      groundedEvidence: exp2,
      starGuidance: {
        situation: 'Set the stage of the proposal and the divergent architectural requirements.',
        task: 'Your objective in presenting data-driven reasoning rather than emotional debate.',
        action: 'How you benchmarked alternatives, created POCs, or leveraged telemetry to reach alignment.',
        result: 'The final chosen architecture, delivery velocity achieved, and how team trust was maintained.'
      },
      userAnswer: '',
      feedback: null
    });

    questions.push({
      id: 3,
      type: 'behavioral_star',
      category: 'Ownership & Innovation Under Constraints',
      question: `Walk me through a project where you took proactive initiative to automate a manual workflow or modernize legacy code without being explicitly asked.`,
      groundedEvidence: proj1,
      starGuidance: {
        situation: 'The legacy state or manual repetitive operational bottleneck observed.',
        task: 'The scope of automation you designed to eliminate toil.',
        action: 'Tools, pipelines, or containerized architecture you created.',
        result: 'Time saved per sprint or reliability improvements gained.'
      },
      userAnswer: '',
      feedback: null
    });

    questions.push({
      id: 4,
      type: 'behavioral_star',
      category: 'Mistakes & Post-Mortem Accountability',
      question: `Can you share an instance where a deployment or technical decision you made caused a regression or failed to meet expectations? What was your immediate response and long-term safeguard?`,
      groundedEvidence: 'Production deployment rollback and monitoring post-mortem',
      starGuidance: {
        situation: 'The release event and the exact nature of the regression discovered in production.',
        task: 'Your ownership of immediate containment and stakeholder communication.',
        action: 'Rollback execution, hotfix triage, and root-cause analysis (5 Whys).',
        result: 'Permanent automated safeguards added (CI regression suites, canary gates, or alerts).'
      },
      userAnswer: '',
      feedback: null
    });

    questions.push({
      id: 5,
      type: 'behavioral_star',
      category: 'Prioritization & Rapid Learning',
      question: `When asked to deliver a mission-critical feature using a technology or domain unfamiliar to you, how do you quickly ramp up and guarantee robust engineering quality?`,
      groundedEvidence: topSkills,
      starGuidance: {
        situation: 'The project scope requiring an unfamiliar tool, framework, or cloud primitive.',
        task: 'Deconstructing the learning curve within a tight delivery milestone.',
        action: 'Reading technical RFCs/source code, building rapid prototypes, and seeking peer code review.',
        result: 'High-quality on-time shipment with maintainable documentation and tests.'
      },
      userAnswer: '',
      feedback: null
    });

  } else if (sessionType === 'project_deepdive') {
    questions.push({
      id: 1,
      type: 'project_deepdive',
      category: 'System Architecture & Component Decomposition',
      question: `Deep dive into the architecture of your primary project (${proj1.slice(0, 60)}...). How are state, persistence, and external service contracts segregated?`,
      groundedEvidence: proj1,
      starGuidance: {
        situation: 'High-level component breakdown (client, API server, persistence layer, worker queue).',
        task: 'Ensuring loose coupling and clear separation of concerns.',
        action: 'Contract definition, REST/gRPC boundary handling, and database indexing strategies.',
        result: 'System stability, fast query execution, and ease of testability.'
      },
      userAnswer: '',
      feedback: null
    });

    questions.push({
      id: 2,
      type: 'project_deepdive',
      category: 'Concurrency, Data Integrity & Failure Modes',
      question: `In your backend services, how do you handle partial failures, network partitions, or concurrent write conflicts to ensure database consistency?`,
      groundedEvidence: exp2,
      starGuidance: {
        situation: 'Concurrent mutation scenario or transient upstream API timeout.',
        task: 'Preventing duplicate operations, data corruption, or deadlock states.',
        action: 'Database transaction isolation, optimistic/pessimistic locking, idempotency keys, and exponential retries.',
        result: 'Zero silent data loss and predictable recovery mechanics.'
      },
      userAnswer: '',
      feedback: null
    });

    questions.push({
      id: 3,
      type: 'project_deepdive',
      category: 'Observability & Operational Health',
      question: `If an alert fires stating p99 latency in your service jumped 10x, what is your step-by-step diagnostic triage workflow from dashboard to code line?`,
      groundedEvidence: exp1,
      starGuidance: {
        situation: 'Sudden degradation under production load.',
        task: 'Isolating whether the bottleneck is database IOPS, slow external calls, GC pauses, or CPU starvation.',
        action: 'Distributed tracing inspection, query EXPLAIN execution plan review, and heap profiling.',
        result: 'Targeted mitigation and post-mortem alerting threshold refinement.'
      },
      userAnswer: '',
      feedback: null
    });

    questions.push({
      id: 4,
      type: 'project_deepdive',
      category: 'Security & Defensive Engineering',
      question: `How do you safeguard sensitive credentials, API keys, and prevent OWASP Top 10 vulnerabilities (e.g. SQL injection, SSRF, broken auth) in your stack?`,
      groundedEvidence: 'Container security, parameterized queries, and environment secret handling',
      starGuidance: {
        situation: 'Threat modeling for user input and secret lifecycle.',
        task: 'Zero hardcoded secrets, strict input validation, and principle of least privilege.',
        action: 'Secrets manager, prepared statements, role-based access control, and CSP/CORS headers.',
        result: 'Zero unauthorized access and verified compliance.'
      },
      userAnswer: '',
      feedback: null
    });

    questions.push({
      id: 5,
      type: 'project_deepdive',
      category: 'Refactoring & Retrospective',
      question: `Looking back at your implementation of this project, what single architectural decision would you redesign today, and what would the improved design look like?`,
      groundedEvidence: proj1,
      starGuidance: {
        situation: 'Initial constraint or hasty design choice that accumulated technical debt.',
        task: 'Evaluating the scalability or maintainability cost of the initial choice.',
        action: 'The proposed refactored pattern (e.g. event-driven pub/sub, materialized views, micro-frontends).',
        result: 'Long-term maintainability and throughput improvements gained.'
      },
      userAnswer: '',
      feedback: null
    });

  } else {
    // Technical & Domain-Specific (Default)
    const roleTitle = targetRole || (opportunity ? opportunity.title : 'Software Engineer');
    const isMl = /machine learning|ml|ai|data|research/i.test(roleTitle);
    const isCloud = /cloud|devops|infra|sre|platform/i.test(roleTitle);

    if (isMl) {
      questions.push({
        id: 1,
        type: 'technical',
        category: 'Data Pipelines & Distributed Training / Inference',
        question: `For large-scale ML datasets, how do you optimize memory utilization and I/O bottlenecks during batch tokenization and feature pre-processing?`,
        groundedEvidence: 'Python, NumPy, PyTorch/TensorFlow data loaders and vectorized batch processing',
        starGuidance: {
          situation: 'High I/O wait times bottlenecking GPU/CPU compute.',
          task: 'Maximizing throughput with asynchronous prefetching and streaming chunking.',
          action: 'Memory mapping, worker pool tuning, and format serialization (Parquet/Arrow/TFRecord).',
          result: 'Sustained >90% accelerator utilization.'
        },
        userAnswer: '',
        feedback: null
      });

      questions.push({
        id: 2,
        type: 'technical',
        category: 'Model Evaluation & Data Drift',
        question: `How do you design an automated pipeline to detect data distribution drift and concept drift in a deployed inference service?`,
        groundedEvidence: 'Statistical testing (KS test, PSI) and production telemetry monitoring',
        starGuidance: {
          situation: 'Incoming inference payload distribution diverging from training distribution.',
          task: 'Real-time alert before downstream inference quality drops.',
          action: 'Rolling metric windows, embedding centroid distance monitoring, and shadow scoring.',
          result: 'Automated retraining trigger and continuous precision/recall guardrails.'
        },
        userAnswer: '',
        feedback: null
      });

      questions.push({
        id: 3,
        type: 'technical',
        category: 'Low-latency Serving & Optimization',
        question: `What quantization and compilation techniques (e.g. TensorRT, ONNX, vLLM, int8/fp16) do you employ to reduce p95 latency for real-time model serving?`,
        groundedEvidence: 'Optimized inference runtime architectures and KV-cache management',
        starGuidance: {
          situation: 'High inference latency breaching SLA under concurrent user queries.',
          task: 'Slashing latency without degrading accuracy beyond 1%.',
          action: 'Post-training quantization, kernel fusion, and continuous batching.',
          result: '3x to 5x throughput increase within same memory footprint.'
        },
        userAnswer: '',
        feedback: null
      });

      questions.push({
        id: 4,
        type: 'technical',
        category: 'Scientific Computing / Algorithmic Rigor',
        question: `Explain how numerical stability issues (e.g. vanishing gradients, floating point underflow, softmax instability) arise in deep architectures and how you diagnose and fix them.`,
        groundedEvidence: 'Log-sum-exp trick, gradient clipping, LayerNorm/RMSNorm, and mixed-precision scaling',
        starGuidance: {
          situation: 'NaN loss or exploding weight updates during training epochs.',
          task: 'Pinpointing the arithmetic breakdown in custom loss or forward layers.',
          action: 'Epsilon stabilization, log-space calculations, and gradient norm inspection.',
          result: 'Smooth convergence across deep multi-layer models.'
        },
        userAnswer: '',
        feedback: null
      });

      questions.push({
        id: 5,
        type: 'technical',
        category: 'Domain & Research Integration',
        question: `How do you stay abreast of recent preprint literature (e.g. arXiv) and translate experimental research code into reproducible, hardened production pipelines?`,
        groundedEvidence: 'Containerized research reproducibility, benchmark validation, and modular refactoring',
        starGuidance: {
          situation: 'Proof-of-concept research repository with hardcoded configurations.',
          task: 'Productionizing without introducing regressions.',
          action: 'Config isolation (Hydra/YAML), unit tests on tensor shapes, deterministic seeds, and linting.',
          result: 'Reproducible CI/CD pipelines with auditable artifact tracking.'
        },
        userAnswer: '',
        feedback: null
      });
    } else if (isCloud) {
      questions.push({
        id: 1,
        type: 'technical',
        category: 'Infrastructure as Code & Immutable Deployments',
        question: `How do you structure Terraform/CloudFormation modules to ensure drift detection, zero-downtime rolling updates, and environment parity across staging and prod?`,
        groundedEvidence: 'Terraform state locking with S3/DynamoDB, modular blueprints, and CI plan checks',
        starGuidance: {
          situation: 'Multi-environment infrastructure sprawl with manual configuration drift.',
          task: 'Enforcing declarative, auditable, and automated infrastructure lifecycle.',
          action: 'Remote state management, parameter stores, semantic versioned modules, and automated linters.',
          result: 'Zero drift and 1-click reproducible environment spin-up.'
        },
        userAnswer: '',
        feedback: null
      });
      // Add standard cloud questions...
      questions.push({
        id: 2,
        type: 'technical',
        category: 'Container Orchestration & Pod Autoscaling',
        question: `Explain how Kubernetes HPA, cluster autoscaler, and resource requests/limits interact under sudden traffic spikes. How do you prevent CPU throttling and OOMKilled events?`,
        groundedEvidence: 'Kubernetes deployment specs, metrics-server, cgroups limits, and VPA profiling',
        starGuidance: {
          situation: 'Traffic burst causing pods to crash with OOMKilled and cascading downtime.',
          task: 'Fine-tuning memory overhead and autoscaling thresholds.',
          action: 'Setting realistic limits, tuning HPA target CPU/memory percentages, and configuring PDBs.',
          result: 'Seamless horizontal scaling with zero dropped requests.'
        },
        userAnswer: '',
        feedback: null
      });
      questions.push({
        id: 3,
        type: 'technical',
        category: 'CI/CD Pipeline Security & Artifact Signing',
        question: `What steps do you take to secure software supply chains in GitHub Actions / GitLab CI (e.g. OIDC without long-lived keys, vulnerability scanning, SBOM)?`,
        groundedEvidence: 'OIDC role assumption in AWS, Trivy container scanning, signed commits',
        starGuidance: {
          situation: 'Security audit requiring elimination of static cloud access keys in CI.',
          task: 'Transitioning to short-lived identity tokens with minimal IAM privilege.',
          action: 'Configuring GitHub OIDC provider, scoped trust policies, and automated artifact scanning.',
          result: 'Zero leaked credentials and hardened compliance.'
        },
        userAnswer: '',
        feedback: null
      });
      questions.push({
        id: 4,
        type: 'technical',
        category: 'Cost Optimization & FinOps Governance',
        question: `Walk me through your methodology for auditing cloud waste (compute, unattached EBS volumes, idle NAT gateways, underutilized database instances) to achieve double-digit savings.`,
        groundedEvidence: exp1,
        starGuidance: {
          situation: 'Uncontrolled monthly cloud bill expansion.',
          task: 'Auditing and reclaiming idle capacity without degrading service SLAs.',
          action: 'Spot instance adoption, Savings Plans commit analysis, automated lifecycle rules, and right-sizing.',
          result: 'Quantifiable >30% sustained monthly cloud bill reduction.'
        },
        userAnswer: '',
        feedback: null
      });
      questions.push({
        id: 5,
        type: 'technical',
        category: 'Zero-Downtime Database Migrations',
        question: `How do you execute schema migrations on large live database tables (e.g. adding columns, rebuilding indices) without table locks or downtime?`,
        groundedEvidence: 'Expand/Contract pattern, pt-online-schema-change / gh-ost, and zero-downtime rolling updates',
        starGuidance: {
          situation: 'Table with millions of rows requiring schema modification on a 24/7 service.',
          task: 'Executing changes without blocking read/write transactions.',
          action: 'Dual-writing, backfilling in asynchronous batches, and atomic shadow table swap.',
          result: 'Seamless schema update with zero connection dropouts.'
        },
        userAnswer: '',
        feedback: null
      });
    } else {
      // General Core Full-Stack / Backend Engineering
      questions.push({
        id: 1,
        type: 'technical',
        category: 'API Design & Contract Versioning',
        question: `When designing public or microservice REST APIs, how do you handle versioning, backwards-compatibility, rate limiting, and graceful degradation?`,
        groundedEvidence: 'RESTful API architecture, OpenAPI specifications, token bucket rate limiting',
        starGuidance: {
          situation: 'Evolving an active API relied on by multiple client versions.',
          task: 'Introducing new schema capabilities without breaking legacy callers.',
          action: 'Additive schema changes, deprecation headers, and gateway rate-limiting.',
          result: 'Zero client breakage during multi-month upgrade migrations.'
        },
        userAnswer: '',
        feedback: null
      });
      questions.push({
        id: 2,
        type: 'technical',
        category: 'Database Indexing & Query Optimization',
        question: `Explain how B-Tree indexes function in relational databases like MariaDB/MySQL. When does an index fail to be used by the query optimizer?`,
        groundedEvidence: 'Composite indexes, leftmost prefix rule, EXPLAIN plans, index cardinality',
        starGuidance: {
          situation: 'Slow query doing full table scans on large tables.',
          task: 'Diagnosing why the index is bypassed by the optimizer.',
          action: 'Checking leading wildcards in LIKE, type mismatches, functions on indexed columns, and composite ordering.',
          result: '100x query speedup dropping query execution from 2.5s to 8ms.'
        },
        userAnswer: '',
        feedback: null
      });
      questions.push({
        id: 3,
        type: 'technical',
        category: 'Asynchronous Processing & Message Queues',
        question: `How do you architect background task processing (e.g. emails, reports, crawler jobs) using queues like Redis, BullMQ, or RabbitMQ to ensure at-least-once delivery?`,
        groundedEvidence: 'Asynchronous workers, idempotency keys, dead-letter queues, exponential backoff',
        starGuidance: {
          situation: 'Heavy computations or third-party webhooks timing out HTTP requests.',
          task: 'Offloading to background workers with fault-tolerant retries.',
          action: 'Worker pooling, job acknowledgments, DLQ monitoring, and idempotency tracking.',
          result: 'High client responsiveness with guaranteed processing.'
        },
        userAnswer: '',
        feedback: null
      });
      questions.push({
        id: 4,
        type: 'technical',
        category: 'Frontend State Management & Render Performance',
        question: `In modern React/SPA applications, how do you diagnose and eliminate unnecessary re-renders, layout thrashing, and memory leaks from uncleaned effects?`,
        groundedEvidence: 'React DevTools Profiler, memoization (useMemo/useCallback), abort controllers for fetch',
        starGuidance: {
          situation: 'Sluggish UI interactions or increasing heap memory over time.',
          task: 'Profiling component render cascades and listener leaks.',
          action: 'Cleaning up event listeners/timers, hoisting state properly, and virtualizing long lists.',
          result: 'Smooth 60fps scrolling and stable memory consumption.'
        },
        userAnswer: '',
        feedback: null
      });
      questions.push({
        id: 5,
        type: 'technical',
        category: 'Production Reliability & Incident Management',
        question: `Describe the end-to-end process you follow when deploying changes to production, from lint/test checks to canary releases, health checks, and rollback plans.`,
        groundedEvidence: 'Automated CI/CD pipelines, Docker health checks, staged rollout, and runbook documentation',
        starGuidance: {
          situation: 'Deploying high-impact changes to live user traffic.',
          task: 'Ensuring zero disruption and rapid rollback if unexpected errors occur.',
          action: 'Health check probing, smoke tests post-deploy, and automated blue/green switching.',
          result: 'Reliable, stress-free production deployments.'
        },
        userAnswer: '',
        feedback: null
      });
    }
  }

  return questions.map(q=>({...q,evidence_kind:[exp1,exp2,proj1].includes(q.groundedEvidence) && [...expClaims,...projClaims].some(e=>e.claim===q.groundedEvidence)?'confirmed_snapshot':'practice_reference'}));
}

/**
 * Grade user response and provide structured STAR/technical feedback
 */
function evaluateUserAnswer(question, answer) {
 const text=String(answer || '').trim(),words=text.toLowerCase().match(/[a-z]{4,}/g) || [];
 const stop=new Set(['what','when','which','that','with','your','have','from','this','explain','describe','would','does','their','into','using','question','steps','through']);
 const topics=[...new Set(`${question.question || ''} ${question.groundedEvidence || ''}`.toLowerCase().match(/[a-z]{4,}/g) || [])].filter(x=>!stop.has(x));
 const matched=topics.filter(t=>words.includes(t));
 const relevant=matched.length>=Math.min(2,topics.length) && topics.length>0;
 let score=text.length<15?10:30;
 if(relevant)score+=25;
 if(words.length>=60&&words.length<=350)score+=10;
 if(/\b(action|implemented|designed|investigated)\b/i.test(text))score+=10;
 if(/\b(result|outcome|improved|learned)\b/i.test(text))score+=5;
 if(!relevant)score=Math.min(score,35);
 return {score,verdict:relevant?'Structure review — verify technical accuracy':'Answer may be off-topic',
   assessment_scope:'Structure and topic overlap only. Technical correctness and truthfulness are not assessed.',technical_correctness:null,
   feedback:relevant?'Some question terms and answer structure are present. This is not a technical pass/fail assessment.':'The answer does not clearly address the question topics.',
   suggestions:relevant?['Check technical claims with authoritative material or a human reviewer.','Use only genuine examples and explain trade-offs.']:['Answer the actual question with a relevant, verified example.']};
}

/**
 * Start a new mock session
 */
async function startMockSession({ opportunityId, applicationId, packageId, targetRole, targetCompany, sessionType = 'technical' }) {
  let opp = null;
  if (opportunityId) {
    const [rows] = await pool.query(
      `SELECT op.*, org.name AS org_name
       FROM jobhunt_opportunities op
       LEFT JOIN jobhunt_organizations org ON op.org_id = org.id
       WHERE op.id = ?`,
      [opportunityId]
    );
    if (rows.length > 0) opp = rows[0];
  }

  let pkg = null;
  if (packageId) {
    const [pkgRows] = await pool.query('SELECT * FROM jobhunt_document_packages WHERE id = ?', [packageId]);
    if (pkgRows.length > 0) pkg = pkgRows[0];
  }

  const roleTitle = opp?.title || pkg?.role_title || targetRole || 'Software Engineer';
  const orgName = opp?.org_name || pkg?.org_name || targetCompany || 'Target Organization';
  if(pkg && opp && Number(pkg.opportunity_id)!==Number(opp.id))throw new Error('Package does not match the selected opportunity');
  if(pkg){applicationId=pkg.application_id;opportunityId=pkg.opportunity_id;}
  const stageName = sessionType === 'behavioral_star' ? 'Behavioral (STAR)'
    : sessionType === 'project_deepdive' ? 'Project Deep-Dive'
    : sessionType === 'system_design' ? 'System Design'
    : 'Technical Interview';

  const questions = await generateQuestionsForSession({
    opportunity: opp,
    targetRole: roleTitle,
    targetCompany: orgName,
    sessionType,
    packageDoc: pkg
  });

  const [res] = await pool.query(
    `INSERT INTO jobhunt_mock_sessions
      (opportunity_id, application_id, package_id, stage_name, role_title, org_name, status, current_question_index, questions_json)
     VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?)`,
    [
      opportunityId || null,
      applicationId || null,
      packageId || null,
      stageName,
      roleTitle,
      orgName,
      JSON.stringify(questions)
    ]
  );

  return {
    id: res.insertId,
    opportunity_id: opportunityId,
    application_id: applicationId,
    package_id: packageId,
    session_type: sessionType,
    stage_name: stageName,
    role_title: roleTitle,
    org_name: orgName,
    current_question_index: 0,
    questions,
    total_questions: questions.length
  };
}

/**
 * Record user's answer to a specific question, grade it, and return feedback
 */
async function submitQuestionAnswer(sessionId, questionIndex, answer) {
  const [rows] = await pool.query('SELECT * FROM jobhunt_mock_sessions WHERE id = ?', [sessionId]);
  if (rows.length === 0) throw new Error('Mock session not found');

  const session = rows[0];
  const questions = typeof session.questions_json === 'string' ? JSON.parse(session.questions_json) : session.questions_json;

  if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= questions.length || typeof answer!=='string' || answer.length>20000) {
    throw new Error('Invalid question index');
  }

  const q = questions[questionIndex];
  q.userAnswer = answer;
  const evaluation = evaluateUserAnswer(q, answer);
  q.feedback = evaluation;

  const nextIndex = Math.min(questions.length - 1, questionIndex + 1);
  const isComplete = questions.every(item => item.userAnswer && item.userAnswer.trim().length > 0);
  const totalScore = isComplete
    ? Math.round(questions.reduce((acc, item) => acc + (item.feedback?.score || 50), 0) / questions.length)
    : null;

  await pool.query(
    `UPDATE jobhunt_mock_sessions SET
       questions_json = ?,
       current_question_index = ?,
       status = ?,
       overall_score = COALESCE(?, overall_score),
       updated_at = NOW()
     WHERE id = ?`,
    [JSON.stringify(questions), nextIndex, isComplete ? 'completed' : 'active', totalScore, sessionId]
  );

  return {
    success: true,
    questionIndex,
    evaluation,
    nextIndex,
    isComplete,
    overall_score: totalScore
  };
}

/**
 * Get session by ID
 */
async function getMockSession(sessionId) {
  const [rows] = await pool.query('SELECT * FROM jobhunt_mock_sessions WHERE id = ?', [sessionId]);
  if (rows.length === 0) return null;
  const session = rows[0];
  session.questions = typeof session.questions_json === 'string' ? JSON.parse(session.questions_json) : session.questions_json;
  return session;
}

/**
 * List past sessions
 */
async function listMockSessions({ opportunityId, applicationId }) {
  const conditions = [];
  const params = [];
  if (opportunityId) {
    conditions.push('opportunity_id = ?');
    params.push(opportunityId);
  }
  if (applicationId) {
    conditions.push('application_id = ?');
    params.push(applicationId);
  }

  let sql = 'SELECT id, opportunity_id, application_id, package_id, stage_name, role_title, org_name, status, current_question_index, overall_score, created_at, updated_at FROM jobhunt_mock_sessions';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY id DESC LIMIT 20';

  const [rows] = await pool.query(sql, params);
  return rows;
}

module.exports = {
  evaluateUserAnswer,
  generateQuestionsForSession,
  startMockSession,
  submitQuestionAnswer,
  getMockSession,
  listMockSessions
};
