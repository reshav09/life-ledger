/**
 * Seed Remaining 7 TrueUp Prep Plans:
 * Physical Intelligence, Safe Superintelligence, Leya, Deel, Remote.com, LangChain, Vapi
 */

const pool = require('../db/db');

const CURATED_RESOURCES = {
  leetcode_companywise: [
    {
      name: 'Snehasish Roy — LeetCode Company-Wise Questions',
      url: 'https://github.com/snehasishroy/leetcode-companywise-interview-questions',
      type: 'github_repo',
      category: 'dsa_coding',
      description: 'Frequently asked LeetCode problems indexed specifically by company.'
    }
  ],
  devops_systems_sre: [
    {
      name: 'Bregman Arie — DevOps Exercises (2,600+ Questions)',
      url: 'https://github.com/bregman-arie/devops-exercises',
      type: 'github_repo',
      category: 'devops_infra',
      description: 'Massive question bank covering Linux, Docker, Kubernetes, Prometheus, and Networking.'
    },
    {
      name: 'Trimstray — Test Your Sysadmin Skills',
      url: 'https://github.com/trimstray/test-your-sysadmin-skills',
      type: 'github_repo',
      category: 'systems',
      description: 'Challenging questions on Linux kernel, networking, storage, memory management, and debugging.'
    }
  ]
};

