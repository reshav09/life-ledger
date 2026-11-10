const pool = require('../db/db');

// The 5 companies already in the DB to update with full addresses, ATS configs, and clean metadata
const updates = [
  {
    id: 12249, // Even Healthcare
    name: 'Even Healthcare',
    short_name: 'Even',
    sector: 'Healthcare',
    website: 'https://even.in',
    careers_url: 'https://jobs.pyjamahr.com/even-healthcare',
    ats_type: 'pyjamahr',
    ats_id: 'even-healthcare',
    region: 'Bengaluru',
    quality_score: 92,
    notes: "📍 No. 1335, Indiranagar, Bengaluru — 560038 | HealthTech unicorn aspirant & managed care hospital operator. Direct PyjamaHR ATS connector. High base pay, 3% referral bonus, relocation support."
  },
  {
    id: 12250, // Whatfix
    name: 'Whatfix',
    short_name: 'Whatfix',
    sector: 'Enterprise Software',
    website: 'https://whatfix.com',
    careers_url: 'https://whatfix101.hire.trakstar.com/?loc=&rsu=mile&city=Bengaluru&q=&limit=25#content',
    ats_type: 'custom_scrape',
    ats_id: null,
    region: 'Bengaluru',
    quality_score: 91,
    notes: "📍 No. 1090E, HSR Layout Sector 3, Bengaluru — 560102 | SaaS Unicorn ($900M+). Backed by SoftBank & Peak XV. Top-tier B2B engineering, ₹28-55+ LPA CTC + ESOPs. Bengaluru & remote."
  },
  {
    id: 12258, // Zepto
    name: 'Zepto',
    short_name: 'Zepto',
    sector: 'Quick Commerce',
    website: 'https://zepto.com',
    careers_url: 'https://boards.greenhouse.io/zeptonow',
    ats_type: 'greenhouse',
    ats_id: 'zeptonow',
    region: 'Bengaluru',
    quality_score: 95,
    notes: "📍 No. 773, Kaikondarahalli, Bengaluru — 560103 | Decacorn-trajectory Quick Commerce ($5B). Hyper-growth, high compensation (₹32-60+ LPA). Distributed inventory optimization & real-time dispatch systems. Greenhouse ATS enabled."
  },
  {
    id: 12262, // Atlan
    name: 'Atlan',
    short_name: 'Atlan',
    sector: 'Data Software',
    website: 'https://atlan.com',
    careers_url: 'https://jobs.lever.co/atlan',
    ats_type: 'lever',
    ats_id: 'atlan',
    region: 'New Delhi',
    quality_score: 94,
    notes: "📍 WeWork Eldeco Centre, Malviya Nagar, New Delhi — 110017 | Modern data stack unicorn ($750M+). Sequoia/Peak XV backed. 100% remote-first culture, top cash + equity compensation (₹35-65 LPA). Lever ATS enabled."
  },
  {
    id: 12264, // Navi Technologies
    name: 'Navi',
    short_name: 'Navi',
    sector: 'Financial Services',
    website: 'https://navi.com',
    careers_url: 'https://boards.greenhouse.io/navitech',
    ats_type: 'greenhouse',
    ats_id: 'navitech',
    region: 'Bengaluru',
    quality_score: 92,
    notes: "📍 Vaishnavi Tech Square, Iballur, Bengaluru — 560102 | Digital financial services founded by Sachin Bansal (Flipkart co-founder). Known for high fixed pay without ESOP inflation (₹35-60+ LPA). Greenhouse ATS enabled."
  }
];