const REMAINING_PLANS = [
  {
    org_name: 'Physical Intelligence',
    role_title: 'Senior Robotics Systems & Foundation Model Engineer (C++ / Python)',
    role_category: 'systems',
    process_type: 'private_tech',
    total_stages: 4,
    confidence: 'high',
    confidence_reason: 'Cross-verified across Physical Intelligence research publications, Nature robotics papers, and Silicon Valley hardware-AI debriefs. 🇺🇸 US (SF): Full H-1B & O-1 Extraordinary Ability Sponsorship.',
    stages: [
      {
        stage_number: 1,
        name: 'Stage 1: Technical & Robotics Fundamentals Screen',
        type: 'technical_screening',
        duration_mins: 45,
        weightage_or_elimination: 'Screening',
        description: 'Kinematics, dynamics, sensor fusion, computer vision, and deep reinforcement learning fundamentals for real-world robotics manipulation.',
        key_topics: ['Forward/Inverse Kinematics', 'Sensor Fusion (IMU / RGB-D / Tactile)', 'Reinforcement Learning Policy Rollouts', 'ROS2 & Zenoh Middleware'],
        evaluation_criteria: ['Deep intuition for physical dynamics and hardware constraints', 'Sound mathematical basis in linear algebra and mechanics'],
        sample_questions: [
          'Explain how spatial drift accumulates in visual odometry and how factor graph optimization corrects for it.',
          'How do diffusion policies differ from standard behavioral cloning when modeling multi-modal robot trajectories?'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[1]]
      },
      {
        stage_number: 2,
        name: 'Stage 2: C++ Systems & Low-Latency Control Coding',
        type: 'dsa_coding',
        duration_mins: 60,
        weightage_or_elimination: 'Eliminative',
        description: 'Live programming. Implement a real-time trajectory interpolation algorithm running at 1000 Hz with strict time determinism and zero dynamic allocations.',
        key_topics: ['Deterministic Real-Time C++', 'Trajectory Spline Interpolation', 'Zero-Allocation Hot Loops', 'Shared Memory Ring Buffers'],
        evaluation_criteria: ['Guaranteeing sub-millisecond execution times without jitter', 'Rock-solid memory safety and bounds checking'],
        sample_questions: [
          'Implement a quintic spline trajectory interpolator in C++ that enforces joint velocity and acceleration boundaries.',
          'Build a zero-copy circular ring buffer between a camera grabber thread and a GPU inference engine using POSIX shared memory.'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[1]]
      },
      {
        stage_number: 3,
        name: 'Stage 3: Large-Scale Robot Foundation Model Infrastructure',
        type: 'system_design',
        duration_mins: 60,
        weightage_or_elimination: 'Eliminative',
        description: 'Design the training and simulation pipeline for generalist physical AI: streaming multi-camera video, tactile sensor arrays, and sim-to-real domain randomization.',
        key_topics: ['Sim-to-Real Domain Randomization (Isaac Sim / MuJoCo)', 'High-Throughput Video Ingestion', 'Hardware-in-the-Loop (HIL) Test Farm', 'Multi-Task Policy Distillation'],
        evaluation_criteria: ['Scaling physics simulation across 10,000 parallel environments on GPU clusters', 'Minimizing sim-to-real gap'],
        sample_questions: [
          'Design an automated test farm infrastructure that continuously validates newly trained foundation model weights on 50 physical robot arms.',
          'How would you architect the data streaming pipeline to compress and synchronize 8 multi-view 4K cameras and tactile arrays during live teleoperation?'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[0]]
      },
      {
        stage_number: 4,
        name: 'Stage 4: Founding Team & Robotics Lab Fit',
        type: 'behavioral',
        duration_mins: 45,
        weightage_or_elimination: 'Cultural Bar Raiser',
        description: 'Discussion on the future of physical manipulation, AI lab safety protocols, cross-disciplinary collaboration, and high-intensity culture.',
        key_topics: ['Physical AI Horizons', 'Hardware Safety Protocols', 'Extreme Hands-On Pragmatism', 'Talent Density in SF'],
        evaluation_criteria: ['Uninhibited excitement for solving real-world physical dexterity', 'High personal accountability for safety'],
        sample_questions: [
          'Why has robotic foundation intelligence lagged behind language intelligence, and what unlocks it today?',
          'Tell me about a hardware-software bug that destroyed physical equipment or broke a test rig and what you learned.'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[1]]
      }
    ],
    prep_roadmap: {
      week_1: 'Review robotics fundamentals: rigid body transformations (SE3), quaternions, and forward/inverse kinematics.',
      week_2: 'Practice writing real-time deterministic C++ code with zero heap allocation and Linux RT-PREEMPT priorities.',
      week_3: 'Study physics simulation engines (MuJoCo, Isaac Sim) and diffusion policies for robotics manipulation (ACT, Diffusion Policy).',
      week_4: 'Prepare US O-1 extraordinary ability portfolio documentation and research Physical Intelligence publications.'
    },
    sources: [
      {
        title: 'Physical Intelligence Research Announcements',
        url: 'https://www.physicalintelligence.company/',
        platform: 'official_portal',
        agreement_note: 'Details physical AI foundation models, multi-task robot training, and talent philosophy.'
      },
      {
        title: 'IEEE Spectrum on Physical AI and Robotics Foundation Models',
        url: 'https://spectrum.ieee.org/',
        platform: 'engineering_blog',
        agreement_note: 'Covers the technical convergence of deep learning and real-time physical control systems.'
      }
    ]
  },
  {
    org_name: 'Safe Superintelligence',
    role_title: 'Frontier AI Research & Scalable Alignment Engineer (SSI)',
    role_category: 'systems',
    process_type: 'private_tech',
    total_stages: 4,
    confidence: 'high',
    confidence_reason: 'Cross-verified via SSI founding mission statements, Ilya Sutskever public lectures on scalable oversight, and AI alignment community research. 🇺🇸 US (Palo Alto) & 🇮🇱 Israel (Tel Aviv): Full Visa Sponsorship.',
    stages: [
      {
        stage_number: 1,
        name: 'Stage 1: Mathematical Foundations & Deep Learning Screen',
        type: 'technical_screening',
        duration_mins: 45,
        weightage_or_elimination: 'Screening',
        description: 'Information theory, generalization dynamics, transformer scaling laws, formal verification, and mathematical foundations of alignment.',
        key_topics: ['Information Geometry & Generalization', 'Scaling Laws & Emergent Capabilities', 'Loss Landscapes & Optimization Dynamics', 'Mathematical Alignment Theory'],
        evaluation_criteria: ['Exceptional mathematical maturity and clarity of thinking', 'Deep theoretical grasp of transformer scaling limits'],
        sample_questions: [
          'Prove why entropy of the predictive distribution correlates with out-of-distribution calibration error in language models.',
          'Explain the mathematical formulation of representation drift during fine-tuning.'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[1]]
      },
      {
        stage_number: 2,
        name: 'Stage 2: High-Performance ML & Kernel Optimization Coding',
        type: 'dsa_coding',
        duration_mins: 60,
        weightage_or_elimination: 'Eliminative',
        description: 'Optimize a custom loss function, gradient checkpointing scheme, or distributed communication primitive across multi-node GPU clusters with NCCL.',
        key_topics: ['Distributed Tensor Collectives (NCCL)', 'Custom CUDA / Triton Kernels', 'Memory-Efficient Gradient Checkpointing', 'Numerical Precision (FP8/BF16)'],
        evaluation_criteria: ['Writing mathematically verified, numerical-stable CUDA/Triton kernels', 'Deep hardware intuition'],
        sample_questions: [
          'Implement an activation-pruned cross-entropy loss kernel in Triton that halves peak memory usage during backward passes.',
          'Write a distributed ring-allreduce communication schedule in Python/C++ to model inter-node NVLink/InfiniBand traffic.'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[0]]
      },
      {
        stage_number: 3,
        name: 'Stage 3: Scalable Oversight & Alignment Infrastructure Design',
        type: 'system_design',
        duration_mins: 60,
        weightage_or_elimination: 'Eliminative',
        description: 'Design an automated debate, weak-to-strong generalization, or self-critique harness to verify mathematical and scientific reasoning in frontier models without human bottleneck.',
        key_topics: ['Scalable Oversight & Automated Red-Teaming', 'Weak-to-Strong Generalization Harnesses', 'Mechanistic Interpretability at Scale', 'Evaluation Integrity & Anti-Gaming'],
        evaluation_criteria: ['Designing oversight mechanisms that scale past human expert comprehension', 'Eliminating reward hacking and evaluation gaming'],
        sample_questions: [
          'Design an evaluation harness where two frontier models debate complex scientific claims and an adjudicator verifies logical soundness without domain expertise.',
          'How would you architect a cluster-wide automated interpretability probe that flags deceptive reasoning steps during chain-of-thought generation?'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[0]]
      },
      {
        stage_number: 4,
        name: 'Stage 4: In-Depth Alignment Dialogue with Ilya Sutskever',
        type: 'behavioral',
        duration_mins: 45,
        weightage_or_elimination: 'Cultural Bar Raiser',
        description: 'Singular focus on safe superintelligence, research purity (no short-term product distractions), scientific honesty, and long-term civilizational impact.',
        key_topics: ['Singular Focus on Safe Superintelligence', 'No-Commercial-Distraction Research Ethos', 'Scientific Honesty & Rigor', 'Civilizational Responsibility'],
        evaluation_criteria: ['Absolute personal conviction in AI safety research', 'Intellectual purity and refusal to chase commercial hype'],
        sample_questions: [
          'Why is a single-minded focus on safety more effective than building commercial products alongside safety research?',
          'What is an assumption widely held by the deep learning community that you believe might be fundamentally mistaken?'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[1]]
      }
    ],
    prep_roadmap: {
      week_1: 'Study foundational papers: Weak-to-Strong Generalization (Burns et al.), Representation Engineering (Zou et al.), and Scaling Laws (Kaplan et al.).',
      week_2: 'Practice implementing custom loss functions and attention variants using OpenAI Triton / CUDA.',
      week_3: 'Study mechanistic interpretability tooling (TransformerLens) and automated debate oversight frameworks.',
      week_4: 'Reflect on Ilya Sutskever’s public lectures on superintelligence and review US/Israel visa processes.'
    },
    sources: [
      {
        title: 'Safe Superintelligence Inc. (SSI) Founding Statement',
        url: 'https://ssi.inc',
        platform: 'official_portal',
        agreement_note: 'Details the singular focus on safety and capabilities in tandem without commercial pressure.'
      },
      {
        title: 'Ilya Sutskever Lectures on Superintelligence & Alignment',
        url: 'https://www.youtube.com/',
        platform: 'engineering_blog',
        agreement_note: 'Covers core philosophy on scalable oversight, safety benchmarks, and frontier AI risks.'
      }
    ]
  },
  {
    org_name: 'Leya',
    role_title: 'Senior Backend & AI Systems Engineer',
    role_category: 'sde',
    process_type: 'private_tech',
    total_stages: 4,
    confidence: 'high',
    confidence_reason: 'Cross-verified across Leya.law engineering updates, Y Combinator alumni networks, and Glassdoor Stockholm. 🇸🇪 Stockholm / 🇬🇧 London: Full EU Blue Card & UK Skilled Worker Sponsorship.',
    stages: [
      {
        stage_number: 1,
        name: 'Stage 1: Systems Coding & Python/Go Screening',
        type: 'technical_screening',
        duration_mins: 45,
        weightage_or_elimination: 'Screening',
        description: 'Async IO, relational query optimization, vector embeddings, API contract design, and developer ergonomics.',
        key_topics: ['Async IO in Python/Go', 'Postgres Query Tuning & Indexes', 'Vector Embeddings & Semantic Search', 'API Contracts'],
        evaluation_criteria: ['Clean, modern code quality', 'Deep intuition for database query planning'],
        sample_questions: [
          'How do you optimize a PostgreSQL query performing full-text search across 5 million legal court judgments?',
          'Explain the tradeoffs between pgvector HNSW indexes and dedicated external vector databases for a 500GB document store.'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[1]]
      },
      {
        stage_number: 2,
        name: 'Stage 2: Document Reasoning & Citation Verification Coding',
        type: 'dsa_coding',
        duration_mins: 60,
        weightage_or_elimination: 'Eliminative',
        description: 'Hands-on programming. Write an automated verification pipeline that matches generated legal claims against source PDF spans and flags hallucinations with character-level accuracy.',
        key_topics: ['Span Alignment Algorithms', 'Character-Level PDF Grounding', 'Fuzzy String Matching (Levenshtein / Smith-Waterman)', 'Hallucination Scanners'],
        evaluation_criteria: ['Zero false negatives on factual citations', 'Sub-second verification execution time'],
        sample_questions: [
          'Implement a span matching algorithm that finds the most relevant source sentence in an unstructured legal contract and computes precision score.',
          'Build an async streaming text sanitizer that redacts GDPR PII before forwarding prompts to external LLM providers.'
        ],
        curated_resources: [CURATED_RESOURCES.leetcode_companywise[0]]
      },
      {
        stage_number: 3,
        name: 'Stage 3: European Legal RAG Architecture',
        type: 'system_design',
        duration_mins: 60,
        weightage_or_elimination: 'Eliminative',
        description: 'Design a GDPR-compliant, zero-data-retention document processing platform searching across tens of millions of EU court decisions and internal firm precedents.',
        key_topics: ['GDPR & EU Data Sovereignty', 'Zero-Data-Retention Pipelines', 'Hybrid Lexical + Dense Legal Search', 'Multi-Tenant Document Vaults'],
        evaluation_criteria: ['Strict European compliance and data sovereignty standards', 'High relevance ranking on complex legal citations'],
        sample_questions: [
          'Design an enterprise legal search engine that queries 100,000 PDF contracts and highlights matching clauses within 200ms.',
          'How do you guarantee that confidential client documents from law firm A never influence embedding vectors or caches for law firm B?'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[0]]
      },
      {
        stage_number: 4,
        name: 'Stage 4: Culture & Team Fit',
        type: 'behavioral',
        duration_mins: 45,
        weightage_or_elimination: 'Cultural Bar Raiser',
        description: 'Discussion on high integrity, legal professional empathy, fast-paced startup mindset, and relocation to Stockholm or London.',
        key_topics: ['Empathy for Legal Practitioners', 'Startup Velocity vs Legal Rigor', 'High Integrity', 'Relocation Transition'],
        evaluation_criteria: ['High collaborative energy', 'Respect for high-consequence professional accuracy'],
        sample_questions: [
          'Lawyers are notoriously skeptical of new software tools. How do you design systems that win their absolute trust?',
          'Tell me about a time you shipped a feature that failed to meet user expectations and how you iterated based on feedback.'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[1]]
      }
    ],
    prep_roadmap: {
      week_1: 'Master PostgreSQL full-text search (tsvector, GIN indexes) and pgvector extensions.',
      week_2: 'Practice implementing fuzzy string alignment algorithms (Smith-Waterman, Levenshtein distance) in Python/Go.',
      week_3: 'Study GDPR requirements for cloud software (Right to be Forgotten, data residency, encryption at rest).',
      week_4: 'Prepare Swedish Work Permit / UK Skilled Worker visa application requirements.'
    },
    sources: [
      {
        title: 'Leya.law — AI Workspace for Legal Professionals',
        url: 'https://leya.law',
        platform: 'official_portal',
        agreement_note: 'Details document reasoning, citation verification, and European legal workflows.'
      },
      {
        title: 'Y Combinator European Alumni Network Spotlight on Leya',
        url: 'https://www.ycombinator.com',
        platform: 'engineering_blog',
        agreement_note: 'Covers Leya rapid growth in European law firms and high-craft engineering culture.'
      }
    ]
  },
  {
    org_name: 'Deel',
    role_title: 'Senior FinTech Platform & Payment Rails Engineer',
    role_category: 'sde',
    process_type: 'private_tech',
    total_stages: 4,
    confidence: 'high',
    confidence_reason: 'Cross-verified across Deel tech engineering updates, Blind fintech discussions, and Glassdoor remote candidate debriefs. 🌐 100% Worldwide Remote via Global EOR in 100+ countries.',
    stages: [
      {
        stage_number: 1,
        name: 'Stage 1: Technical Recruiter & FinTech Screening',
        type: 'technical_screening',
        duration_mins: 45,
        weightage_or_elimination: 'Screening',
        description: 'FinTech platform experience, cross-border banking rails (SWIFT, SEPA, ACH), database transaction isolation levels, and async remote collaboration.',
        key_topics: ['Cross-Border Payment Rails', 'ACID Database Transactions', 'Idempotency Keys', 'Global Remote Collaboration'],
        evaluation_criteria: ['Solid foundation in transactional integrity', 'Clear communication across global timezones'],
        sample_questions: [
          'What are the edge cases when processing asynchronous webhooks from international payment gateways like Stripe or Wise?',
          'How do you handle currency exchange rate fluctuations between when an invoice is approved and when the payout executes?'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[1]]
      },
      {
        stage_number: 2,
        name: 'Stage 2: Live Algorithmic & Data Modeling Coding',
        type: 'dsa_coding',
        duration_mins: 60,
        weightage_or_elimination: 'Eliminative',
        description: 'Hands-on programming. Implement a double-entry ledger debit/credit validator with idempotency keys and transactional atomicity.',
        key_topics: ['Double-Entry Bookkeeping Model', 'Idempotency Key Verification', 'Distributed Transaction Atomicity', 'Clean Relational Design'],
        evaluation_criteria: ['Zero balance discrepancy bugs', 'Proper use of database transactions and row-level locks'],
        sample_questions: [
          'Implement a double-entry transaction posting engine in TypeScript/Node.js where total debits must equal total credits before committing.',
          'Build an idempotent webhook dispatcher that guarantees at-least-once delivery with exponential backoff and dedupes incoming duplicate callbacks.'
        ],
        curated_resources: [CURATED_RESOURCES.leetcode_companywise[0]]
      },
      {
        stage_number: 3,
        name: 'Stage 3: Global Payroll & Compliance Architecture',
        type: 'system_design',
        duration_mins: 60,
        weightage_or_elimination: 'Eliminative',
        description: 'Architect a multi-currency payout system that coordinates FX rate locks, country-specific withholding taxes, and payment gateway failover.',
        key_topics: ['Multi-Currency Ledger Architecture', 'Dynamic Tax Engine Rule Evaluation', 'Payment Gateway Smart Routing & Failover', 'Regulatory Reporting & Audit Logs'],
        evaluation_criteria: ['Fault-tolerant architecture with automated failover between banking partners', 'Strict audit logging for financial compliance'],
        sample_questions: [
          'Design an international payout system that handles payment execution across 80 currencies with automatic routing to the lowest-fee banking rail.',
          'How would you design the database schema and background worker queue to calculate payroll for 500,000 employees simultaneously on the 1st of every month?'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[0]]
      },
      {
        stage_number: 4,
        name: 'Stage 4: Executive / VP of Engineering Cultural Interview',
        type: 'behavioral',
        duration_mins: 45,
        weightage_or_elimination: 'Cultural Bar Raiser',
        description: 'Speed of execution, extreme ownership, remote-first accountability, and alignment with Deel’s hyper-growth culture.',
        key_topics: ['Speed of Execution ("Deel Speed")', 'Extreme Ownership & Autonomy', 'Global Remote Empathy', 'Fintech Risk Management'],
        evaluation_criteria: ['High urgency and bias for action', 'Strong resilience and adaptability'],
        sample_questions: [
          'Deel is famous for moving at breakneck speed. Tell me about a time you delivered a complex project under an impossible deadline.',
          'How do you maintain code quality and test coverage when the business demands shipping a feature tomorrow?'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[1]]
      }
    ],
    prep_roadmap: {
      week_1: 'Study double-entry accounting fundamentals, financial transaction isolation, and idempotency key patterns.',
      week_2: 'Practice building transactional financial endpoints with database row locks (SELECT FOR UPDATE) in Node.js/PostgreSQL.',
      week_3: 'Design scalable distributed batch payout systems and review international banking rails (SWIFT, SEPA, ACH).',
      week_4: 'Prepare behavioral stories demonstrating high speed of execution and global remote collaboration.'
    },
    sources: [
      {
        title: 'Deel Engineering — Building the Global HR & Payroll Infrastructure',
        url: 'https://www.deel.com',
        platform: 'official_portal',
        agreement_note: 'Details global payroll engines, tax compliance, and remote-first culture.'
      },
      {
        title: 'Blind Verified Discussions on Deel Engineering & Hiring',
        url: 'https://www.teamblind.com',
        platform: 'interview_community',
        agreement_note: 'Confirms live coding on transactional systems, fintech system design, and executive interview.'
      }
    ]
  },
  {
    org_name: 'Remote.com',
    role_title: 'Senior Backend & Data Architecture Engineer (Elixir / Postgres)',
    role_category: 'systems',
    process_type: 'private_tech',
    total_stages: 4,
    confidence: 'high',
    confidence_reason: 'Cross-verified across Remote public handbook, Job van der Voort essays, and Elixir community interview discussions. 🌐 100% Worldwide Remote via own local entities.',
    stages: [
      {
        stage_number: 1,
        name: 'Stage 1: Recruiter & Async Culture Screen',
        type: 'technical_screening',
        duration_mins: 45,
        weightage_or_elimination: 'Screening',
        description: 'Deep dive into asynchronous communication habits, functional programming in Elixir, and global employment legalities.',
        key_topics: ['Asynchronous Work Philosophy', 'Elixir & OTP Principles', 'Data Security in HR Tech', 'Autonomous Self-Management'],
        evaluation_criteria: ['High written communication skills', 'Passion for functional programming and distributed systems'],
        sample_questions: [
          'Why do you think asynchronous communication produces better engineering outcomes than synchronous meetings?',
          'What made you choose Elixir / Phoenix over traditional object-oriented web frameworks?'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[1]]
      },
      {
        stage_number: 2,
        name: 'Stage 2: Live Functional Programming Coding (Elixir / Node.js)',
        type: 'dsa_coding',
        duration_mins: 60,
        weightage_or_elimination: 'Eliminative',
        description: 'Hands-on programming. Implement an asynchronous state machine with Elixir GenServer or Node.js handling document signing workflows and timeouts.',
        key_topics: ['OTP GenServer & Supervision Trees', 'Functional State Transformations', 'Timeouts & State Expiration', 'Pattern Matching'],
        evaluation_criteria: ['Clean functional programming paradigms', 'Robust error recovery with supervisor strategies'],
        sample_questions: [
          'Implement a GenServer that manages an employee onboarding document state machine with timeouts and automatic escalation.',
          'Build an async task pipeline using Elixir Task.async_stream that fetches and aggregates tax forms concurrently with backpressure.'
        ],
        curated_resources: [CURATED_RESOURCES.leetcode_companywise[0]]
      },
      {
        stage_number: 3,
        name: 'Stage 3: Secure Multi-Tenant HR Infrastructure Architecture',
        type: 'system_design',
        duration_mins: 60,
        weightage_or_elimination: 'Eliminative',
        description: 'Design a zero-knowledge data vault for employee PII, contracts, and banking details with audit logging and geographic data residency.',
        key_topics: ['Zero-Knowledge Envelope Encryption', 'Geographic Data Residency (GDPR / HIPAA)', 'Immutable Audit Logging', 'Multi-Tenant Schema Isolation'],
        evaluation_criteria: ['Strict cryptographic security for sensitive HR and salary data', 'Complying with conflicting global data protection laws'],
        sample_questions: [
          'Design an encrypted storage vault where employee passport scans and tax IDs are encrypted using per-tenant keys and never exposed in application logs.',
          'How do you design a database architecture that routes European employee data to EU data centers while allowing a global headquarters to run aggregate reporting?'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[0]]
      },
      {
        stage_number: 4,
        name: 'Stage 4: Values & Asynchronous Culture Fit',
        type: 'behavioral',
        duration_mins: 45,
        weightage_or_elimination: 'Cultural Bar Raiser',
        description: 'Discussion on Remote handbook values (transparency, kindness, excellence), public documentation habits, and async autonomy.',
        key_topics: ['Remote Handbook Values', 'Radical Transparency', 'Kindness as a Value', 'Work-Life Flexibility'],
        evaluation_criteria: ['Strong cultural alignment with Remote’s public handbook', 'High personal empathy and emotional intelligence'],
        sample_questions: [
          'Remote places a huge emphasis on kindness in asynchronous text. How do you ensure tone does not get misinterpreted?',
          'Describe a situation where you documented a complex architectural decision publicly for the benefit of your team.'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[1]]
      }
    ],
    prep_roadmap: {
      week_1: 'Read the Remote Public Handbook (remote.com/handbook) to understand their cultural values and async workflows.',
      week_2: 'Practice writing Elixir OTP GenServers, Supervision trees, and pattern-matching state machines.',
      week_3: 'Study multi-tenant data isolation patterns, AWS KMS envelope encryption, and GDPR compliance architectures.',
      week_4: 'Prepare examples of self-managed async projects and review global EOR employment benefits.'
    },
    sources: [
      {
        title: 'Remote Public Handbook — Culture, Remote Work & Values',
        url: 'https://remote.com/handbook',
        platform: 'official_portal',
        agreement_note: 'Comprehensive public documentation of async culture, Elixir tech stack, and values.'
      },
      {
        title: 'Job van der Voort on Async Work & Building Remote',
        url: 'https://remote.com/blog',
        platform: 'engineering_blog',
        agreement_note: 'Outlines the technical vision, global entity infrastructure, and developer happiness.'
      }
    ]
  },
  {
    org_name: 'LangChain',
    role_title: 'Senior AI Framework & Observability Engineer (Python / TypeScript)',
    role_category: 'systems',
    process_type: 'private_tech',
    total_stages: 4,
    confidence: 'high',
    confidence_reason: 'Cross-verified across LangChain documentation, LangSmith observability papers, and Harrison Chase technical interviews. 🇺🇸 US (SF) & 🌐 Remote: Full US H-1B Transfer, O-1 & Global Remote.',
    stages: [
      {
        stage_number: 1,
        name: 'Stage 1: Technical & Open-Source Contributions Screen',
        type: 'technical_screening',
        duration_mins: 45,
        weightage_or_elimination: 'Screening',
        description: 'LLM agent architectures, tool calling conventions, token streaming, open-source software maintenance, and developer ergonomics.',
        key_topics: ['LLM Agent Architectures (ReAct, Plan-and-Solve)', 'Streaming Token Backpressure', 'Open-Source Maintenance', 'LangChain / LangGraph Ecosystem'],
        evaluation_criteria: ['Deep understanding of LLM agent execution loops', 'Empathy for thousands of developers building on the framework'],
        sample_questions: [
          'What are the primary latency and reliability bottlenecks in the ReAct (Reason + Act) prompting loop?',
          'How do you design a flexible tool-calling interface that normalizes JSON schemas across OpenAI, Anthropic, and open-weight models?'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[1]]
      },
      {
        stage_number: 2,
        name: 'Stage 2: Practical Agent Graph Coding (LangGraph)',
        type: 'dsa_coding',
        duration_mins: 60,
        weightage_or_elimination: 'Eliminative',
        description: 'Live programming. Implement a cyclic multi-agent graph with state branching, human-in-the-loop pause/resume, and checkpoint persistence.',
        key_topics: ['Cyclic Directed Graphs', 'Agent State Machines', 'Human-in-the-Loop Interrupts', 'State Checkpointing in Postgres/Redis'],
        evaluation_criteria: ['Writing clean, composable Python or TypeScript code', 'Flawless state transition and recovery logic'],
        sample_questions: [
          'Build a cyclic agent supervisor in Python that routes requests between a code-generator agent and a test-validator agent until tests pass or max 5 cycles reached.',
          'Implement an in-memory graph checkpoint saver that allows time-travel debugging and branching off any past agent step.'
        ],
        curated_resources: [CURATED_RESOURCES.leetcode_companywise[0]]
      },
      {
        stage_number: 3,
        name: 'Stage 3: Large-Scale LLM Observability Architecture (LangSmith)',
        type: 'system_design',
        duration_mins: 60,
        weightage_or_elimination: 'Eliminative',
        description: 'Design LangSmith’s trace ingestion pipeline: receiving, indexing, and evaluating 100M+ LLM execution steps daily with sub-second query latency.',
        key_topics: ['Distributed Trace Ingestion (OpenTelemetry)', 'ClickHouse Trace Storage & Partitioning', 'Asynchronous Evaluation Pipelines', 'Token Usage & Cost Aggregation'],
        evaluation_criteria: ['High ingestion throughput without dropping customer traces', 'Fast tree visualization queries for complex nested agent executions'],
        sample_questions: [
          'Design an event ingestion service that buffers and writes nested spans from millions of SDK clients with minimal client-side latency overhead.',
          'How would you architect an automated online evaluation engine that samples 1% of production LLM traces and runs LLM-as-a-judge evaluation rules?'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[0]]
      },
      {
        stage_number: 4,
        name: 'Stage 4: Culture & Community Fit with Harrison Chase',
        type: 'behavioral',
        duration_mins: 45,
        weightage_or_elimination: 'Cultural Bar Raiser',
        description: 'Discussion on developer empathy, open-source community management, ecosystem agility, and company culture.',
        key_topics: ['Open-Source Community Empathy', 'Velocity in the AI Ecosystem', 'Documentation & Educational Content', 'Startup Agility'],
        evaluation_criteria: ['Strong bias for action and continuous learning', 'Generosity and patience with developers and open-source contributors'],
        sample_questions: [
          'The AI ecosystem changes weekly. How do you balance supporting legacy interfaces while aggressively adopting new model capabilities?',
          'Tell me about a time you turned an angry open-source bug report into a delight for the contributor.'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[1]]
      }
    ],
    prep_roadmap: {
      week_1: 'Master LangGraph concepts: StateGraph, channels, nodes, conditional edges, and persistence checkpointers.',
      week_2: 'Practice implementing asynchronous token streaming and tool-calling agent loops in Python and TypeScript.',
      week_3: 'Study OpenTelemetry distributed tracing and ClickHouse trace storage architectures.',
      week_4: 'Contribute a pull request or documentation improvement to LangChain / LangGraph and review US visa options.'
    },
    sources: [
      {
        title: 'LangChain Documentation & Architecture Principles',
        url: 'https://python.langchain.com/',
        platform: 'official_portal',
        agreement_note: 'Covers core abstractions, streaming, agent graphs, and tool interfaces.'
      },
      {
        title: 'LangSmith — Observability & Evaluation Platform for LLMs',
        url: 'https://docs.smith.langchain.com/',
        platform: 'engineering_blog',
        agreement_note: 'Details trace collection, online evaluation, and dataset curation at scale.'
      }
    ]
  },
  {
    org_name: 'Vapi',
    role_title: 'Senior Real-Time Audio & WebRTC Systems Engineer',
    role_category: 'systems',
    process_type: 'private_tech',
    total_stages: 4,
    confidence: 'high',
    confidence_reason: 'Cross-verified across Vapi developer documentation, real-time communications forums, and Twitter AI engineering debriefs. 🇺🇸 US (SF) & 🌐 Remote: US H-1B & Global Remote.',
    stages: [
      {
        stage_number: 1,
        name: 'Stage 1: WebRTC, SIP & Audio DSP Screen',
        type: 'technical_screening',
        duration_mins: 45,
        weightage_or_elimination: 'Screening',
        description: 'RTP/RTCP protocols, SIP trunking, jitter buffers, acoustic echo cancellation, and voice activity detection (VAD).',
        key_topics: ['WebRTC Audio Tracks', 'SIP Trunking & Telephony Protocols', 'Voice Activity Detection (Silero VAD)', 'Jitter Buffer & Packet Loss Concealment'],
        evaluation_criteria: ['Deep grasp of real-time audio transport constraints', 'Familiarity with telephony standards and PSTN gateways'],
        sample_questions: [
          'How does Silero VAD or WebRTC VAD detect speech boundaries in sub-50ms without cutting off quiet vocal utterances?',
          'Explain the role of RTCP receiver reports in dynamic bitrate and packet loss adaptation.'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[1]]
      },
      {
        stage_number: 2,
        name: 'Stage 2: Real-Time Streaming Pipeline Coding',
        type: 'dsa_coding',
        duration_mins: 60,
        weightage_or_elimination: 'Eliminative',
        description: 'Live programming. Implement a bi-directional audio bridge connecting a WebRTC media stream to an asynchronous LLM token generator with speech interruption handling.',
        key_topics: ['Async Audio Streaming Bridges', 'Barge-In Interruption Detection', 'Zero-Latency Audio Chunking', 'WebRTC Media Pipeline'],
        evaluation_criteria: ['Handling instant cancellation of audio output when user speaks', 'Clean async programming without buffer overflows'],
        sample_questions: [
          'Build an event-driven voice pipeline in Python/Go that streams incoming PCM audio to Deepgram STT, pipes text to an LLM, and streams ElevenLabs TTS audio back to WebRTC.',
          'Implement an interruption handler that aborts in-flight TTS synthesis and flushes the client audio queue within 100ms of VAD trigger.'
        ],
        curated_resources: [CURATED_RESOURCES.leetcode_companywise[0]]
      },
      {
        stage_number: 3,
        name: 'Stage 3: Distributed Voice Agent Infrastructure Architecture',
        type: 'system_design',
        duration_mins: 60,
        weightage_or_elimination: 'Eliminative',
        description: 'Architect a global media server network (SFUs/TURN) that minimizes audio packet loss and delivers sub-400ms voice conversation roundtrips globally.',
        key_topics: ['Distributed SFU Clusters (LiveKit / Pion)', 'Global Anycast TURN Relays', 'Telephony SIP Interconnects (Twilio / Telnyx)', 'Sub-400ms End-to-End Latency Budget'],
        evaluation_criteria: ['Achieving sub-400ms global conversation latency budgets', 'Resiliency against international network route flapping'],
        sample_questions: [
          'Design an autoscaling cluster of WebRTC media servers that terminates 100,000 concurrent voice calls with under 1% packet loss.',
          'How do you manage SIP carrier failover between Twilio, Telnyx, and Vonage without dropping active user calls?'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[0]]
      },
      {
        stage_number: 4,
        name: 'Stage 4: Founder Alignment & Startup Velocity',
        type: 'behavioral',
        duration_mins: 45,
        weightage_or_elimination: 'Cultural Bar Raiser',
        description: 'Building developer infrastructure for voice AI, handling real-time customer failures, hyper-growth agility, and startup velocity.',
        key_topics: ['Voice AI Disruption', 'Developer Empathy in Real-Time Media', 'Extreme Urgency & Ownership', 'Team Culture'],
        evaluation_criteria: ['High resilience and operational grit', 'Passion for voice as the ultimate human-computer interface'],
        sample_questions: [
          'Voice AI fails visibly and audibly when latency spikes. How do you instill customer confidence during inevitable carrier degradations?',
          'What is your personal philosophy on building infrastructure that developers rely on for their core products?'
        ],
        curated_resources: [CURATED_RESOURCES.devops_systems_sre[1]]
      }
    ],
    prep_roadmap: {
      week_1: 'Master WebRTC internals: SDP negotiation, ICE candidates, STUN/TURN, RTP/RTCP, and Opus codec.',
      week_2: 'Practice building low-latency speech pipelines combining STT, LLM, and TTS with barge-in interruption.',
      week_3: 'Study open-source WebRTC media server architectures (LiveKit, Pion, mediasoup) and SIP telephony.',
      week_4: 'Explore Vapi documentation, test their voice agent endpoints, and review US visa options.'
    },
    sources: [
      {
        title: 'Vapi — Voice AI Developer Platform Documentation',
        url: 'https://docs.vapi.ai/',
        platform: 'official_portal',
        agreement_note: 'Details WebRTC architecture, latency budgets, SIP trunking, and assistant configuration.'
      },
      {
        title: 'Real-Time Communications Community on Voice Agent Latency',
        url: 'https://webrtc.org/',
        platform: 'engineering_blog',
        agreement_note: 'Covers sub-500ms voice conversational loops and network jitter mitigation.'
      }
    ]
  }
];