// The 55 new companies to insert
const newCompanies = [
  // 1-10: AI & Data
  {
    name: "Sarvam AI", short_name: "Sarvam", sector: "Generative AI", org_type: "startup",
    website: "https://sarvam.ai", careers_url: "https://boards.greenhouse.io/sarvam",
    region: "Bengaluru", ats_type: "greenhouse", ats_id: "sarvam", quality_score: 95,
    notes: "📍 Urban Vault 732, Indiranagar, Bengaluru — 560038 | India's leading sovereign Indic-language LLM company. Raised $41M Series A (Lightspeed, Peak XV). High compensation for ML/systems engineers."
  },
  {
    name: "Gnani.ai", short_name: "Gnani", sector: "Enterprise AI", org_type: "startup",
    website: "https://gnani.ai", careers_url: "https://gnani.ai/careers/",
    region: "Bengaluru", ats_type: "custom_scrape", ats_id: null, quality_score: 83,
    notes: "📍 Lamora Qube 94, Basavanagudi, Bengaluru — 560004 | Conversational voice AI and speech analytics platform for BFSI & enterprise. Backed by Samsung Ventures."
  },
  {
    name: "Ema", short_name: "Ema", sector: "Enterprise AI", org_type: "startup",
    website: "https://ema.ai", careers_url: "https://jobs.ashbyhq.com/ema",
    region: "Bengaluru", ats_type: "ashby", ats_id: "ema", quality_score: 94,
    notes: "📍 No. 558, Indiranagar, Bengaluru — 560038 | Universal AI Employee platform automating complex enterprise workflows. Raised $61M (Accel, Section 32, Prosus). Top-tier compensation."
  },
  {
    name: "Uniphore", short_name: "Uniphore", sector: "Enterprise AI", org_type: "startup",
    website: "https://uniphore.com", careers_url: "https://jobs.smartrecruiters.com/Uniphore",
    region: "Chennai", ats_type: "smartrecruiters", ats_id: "Uniphore", quality_score: 90,
    notes: "📍 IIT Madras Research Park, Taramani, Chennai — 600113 | Conversational AI & generative AI unicorn ($2.5B valuation). Global enterprise customers."
  },
  {
    name: "Emergent", short_name: "Emergent", sector: "AI Software", org_type: "startup",
    website: "https://emergent.sh", careers_url: "https://emergent.sh/careers",
    region: "Bengaluru", ats_type: "custom_scrape", ats_id: null, quality_score: 82,
    notes: "📍 WeWork Roshni Tech Hub, Marathahalli, Bengaluru — 560037 | AI application development and generative AI workflow systems."
  },
  {
    name: "Netradyne", short_name: "Netradyne", sector: "AI & Mobility", org_type: "startup",
    website: "https://netradyne.com", careers_url: "https://boards.greenhouse.io/netradyne",
    region: "Bengaluru", ats_type: "greenhouse", ats_id: "netradyne", quality_score: 91,
    notes: "📍 HM Tech Park, Whitefield, Bengaluru — 560066 | Edge AI and computer vision platform for fleet safety and automated driving analytics. Raised $150M+ (SoftBank)."
  },
  {
    name: "UnifyApps", short_name: "UnifyApps", sector: "Enterprise AI", org_type: "startup",
    website: "https://unifyapps.com", careers_url: "https://jobs.lever.co/unifyapps",
    region: "Gurugram", ats_type: "lever", ats_id: "unifyapps", quality_score: 88,
    notes: "📍 Magnum Global Park, Tower 2, Sector 58, Gurugram — 122011 | Unified enterprise integration and AI orchestration platform. Founded by Sprinklr alumni, backed by Elevation Capital."
  },
  {
    name: "Composio", short_name: "Composio", sector: "Developer Tools", org_type: "startup",
    website: "https://composio.dev", careers_url: "https://jobs.ashbyhq.com/composio",
    region: "Bengaluru", ats_type: "ashby", ats_id: "composio", quality_score: 93,
    notes: "📍 Bengaluru, Karnataka | Leading developer platform connecting AI agents & LLMs to 200+ external tools and APIs. 20K+ GitHub stars, YC-backed. High compensation."
  },
  {
    name: "Smallest.ai", short_name: "Smallest", sector: "Voice AI", org_type: "startup",
    website: "https://smallest.ai", careers_url: "https://jobs.ashbyhq.com/smallest",
    region: "Bengaluru", ats_type: "ashby", ats_id: "smallest", quality_score: 91,
    notes: "📍 No. 541, Indiranagar, Bengaluru — 560038 | High-throughput, ultra-low-latency Lightning voice synthesis foundation models (<100ms response). Deep research focus."
  },
  {
    name: "Atomicwork", short_name: "Atomicwork", sector: "Enterprise Software", org_type: "startup",
    website: "https://atomicwork.com", careers_url: "https://jobs.lever.co/atomicwork",
    region: "Bengaluru", ats_type: "lever", ats_id: "atomicwork", quality_score: 88,
    notes: "📍 Ecospace Campus 3B, Bellandur, Bengaluru — 560103 | Modern AI-powered employee service management and internal IT support platform. Raised $25M (Z47, Storm Ventures)."
  },

  // 11-20: Software & SaaS
  {
    name: "MoEngage", short_name: "MoEngage", sector: "Marketing Software", org_type: "startup",
    website: "https://moengage.com", careers_url: "https://boards.greenhouse.io/moengage",
    region: "Bengaluru", ats_type: "greenhouse", ats_id: "moengage", quality_score: 90,
    notes: "📍 Salarpuria Tower II, Koramangala, Bengaluru — 560034 | Intelligent customer engagement platform processing billions of interactions daily. Raised $100M+ (Goldman Sachs)."
  },
  {
    name: "Darwinbox", short_name: "Darwinbox", sector: "HR Software", org_type: "startup",
    website: "https://darwinbox.com", careers_url: "https://jobs.lever.co/darwinbox",
    region: "Hyderabad", ats_type: "lever", ats_id: "darwinbox", quality_score: 91,
    notes: "📍 RMZ Futura Block C, HITEC City, Hyderabad — 500081 | Cloud HCM unicorn ($1B+) serving 900+ global enterprises. Backed by TCV, Salesforce Ventures, Peak XV."
  },
  {
    name: "Rocketlane", short_name: "Rocketlane", sector: "Enterprise Software", org_type: "startup",
    website: "https://rocketlane.com", careers_url: "https://boards.greenhouse.io/rocketlane",
    region: "Chennai", ats_type: "greenhouse", ats_id: "rocketlane", quality_score: 89,
    notes: "📍 Kalpatharu No. 2, Thuraipakkam, Chennai — 600097 | Client onboarding and project delivery platform. Raised $45M (8VC, Matrix, Nexus). High developer velocity."
  },
  {
    name: "SpotDraft", short_name: "SpotDraft", sector: "Legal Software", org_type: "startup",
    website: "https://spotdraft.com", careers_url: "https://jobs.lever.co/spotdraft",
    region: "Bengaluru", ats_type: "lever", ats_id: "spotdraft", quality_score: 88,
    notes: "📍 No. 1193–1194, HSR Layout Sector 7, Bengaluru — 560102 | AI contract automation and lifecycle management software for legal & revenue teams. Raised $26M (Premji Invest)."
  },
  {
    name: "SuperOps", short_name: "SuperOps", sector: "IT Software", org_type: "startup",
    website: "https://superops.com", careers_url: "https://superops.freshteam.com/jobs",
    region: "Chennai", ats_type: "custom_scrape", ats_id: null, quality_score: 86,
    notes: "📍 Hardy Tower, Taramani, Chennai — 600113 | AI-powered Unified PSA-RMM platform for managed service providers. Raised $26M+ (March Capital, Matrix)."
  },
  {
    name: "Lucidity", short_name: "Lucidity", sector: "Cloud Software", org_type: "startup",
    website: "https://lucidity.cloud", careers_url: "https://jobs.lever.co/lucidity2",
    region: "Bengaluru", ats_type: "lever", ats_id: "lucidity2", quality_score: 91,
    notes: "📍 Vaishnavi Tech Park, Ambalipura, Bengaluru — 560103 | Autonomous multi-cloud storage orchestration engine. Zero-downtime auto-scaling block storage. Top compensation."
  },
  {
    name: "TestMu AI", short_name: "TestMu", sector: "Software Testing", org_type: "startup",
    website: "https://testmuai.com", careers_url: "https://jobs.lever.co/testmu",
    region: "Noida", ats_type: "lever", ats_id: "testmu", quality_score: 85,
    notes: "📍 Noida One Tower A, Sector 62, Noida — 201309 | Next-gen AI test execution & quality engineering cloud platform (evolved with LambdaTest ecosystem)."
  },
  {
    name: "FinBox", short_name: "FinBox", sector: "Lending Software", org_type: "startup",
    website: "https://finbox.in", careers_url: "https://jobs.lever.co/finbox-2",
    region: "Bengaluru", ats_type: "lever", ats_id: "finbox-2", quality_score: 86,
    notes: "📍 Vaishnavi Sovereign 84/1, Bellandur, Bengaluru — 560103 | Embedded credit infrastructure & device data alternative underwriting APIs for top Indian fintechs."
  },

  // 21-30: Finance & Fintech
  {
    name: "Juspay", short_name: "Juspay", sector: "Payments", org_type: "startup",
    website: "https://juspay.io", careers_url: "https://jobs.lever.co/juspay",
    region: "Bengaluru", ats_type: "lever", ats_id: "juspay", quality_score: 96,
    notes: "📍 Stallion Business Center 444, Koramangala, Bengaluru — 560095 | Core payment orchestration infrastructure powering Amazon Pay, Swiggy, Cred, Google Pay India. Renowned functional programming (Haskell/PureScript) and top CTC (₹35-65 LPA)."
  },
  {
    name: "Perfios", short_name: "Perfios", sector: "Financial Software", org_type: "startup",
    website: "https://perfios.ai", careers_url: "https://perfios.ai/career/",
    region: "Bengaluru", ats_type: "custom_scrape", ats_id: null, quality_score: 90,
    notes: "📍 HM Vibha Towers 66/525, Adugodi, Bengaluru — 560030 | B2B SaaS FinTech unicorn ($1B+) serving 1,000+ banks and NBFCs across 18 countries. Raised $229M (Kedaara Capital, Teachers' Venture Growth)."
  },
  {
    name: "Scapia", short_name: "Scapia", sector: "Travel & Payments", org_type: "startup",
    website: "https://scapia.cards", careers_url: "https://jobs.lever.co/scapia",
    region: "Bengaluru", ats_type: "lever", ats_id: "scapia", quality_score: 89,
    notes: "📍 Mantri Commercio Tower B, Bellandur, Bengaluru — 560103 | Co-branded travel credit card & rewards fintech founded by ex-Flipkart leadership. Backed by Matrix Partners & Elevation."
  },
  {
    name: "Mintifi", short_name: "Mintifi", sector: "Business Finance", org_type: "startup",
    website: "https://mintifi.com", careers_url: "https://jobs.lever.co/mintifi",
    region: "Mumbai", ats_type: "lever", ats_id: "mintifi", quality_score: 86,
    notes: "📍 Times Square, Andheri East, Mumbai — 400059 | B2B supply chain financing platform with digital underwriting. Raised $110M (Premji Invest, Norwest)."
  },
  {
    name: "smallcase", short_name: "smallcase", sector: "Investing", org_type: "startup",
    website: "https://smallcase.com", careers_url: "https://jobs.lever.co/smallcase",
    region: "Bengaluru", ats_type: "lever", ats_id: "smallcase", quality_score: 92,
    notes: "📍 Le Parc Richmonde 51, Richmond Town, Bengaluru — 560025 | Pioneer of thematic model portfolios and capital markets ecosystem in India. Backed by Peak XV, Amazon Smbhav. Strong eng culture."
  },
  {
    name: "Zolve", short_name: "Zolve", sector: "Cross-Border Finance", org_type: "startup",
    website: "https://zolve.com", careers_url: "https://boards.greenhouse.io/zolve",
    region: "Bengaluru", ats_type: "greenhouse", ats_id: "zolve", quality_score: 89,
    notes: "📍 RMZ Ecoworld Campus 31, Bellandur, Bengaluru — 560103 | Neobank providing US bank accounts, credit cards and remittances to global migrants. Raised $100M+ (Tiger Global, Accel)."
  },
  {
    name: "Dhan", short_name: "Dhan", sector: "Investing", org_type: "startup",
    website: "https://dhan.co", careers_url: "https://dhan.co/careers/",
    region: "Mumbai", ats_type: "custom_scrape", ats_id: null, quality_score: 86,
    notes: "📍 Gold Medal Avenue, Goregaon West, Mumbai — 400104 | Technology-led trading and investing platform with sub-second execution and advanced API integrations (Raise Financial)."
  },
  {
    name: "Kiwi", short_name: "Kiwi", sector: "Credit & Payments", org_type: "startup",
    website: "https://gokiwi.in", careers_url: "https://jobs.lever.co/kiwi-2",
    region: "Bengaluru", ats_type: "lever", ats_id: "kiwi-2", quality_score: 86,
    notes: "📍 Olsen Spaces 1505, HSR Layout, Bengaluru — 560102 | Credit on UPI platform issuing digital RuPay credit cards. Founded by ex-PayU, ex-Citibank leadership. Backed by Nexus Venture Partners."
  },
  {
    name: "Stable Money", short_name: "Stable Money", sector: "Savings & Investing", org_type: "startup",
    website: "https://stablemoney.in", careers_url: "https://jobs.lever.co/stablemoney",
    region: "Bengaluru", ats_type: "lever", ats_id: "stablemoney", quality_score: 85,
    notes: "📍 BHIVE HSR Premium Campus, Kudlu Gate, Bengaluru — 560068 | Digital fixed-income and deposit marketplace providing curated low-risk financial assets. Backed by Accel & Matrix."
  },

  // 31-40: Consumer & Commerce
  {
    name: "Rapido", short_name: "Rapido", sector: "Mobility", org_type: "startup",
    website: "https://rapido.bike", careers_url: "https://boards.greenhouse.io/rapidobike",
    region: "Bengaluru", ats_type: "greenhouse", ats_id: "rapidobike", quality_score: 92,
    notes: "📍 No. 648, HSR Layout Sector 6, Bengaluru — 560102 | India's largest bike-taxi and auto-rickshaw mobility unicorn ($1.1B valuation). High scale geospatial dispatch and routing systems."
  },
  {
    name: "Spinny", short_name: "Spinny", sector: "Auto Commerce", org_type: "startup",
    website: "https://spinny.com", careers_url: "https://jobs.lever.co/spinny",
    region: "Gurugram", ats_type: "lever", ats_id: "spinny", quality_score: 88,
    notes: "📍 Capital Business Park, Sector 48, Gurugram — 122018 | Full-stack used car platform and unicorn. Tiger Global, General Catalyst backed. Good tech compensation."
  },
  {
    name: "Snabbit", short_name: "Snabbit", sector: "Home Services", org_type: "startup",
    website: "https://snabbit.com", careers_url: "https://snabbit.com/careers",
    region: "Bengaluru", ats_type: "custom_scrape", ats_id: null, quality_score: 79,
    notes: "📍 Clayworks 5B, Koramangala, Bengaluru — 560034 | On-demand 15-minute quick home services and repairs marketplace."
  },
  {
    name: "Pronto", short_name: "Pronto", sector: "Home Services", org_type: "startup",
    website: "https://withpronto.com", careers_url: "https://withpronto.com/careers",
    region: "Gurugram", ats_type: "custom_scrape", ats_id: null, quality_score: 79,
    notes: "📍 H. No. 356, Sector 28, Gurugram — 122002 | Managed home services and concierge maintenance tech platform in NCR."
  },
  {
    name: "Rebel Foods", short_name: "Rebel Foods", sector: "Food & Restaurants", org_type: "startup",
    website: "https://rebelfoods.com", careers_url: "https://rebelfoods.com/careers",
    region: "Mumbai", ats_type: "custom_scrape", ats_id: null, quality_score: 88,
    notes: "📍 Der Deutsche Parkz, Bhandup West, Mumbai — 400078 | World's largest internet restaurant company and cloud-kitchen unicorn (Faasos, Behrouz Biryani, Oven Story). Backed by Coatue & Peak XV."
  },
  {
    name: "The Whole Truth", short_name: "The Whole Truth", sector: "Food & Nutrition", org_type: "startup",
    website: "https://thewholetruthfoods.com", careers_url: "https://jobs.lever.co/thewholetruth",
    region: "Mumbai", ats_type: "lever", ats_id: "thewholetruth", quality_score: 84,
    notes: "📍 Krislon House, Andheri East, Mumbai — 400072 | Transparent clean-label D2C food & nutrition brand. Backed by Peak XV & Matrix Partners."
  },
  {
    name: "Snitch", short_name: "Snitch", sector: "Fashion", org_type: "startup",
    website: "https://snitch.com", careers_url: "https://snitch.co.in/pages/career",
    region: "Bengaluru", ats_type: "custom_scrape", ats_id: null, quality_score: 81,
    notes: "📍 No. 1/1, Frazer Town, Bengaluru — 560005 | Fast-growing tech-led men's fashion and omnichannel apparel brand. Raised ₹110M+ Series A (SWC Global)."
  },
  {
    name: "Porter", short_name: "Porter", sector: "Logistics", org_type: "startup",
    website: "https://porter.in", careers_url: "https://boards.greenhouse.io/porter100",
    region: "Bengaluru", ats_type: "greenhouse", ats_id: "porter100", quality_score: 92,
    notes: "📍 Ozone Manay Tech Park, Garvebhavipalya, Bengaluru — 560068 | Intra-city logistics and freight tech unicorn ($1B+). Highly optimized pricing, matching algorithms, and driver networks."
  },
  {
    name: "Jumbotail", short_name: "Jumbotail", sector: "B2B Commerce", org_type: "startup",
    website: "https://jumbotail.com", careers_url: "https://jobs.lever.co/jumbotail",
    region: "Bengaluru", ats_type: "lever", ats_id: "jumbotail", quality_score: 85,
    notes: "📍 Eastland Citadel 102, Hosur Road, Bengaluru — 560029 | B2B marketplace and retail platform for food and grocery. Raised $150M+ (Artiman, Heron Rock)."
  },

  // 41-50: Healthcare & Healthtech
  {
    name: "Innovaccer", short_name: "Innovaccer", sector: "Healthcare Software", org_type: "startup",
    website: "https://innovaccer.com", careers_url: "https://boards.greenhouse.io/innovaccer",
    region: "Noida", ats_type: "greenhouse", ats_id: "innovaccer", quality_score: 93,
    notes: "📍 Candor Techspace Tower 3, Sector 62, Noida — 201309 | Healthcare data activation platform unicorn ($3.2B valuation). Integrates EHR records across US health systems. Premium engineering comp (₹35-65 LPA)."
  },
  {
    name: "Qure.ai", short_name: "Qure.ai", sector: "Healthcare AI", org_type: "startup",
    website: "https://qure.ai", careers_url: "https://boards.greenhouse.io/qaboratories",
    region: "Mumbai", ats_type: "greenhouse", ats_id: "qaboratories", quality_score: 92,
    notes: "📍 Times Square Wing E, Andheri East, Mumbai — 400059 | Deep learning AI solutions for automated medical imaging (chest X-rays, brain CT scans). FDA-cleared, deployed in 90+ countries. Raised $65M+ (Lightspeed, Novo Holdings)."
  },
  {
    name: "Truemeds", short_name: "Truemeds", sector: "Online Pharmacy", org_type: "startup",
    website: "https://truemeds.in", careers_url: "https://jobs.lever.co/truemeds",
    region: "Mumbai", ats_type: "lever", ats_id: "truemeds", quality_score: 85,
    notes: "📍 Lightbridge, Tunga Village, Powai, Mumbai — 400072 | Telehealth and generic medicine recommendation engine reducing healthcare costs. Raised $63M (WestBridge Capital, Accel)."
  },
  {
    name: "MediBuddy", short_name: "MediBuddy", sector: "Digital Healthcare", org_type: "startup",
    website: "https://medibuddy.in", careers_url: "https://www.medibuddy.in/careers",
    region: "Bengaluru", ats_type: "custom_scrape", ats_id: null, quality_score: 86,
    notes: "📍 IBC Knowledge Park, Bannerghatta Road, Bengaluru — 560029 | Digital healthcare platform offering outpatient consultations, lab tests, and corporate health plans. Raised $170M+ (Quadria Capital, Lightrock)."
  },
  {
    name: "HealthKart", short_name: "HealthKart", sector: "Health & Nutrition", org_type: "startup",
    website: "https://healthkart.com", careers_url: "https://jobs.lever.co/healthkart",
    region: "Gurugram", ats_type: "lever", ats_id: "healthkart", quality_score: 86,
    notes: "📍 The Presidency Tower B, Sector 14, Gurugram — 122001 | Health, sports nutrition and wellness brand (MuscleBlaze, HK Vitals). Raised $135M (Temasek)."
  },
  {
    name: "CureBay", short_name: "CureBay", sector: "Healthcare", org_type: "startup",
    website: "https://curebay.com", careers_url: "https://curebay.com/career",
    region: "Bhubaneswar", ats_type: "custom_scrape", ats_id: null, quality_score: 81,
    notes: "📍 OCAC Tower, Acharya Vihar, Bhubaneswar — 751013 | Hybrid healthcare ecosystem bridging rural patients to quality clinics via tech e-clinics. Raised $15M+ (Elevar Equity)."
  },
  {
    name: "Orange Health Labs", short_name: "Orange Health", sector: "Diagnostics", org_type: "startup",
    website: "https://orangehealth.in", careers_url: "https://jobs.lever.co/orangehealth",
    region: "Bengaluru", ats_type: "lever", ats_id: "orangehealth", quality_score: 87,
    notes: "📍 SV Towers, Koramangala 6th Block, Bengaluru — 560095 | Ultra-fast diagnostics with 60-minute at-home blood collection and lab reporting. Raised $35M (General Catalyst, Accel)."
  },
  {
    name: "Plum", short_name: "Plum", sector: "Employee Health", org_type: "startup",
    website: "https://plumhq.com", careers_url: "https://boards.greenhouse.io/plumbenefits",
    region: "Bengaluru", ats_type: "greenhouse", ats_id: "plumbenefits", quality_score: 89,
    notes: "📍 Primeco Union City Tower B, Whitefield, Bengaluru — 560048 | Modern group health insurance and comprehensive corporate wellness platform. Raised $75M+ (Tiger Global, Peak XV)."
  },
  {
    name: "Pristyn Care", short_name: "Pristyn Care", sector: "Surgical Healthcare", org_type: "startup",
    website: "https://pristyncare.com", careers_url: "https://jobs.lever.co/pristyncare",
    region: "Gurugram", ats_type: "lever", ats_id: "pristyncare", quality_score: 87,
    notes: "📍 Capital The Cityscape, Sector 66, Gurugram — 122102 | Full-stack secondary care surgical care network and healthcare unicorn ($1.4B valuation). Tiger Global, Peak XV backed."
  },

  // 51-60: Deeptech, Hardware & EV
  {
    name: "Pixxel", short_name: "Pixxel", sector: "Space Technology", org_type: "startup",
    website: "https://pixxel.space", careers_url: "https://boards.greenhouse.io/pixxel",
    region: "Bengaluru", ats_type: "greenhouse", ats_id: "pixxel", quality_score: 94,
    notes: "📍 No. 722, Indiranagar Stage 2, Bengaluru — 560038 | Building the world's highest-resolution hyperspectral earth imaging satellite constellation. Raised $70M+ (Google, Radical Ventures, Lightspeed). Top-tier computer vision & orbital mechanics engineers."
  },
  {
    name: "Skyroot Aerospace", short_name: "Skyroot", sector: "Space Technology", org_type: "startup",
    website: "https://skyroot.in", careers_url: "https://skyroot.in/careers",
    region: "Hyderabad", ats_type: "custom_scrape", ats_id: null, quality_score: 93,
    notes: "📍 Plots 4B–4B/1, GMR Aerospace Park, Hyderabad — 500108 | India's premier private space launch vehicle manufacturer (Vikram series rockets). First Indian private company to launch a rocket to space. Raised $95M+ (GIC Singapore)."
  },
  {
    name: "Agnikul Cosmos", short_name: "Agnikul", sector: "Space Technology", org_type: "startup",
    website: "https://agnikul.in", careers_url: "https://boards.greenhouse.io/agnikulcosmos",
    region: "Chennai", ats_type: "greenhouse", ats_id: "agnikulcosmos", quality_score: 92,
    notes: "📍 IIT Madras Research Park, Taramani, Chennai — 600113 | Pioneer of 3D-printed single-piece rocket engines (Agnibaan launch vehicle). Raised $40M+ (Celesta Capital, Rocketship.vc). World-class propulsion engineering."
  },
  {
    name: "Digantara", short_name: "Digantara", sector: "Space Technology", org_type: "startup",
    website: "https://digantara.co.in", careers_url: "https://jobs.lever.co/digantara",
    region: "Bengaluru", ats_type: "lever", ats_id: "digantara", quality_score: 90,
    notes: "📍 Brigade Senate 2, Hebbal Kempapura, Bengaluru — 560024 | Space situational awareness, orbital debris mapping, and space weather tracking infrastructure. Raised $22M+ (Peak XV, Aditya Birla Ventures)."
  },
  {
    name: "Raphe mPhibr", short_name: "Raphe", sector: "Aerospace & Drones", org_type: "startup",
    website: "https://raphe.com", careers_url: "https://www.raphe.in/careers",
    region: "Noida", ats_type: "custom_scrape", ats_id: null, quality_score: 83,
    notes: "📍 B-200, Sector 81, Phase II, Noida — 201305 | Tactical unmanned aerial systems (UAVs), swarm drones, and composite aerostructures for defense and strategic surveillance."
  },
  {
    name: "Garuda Aerospace", short_name: "Garuda", sector: "Drones", org_type: "startup",
    website: "https://garudaaerospace.com", careers_url: "https://garudaaerospace.com/career",
    region: "Chennai", ats_type: "custom_scrape", ats_id: null, quality_score: 82,
    notes: "📍 Agni Business Centre 24/46, Alwarpet, Chennai — 600018 | Drone manufacturer and drone-as-a-service provider across agriculture, surveying, and defense logistics. Backed by MS Dhoni."
  },
  {
    name: "Bellatrix Aerospace", short_name: "Bellatrix", sector: "Space Technology", org_type: "startup",
    website: "https://bellatrix.aero", careers_url: "https://bellatrix.aero/careers",
    region: "Bengaluru", ats_type: "custom_scrape", ats_id: null, quality_score: 88,
    notes: "📍 No. 22, Sankey Road, Bengaluru — 560020 | In-space propulsion, Hall-effect thrusters, and green chemical propulsion systems for small satellites. Raised $11M+ (BASF Venture Capital, StartupXseed)."
  },
  {
    name: "Niqo Robotics", short_name: "Niqo", sector: "Agricultural Robotics", org_type: "startup",
    website: "https://niqorobotics.com", careers_url: "https://niqorobotics.com/careers",
    region: "Bengaluru", ats_type: "custom_scrape", ats_id: null, quality_score: 84,
    notes: "📍 No. 1074-A, Indiranagar, Bengaluru — 560038 | AI-powered autonomous agricultural spraying robots and computer-vision edge systems. Raised $13M (Bidra Innovation Ventures, Omnivore)."
  },
  {
    name: "Ethereal Machines", short_name: "Ethereal", sector: "Manufacturing", org_type: "startup",
    website: "https://etherealmachines.com", careers_url: "https://etherealmachines.com/careers/",
    region: "Bengaluru", ats_type: "custom_scrape", ats_id: null, quality_score: 83,
    notes: "📍 No. 202, Peenya Phase 3, Bengaluru — 560058 | Precision 5-axis CNC machining, hybrid subtractive-additive manufacturing, and precision aerospace fabrication. Raised $20M+ (Peak XV, Blume Ventures)."
  },
  {
    name: "Euler Motors", short_name: "Euler", sector: "Electric Vehicles", org_type: "startup",
    website: "https://eulermotors.com", careers_url: "https://boards.greenhouse.io/eulermotors",
    region: "New Delhi", ats_type: "greenhouse", ats_id: "eulermotors", quality_score: 88,
    notes: "📍 A-39, Mohan Cooperative Estate, Badarpur, New Delhi — 110044 | Commercial EV mobility manufacturer (HiLoad EV commercial 3-wheelers) with proprietary liquid-cooled battery packs. Raised $100M+ (British International Investment, GIC)."
  }
];