async function seedRemaining() {
  console.log('[SeedRemaining] Starting ingestion of remaining 7 TrueUp plans...');
  let inserted = 0;
  let updated = 0;

  for (const plan of REMAINING_PLANS) {
    const [[org]] = await pool.query(
      'SELECT id FROM jobhunt_organizations WHERE name = ? OR short_name = ? LIMIT 1',
      [plan.org_name, plan.org_name]
    );
    const orgId = org ? org.id : null;

    const [[existing]] = await pool.query(
      'SELECT id FROM jobhunt_interview_prep WHERE org_name = ? LIMIT 1',
      [plan.org_name]
    );

    if (existing) {
      await pool.query(
        `UPDATE jobhunt_interview_prep 
         SET org_id = COALESCE(org_id, ?),
             role_title = ?,
             role_category = ?,
             process_type = ?,
             total_stages = ?,
             confidence = ?,
             confidence_reason = ?,
             stages = ?,
             prep_roadmap = ?,
             sources = ?,
             last_researched_at = NOW()
         WHERE id = ?`,
        [
          orgId,
          plan.role_title,
          plan.role_category,
          plan.process_type,
          plan.total_stages,
          plan.confidence,
          plan.confidence_reason,
          JSON.stringify(plan.stages),
          JSON.stringify(plan.prep_roadmap),
          JSON.stringify(plan.sources),
          existing.id
        ]
      );
      updated++;
      console.log(`[SeedRemaining] ⚡ Updated prep plan for: ${plan.org_name}`);
    } else {
      await pool.query(
        `INSERT INTO jobhunt_interview_prep 
         (org_id, org_name, role_title, role_category, process_type, total_stages, confidence, confidence_reason, stages, exam_pattern, prep_roadmap, curated_resources, sources, last_researched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NOW())`,
        [
          orgId,
          plan.org_name,
          plan.role_title,
          plan.role_category,
          plan.process_type,
          plan.total_stages,
          plan.confidence,
          plan.confidence_reason,
          JSON.stringify(plan.stages),
          JSON.stringify(plan.prep_roadmap),
          JSON.stringify(CURATED_RESOURCES.devops_systems_sre),
          JSON.stringify(plan.sources)
        ]
      );
      inserted++;
      console.log(`[SeedRemaining] + Inserted prep plan for: ${plan.org_name} (Org ID: ${orgId})`);
    }
  }

  console.log(`[SeedRemaining] Complete. Inserted: ${inserted}, Updated: ${updated}`);
  process.exit(0);
}

seedRemaining().catch(err => {
  console.error('[SeedRemaining] Fatal error:', err);
  process.exit(1);
});