async function execute() {
  console.log('--- Step 1: Updating existing 5 organizations with addresses & ATS slugs ---');
  for (const u of updates) {
    await pool.query(
      `UPDATE jobhunt_organizations 
       SET name = ?, short_name = ?, sector = ?, website = ?, careers_url = ?, ats_type = ?, ats_id = ?, region = ?, quality_score = ?, notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [u.name, u.short_name, u.sector, u.website, u.careers_url, u.ats_type, u.ats_id, u.region, u.quality_score, u.notes, u.id]
    );
    console.log(`Updated [${u.id}] ${u.name} (ATS: ${u.ats_type} | ${u.ats_id || 'none'})`);
  }

  console.log('\n--- Step 2: Inserting 55 new organizations ---');
  let inserted = 0;
  let skipped = 0;

  for (const c of newCompanies) {
    // Check if company already exists by name
    const [existing] = await pool.query('SELECT id, name FROM jobhunt_organizations WHERE name = ?', [c.name]);
    if (existing.length > 0) {
      console.log(`Company "${c.name}" already exists with ID ${existing[0].id}. Updating notes & ATS...`);
      await pool.query(
        `UPDATE jobhunt_organizations 
         SET short_name = ?, sector = ?, website = ?, careers_url = ?, ats_type = ?, ats_id = ?, region = ?, quality_score = ?, notes = ?, updated_at = NOW()
         WHERE id = ?`,
        [c.short_name, c.sector, c.website, c.careers_url, c.ats_type, c.ats_id, c.region, c.quality_score, c.notes, existing[0].id]
      );
      skipped++;
    } else {
      await pool.query(
        `INSERT INTO jobhunt_organizations 
         (name, short_name, sector, org_type, careers_url, notification_url, pdf_page_url, website, notes, quality_score, poll_frequency_days, is_active, category_group, country, region, visa_sponsored, currency, ats_type, ats_id, last_jobs_found)
         VALUES (?, ?, ?, ?, ?, '', '', ?, ?, ?, 7, 1, 'startup', 'India', ?, 0, 'INR', ?, ?, 0)`,
        [c.name, c.short_name, c.sector, c.org_type, c.careers_url, c.website, c.notes, c.quality_score, c.region, c.ats_type, c.ats_id]
      );
      inserted++;
      console.log(`Inserted: ${c.name} [${c.sector}] (ATS: ${c.ats_type} | ${c.ats_id || 'custom'})`);
    }
  }

  console.log(`\n✅ Summary: ${inserted} inserted, ${skipped} updated, ${updates.length} base updated.`);

  const [totalCount] = await pool.query("SELECT COUNT(*) as cnt FROM jobhunt_organizations WHERE category_group = 'startup'");
  console.log(`Total startups in database: ${totalCount[0].cnt}`);

  process.exit(0);
}

execute().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
});
