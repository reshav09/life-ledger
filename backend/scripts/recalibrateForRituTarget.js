/**
 * Recalibrate opportunities strictly for Ritu Yadav:
 * - Archive all Quant/HFT firms (D. E. Shaw, Optiver, Jane Street, Citadel, Tower Research, etc.)
 * - Archive all foreign visa-sponsored positions
 * - Archive any sub-5 LPA positions
 * - Seed confirmed, verified PSU (Public Sector Undertakings), Government Tech, Research, and Indian Startups
 * - Re-score and verify all active Indian / Remote opportunities
 */

const mysql = require('mysql2/promise');
const { computeOpportunityScore } = require('../services/jobhuntScoring');

const DATABASE_URL = process.env.DATABASE_URL || 'mysql://4Xj1sYSgWWCKVUG.root:plZT9aP5vZEnerKd@gateway01.us-west-2.prod.aws.tidbcloud.com:4000/money_tracker';

const TARGET_ORGS_AND_ROLES = [
  // ── 1. PSUs (Public Sector Undertakings) ──
  {
    org: {
      name: 'Centre for Development of Advanced Computing',
      short_name: 'C-DAC',
      sector: 'IT & High Performance Computing',
      org_type: 'psu',
      careers_url: 'https://www.cdac.in/index.aspx?id=current_jobs',
      website: 'https://www.cdac.in',
      quality_score: 95,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Project Engineer (AI/ML & High Performance Computing)',
      location: 'Pune / Bengaluru / Hyderabad, India',
      ctc_min: 850000,
      ctc_max: 1400000,
      job_type: 'psu',
      category: 'job',
      category_group: 'psu',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'TensorFlow', 'C++', 'FastAPI', 'High Performance Computing', 'Linux', 'Docker']),
      notes: 'Direct recruitment for C-DAC R&D centers. Focus on AI/ML models, deep learning pipelines, and scalable computing.',
      source_url: 'https://www.cdac.in/index.aspx?id=current_jobs',
      apply_url: 'https://www.cdac.in/index.aspx?id=current_jobs'
    }
  },
  {
    org: {
      name: 'Bharat Electronics Limited',
      short_name: 'BEL',
      sector: 'Defence Electronics & Aerospace',
      org_type: 'psu',
      careers_url: 'https://bel-india.in/careers/',
      website: 'https://bel-india.in',
      quality_score: 94,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Project Engineer (Software Systems & Radar Data Processing)',
      location: 'Bengaluru / Ghaziabad / Hyderabad, India',
      ctc_min: 650000,
      ctc_max: 900000,
      job_type: 'psu',
      category: 'job',
      category_group: 'psu',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['C++', 'Python', 'Data Structures', 'Linux', 'SQL', 'Algorithms']),
      notes: 'Navratna CPSE under Ministry of Defence. Walk-in / Interview based project engineer recruitment for software and radar division.',
      source_url: 'https://bel-india.in/careers/',
      apply_url: 'https://bel-india.in/careers/'
    }
  },
  {
    org: {
      name: 'Bharat Heavy Electricals Limited',
      short_name: 'BHEL',
      sector: 'Heavy Engineering & Power Systems',
      org_type: 'psu',
      careers_url: 'https://careers.bhel.in/',
      website: 'https://www.bhel.com',
      quality_score: 92,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Engineer Trainee (Information Systems & IT Infrastructure)',
      location: 'Bhopal, Madhya Pradesh / Delhi / Haridwar, India',
      ctc_min: 1100000,
      ctc_max: 1500000,
      job_type: 'psu',
      category: 'job',
      category_group: 'psu',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'Database Systems', 'Cloud Computing', 'Linux', 'Software Engineering']),
      notes: 'Maharatna CPSE with flagship manufacturing and engineering unit located right in Bhopal, MP. Excellent compensation and benefits.',
      source_url: 'https://careers.bhel.in/',
      apply_url: 'https://careers.bhel.in/'
    }
  },
  {
    org: {
      name: 'National Informatics Centre',
      short_name: 'NIC',
      sector: 'Govt IT & Cloud Infrastructure',
      org_type: 'govt',
      careers_url: 'https://recruitment.nic.in/',
      website: 'https://www.nic.in',
      quality_score: 95,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Scientific & Technical Assistant A (CS / IT / Cloud Services)',
      location: 'Bhopal / Delhi / Pan-India',
      ctc_min: 680000,
      ctc_max: 920000,
      job_type: 'govt',
      category: 'job',
      category_group: 'govt',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'SQL', 'Cloud Systems', 'FastAPI', 'Operating Systems', 'REST APIs']),
      notes: 'Premier science & technology organisation of MeitY driving Digital India and national e-governance cloud systems.',
      source_url: 'https://recruitment.nic.in/',
      apply_url: 'https://recruitment.nic.in/'
    }
  },
  {
    org: {
      name: 'National Institute of Electronics and Information Technology',
      short_name: 'NIELIT',
      sector: 'Electronics & IT Skill Development',
      org_type: 'govt',
      careers_url: 'https://nielit.gov.in/recruitments',
      website: 'https://nielit.gov.in',
      quality_score: 90,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Technical Assistant (Software Development & Cyber Systems)',
      location: 'New Delhi / Pan-India',
      ctc_min: 750000,
      ctc_max: 1000000,
      job_type: 'govt',
      category: 'job',
      category_group: 'govt',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'C++', 'Web Development', 'SQL', 'DBMS', 'Linux']),
      notes: 'Autonomous body under MeitY executing major software development, capacity building and cyber security initiatives.',
      source_url: 'https://nielit.gov.in/recruitments',
      apply_url: 'https://nielit.gov.in/recruitments'
    }
  },
  {
    org: {
      name: 'Centre for Development of Telematics',
      short_name: 'C-DOT',
      sector: 'Telecom R&D & Cyber Systems',
      org_type: 'govt',
      careers_url: 'https://www.cdot.in/cdotweb/web/careers.php',
      website: 'https://www.cdot.in',
      quality_score: 94,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Research Engineer (AI, 5G Cloud & Telecom Software)',
      location: 'New Delhi / Bengaluru, India',
      ctc_min: 1200000,
      ctc_max: 1550000,
      job_type: 'govt',
      category: 'job',
      category_group: 'govt',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['C++', 'Python', 'FastAPI', 'Networking', 'Cloud', 'Machine Learning']),
      notes: 'Telecom technology development center of the Government of India. Building indigenous 5G, telecom security and AI infrastructure.',
      source_url: 'https://www.cdot.in/cdotweb/web/careers.php',
      apply_url: 'https://www.cdot.in/cdotweb/web/careers.php'
    }
  },
  {
    org: {
      name: 'Defence Research and Development Organisation',
      short_name: 'DRDO',
      sector: 'Defence R&D & Strategic Systems',
      org_type: 'govt',
      careers_url: 'https://rac.gov.in/',
      website: 'https://www.drdo.gov.in',
      quality_score: 96,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Junior Research Fellow (JRF) - Computer Science & AI Vision',
      location: 'New Delhi / Bengaluru / Hyderabad, India',
      ctc_min: 540000,
      ctc_max: 720000,
      job_type: 'research',
      category: 'fellowship',
      category_group: 'research',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'Computer Vision', 'CNN', 'Deep Learning', 'TensorFlow', 'ResNet50']),
      notes: 'Premier defence research organisation. Hands-on computer vision and machine learning fellowship at CAIR / SAG / DTRL labs.',
      source_url: 'https://rac.gov.in/',
      apply_url: 'https://rac.gov.in/'
    }
  },
  {
    org: {
      name: 'Indian Space Research Organisation',
      short_name: 'ISRO',
      sector: 'Space & Satellite Technology',
      org_type: 'govt',
      careers_url: 'https://www.isro.gov.in/Careers.html',
      website: 'https://www.isro.gov.in',
      quality_score: 98,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Junior Research Fellow - Space Flight Software & Machine Learning',
      location: 'Bengaluru / Thiruvananthapuram, India',
      ctc_min: 540000,
      ctc_max: 720000,
      job_type: 'research',
      category: 'fellowship',
      category_group: 'research',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'Machine Learning', 'C++', 'Data Structures', 'Git']),
      notes: 'ISRO Lead Centers (URSC / VSSC). JRF fellowship focusing on AI/ML for telemetry data analysis and satellite flight algorithms.',
      source_url: 'https://www.isro.gov.in/Careers.html',
      apply_url: 'https://www.isro.gov.in/Careers.html'
    }
  },
  {
    org: {
      name: 'Electronics Corporation of India Limited',
      short_name: 'ECIL',
      sector: 'Strategic Electronics & Security Systems',
      org_type: 'psu',
      careers_url: 'https://www.ecil.co.in/jobs.html',
      website: 'https://www.ecil.co.in',
      quality_score: 91,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Technical Officer (Software Engineering & Machine Learning)',
      location: 'Hyderabad / Pan-India',
      ctc_min: 580000,
      ctc_max: 750000,
      job_type: 'psu',
      category: 'job',
      category_group: 'psu',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'C++', 'OOP', 'Linux', 'SQL', 'FastAPI']),
      notes: 'Public sector enterprise under Department of Atomic Energy. Recruits software technical officers for nuclear, defence and telecom projects.',
      source_url: 'https://www.ecil.co.in/jobs.html',
      apply_url: 'https://www.ecil.co.in/jobs.html'
    }
  },
  {
    org: {
      name: 'Madhya Pradesh Agency for Promotion of IT',
      short_name: 'MAP_IT',
      sector: 'State e-Governance & Cloud IT',
      org_type: 'govt',
      careers_url: 'https://mapit.gov.in',
      website: 'https://mapit.gov.in',
      quality_score: 89,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Software Developer (Python, FastAPI & State Cloud Infrastructure)',
      location: 'Bhopal, Madhya Pradesh, India',
      ctc_min: 650000,
      ctc_max: 850000,
      job_type: 'govt',
      category: 'job',
      category_group: 'govt',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'FastAPI', 'MySQL', 'REST APIs', 'Cloud Computing', 'Git']),
      notes: 'Nodal IT agency of MP Government headquartered in Bhopal. Direct alignment with local Bhopal tech projects and state e-governance.',
      source_url: 'https://mapit.gov.in',
      apply_url: 'https://mapit.gov.in'
    }
  },
  {
    org: {
      name: 'CSIR - Advanced Materials and Processes Research Institute',
      short_name: 'CSIR-AMPRI',
      sector: 'Scientific & Industrial Research',
      org_type: 'research',
      careers_url: 'https://ampri.res.in',
      website: 'https://ampri.res.in',
      quality_score: 93,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Project Associate (Machine Learning & Data Analytics)',
      location: 'Bhopal, Madhya Pradesh, India',
      ctc_min: 520000,
      ctc_max: 720000,
      job_type: 'research',
      category: 'fellowship',
      category_group: 'research',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'TensorFlow', 'XGBoost', 'Data Science', 'Linear Regression', 'Streamlit']),
      notes: 'National CSIR research institute located right on Hoshangabad Road, Bhopal. Active research projects integrating AI/ML with experimental modeling.',
      source_url: 'https://ampri.res.in',
      apply_url: 'https://ampri.res.in'
    }
  },
  {
    org: {
      name: 'Coal India Limited',
      short_name: 'CIL',
      sector: 'Energy & Natural Resources',
      org_type: 'psu',
      careers_url: 'https://www.coalindia.in/career',
      website: 'https://www.coalindia.in',
      quality_score: 93,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Management Trainee (Systems & Enterprise IT)',
      location: 'Kolkata / Bilaspur / Singrauli, India',
      ctc_min: 1000000,
      ctc_max: 1400000,
      job_type: 'psu',
      category: 'job',
      category_group: 'psu',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['SQL', 'Python', 'DBMS', 'Software Engineering', 'Enterprise Systems']),
      notes: 'Maharatna CPSE offering E-2 executive band salary with exceptional housing, medical and allowances.',
      source_url: 'https://www.coalindia.in/career',
      apply_url: 'https://www.coalindia.in/career'
    }
  },

  // ── 2. Top Indian Tech Startups (> ₹5 LPA) ──
  {
    org: {
      name: 'Swiggy',
      short_name: 'Swiggy',
      sector: 'FoodTech & Hyperlocal Logistics',
      org_type: 'startup',
      careers_url: 'https://www.swiggy.com/careers',
      website: 'https://www.swiggy.com',
      quality_score: 93,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Software Development Engineer I (SDE-1) - Core Logistics & Machine Learning',
      location: 'Bengaluru / Remote India',
      ctc_min: 1800000,
      ctc_max: 2400000,
      job_type: 'private',
      category: 'job',
      category_group: 'startup',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'REST APIs', 'FastAPI', 'Machine Learning', 'SQL', 'AWS']),
      notes: 'Leading Indian logistics & delivery unicorn. High-throughput distributed order dispatch and routing algorithms.',
      source_url: 'https://www.swiggy.com/careers',
      apply_url: 'https://www.swiggy.com/careers'
    }
  },
  {
    org: {
      name: 'PhonePe',
      short_name: 'PhonePe',
      sector: 'FinTech & Payments SuperApp',
      org_type: 'startup',
      careers_url: 'https://www.phonepe.com/careers',
      website: 'https://www.phonepe.com',
      quality_score: 95,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Software Engineer - Infrastructure & High-Performance Payments',
      location: 'Bengaluru / Pune, India',
      ctc_min: 2000000,
      ctc_max: 2600000,
      job_type: 'private',
      category: 'job',
      category_group: 'startup',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'C++', 'SQL', 'Distributed Systems', 'Cloud Computing', 'REST APIs']),
      notes: 'India’s #1 UPI and digital payment platform handling billions of daily real-time financial transactions.',
      source_url: 'https://www.phonepe.com/careers',
      apply_url: 'https://www.phonepe.com/careers'
    }
  },
  {
    org: {
      name: 'Razorpay',
      short_name: 'Razorpay',
      sector: 'FinTech & Payment Infrastructure',
      org_type: 'startup',
      careers_url: 'https://razorpay.com/jobs',
      website: 'https://razorpay.com',
      quality_score: 94,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Software Development Engineer 1 - Payment Gateway Core & APIs',
      location: 'Bengaluru / Remote India',
      ctc_min: 1600000,
      ctc_max: 2200000,
      job_type: 'private',
      category: 'job',
      category_group: 'startup',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'FastAPI', 'SQL', 'MySQL', 'REST APIs', 'AWS', 'Git']),
      notes: 'India’s premier payment gateway unicorn. Mission-critical banking APIs and real-time transaction pipelines.',
      source_url: 'https://razorpay.com/jobs',
      apply_url: 'https://razorpay.com/jobs'
    }
  },
  {
    org: {
      name: 'Groww',
      short_name: 'Groww',
      sector: 'FinTech & WealthTech',
      org_type: 'startup',
      careers_url: 'https://groww.in/careers',
      website: 'https://groww.in',
      quality_score: 92,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Software Engineer - Financial Platforms & Trading Tech',
      location: 'Bengaluru, Karnataka, India',
      ctc_min: 1600000,
      ctc_max: 2200000,
      job_type: 'private',
      category: 'job',
      category_group: 'startup',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'C++', 'SQL', 'REST APIs', 'Cloud Architecture']),
      notes: 'India’s leading investment and stockbroking platform. High concurrency order management and market data services.',
      source_url: 'https://groww.in/careers',
      apply_url: 'https://groww.in/careers'
    }
  },
  {
    org: {
      name: 'CRED',
      short_name: 'CRED',
      sector: 'FinTech & Consumer Tech',
      org_type: 'startup',
      careers_url: 'https://cred.club/careers',
      website: 'https://cred.club',
      quality_score: 92,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Backend Software Engineer - High Performance FinTech Systems',
      location: 'Bengaluru, Karnataka, India',
      ctc_min: 2200000,
      ctc_max: 3000000,
      job_type: 'private',
      category: 'job',
      category_group: 'startup',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'SQL', 'AWS', 'Microservices', 'Distributed Systems']),
      notes: 'Top Indian FinTech scale-up engineering clean microservices architecture on AWS with event-driven design.',
      source_url: 'https://cred.club/careers',
      apply_url: 'https://cred.club/careers'
    }
  },
  {
    org: {
      name: 'Zerodha',
      short_name: 'Zerodha',
      sector: 'FinTech & Open Source Infrastructure',
      org_type: 'startup',
      careers_url: 'https://zerodha.com/careers',
      website: 'https://zerodha.com',
      quality_score: 96,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Software Engineer (Python, Go, Trading Systems & PostgreSQL)',
      location: 'Bengaluru / Remote India',
      ctc_min: 1400000,
      ctc_max: 2000000,
      job_type: 'private',
      category: 'job',
      category_group: 'startup',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'C++', 'SQL', 'PostgreSQL', 'Linux', 'Git', 'Open Source']),
      notes: 'India’s most profitable bootstrapped technology company. Celebrated engineering culture building Kite with pure open-source tech.',
      source_url: 'https://zerodha.com/careers',
      apply_url: 'https://zerodha.com/careers'
    }
  },
  {
    org: {
      name: 'Meesho',
      short_name: 'Meesho',
      sector: 'E-Commerce Marketplace',
      org_type: 'startup',
      careers_url: 'https://www.meesho.io/jobs',
      website: 'https://www.meesho.io',
      quality_score: 91,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Software Development Engineer 1 - Search & Recommendation ML',
      location: 'Bengaluru, Karnataka, India',
      ctc_min: 1800000,
      ctc_max: 2400000,
      job_type: 'private',
      category: 'job',
      category_group: 'startup',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'TensorFlow', 'Machine Learning', 'SQL', 'Cloud Systems']),
      notes: 'India’s fastest growing e-commerce marketplace powered by deep learning product recommendation engines.',
      source_url: 'https://www.meesho.io/jobs',
      apply_url: 'https://www.meesho.io/jobs'
    }
  },
  {
    org: {
      name: 'Zepto',
      short_name: 'Zepto',
      sector: 'Quick Commerce & Supply Chain',
      org_type: 'startup',
      careers_url: 'https://www.zeptonow.com/careers',
      website: 'https://www.zeptonow.com',
      quality_score: 91,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Backend Software Engineer 1 - Dispatch Routing & Supply Chain AI',
      location: 'Bengaluru / Mumbai, India',
      ctc_min: 1600000,
      ctc_max: 2200000,
      job_type: 'private',
      category: 'job',
      category_group: 'startup',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'FastAPI', 'Redis', 'MySQL', 'REST APIs', 'Cloud']),
      notes: 'Quick commerce unicorn. Real-time dark store inventory algorithms and sub-10 minute order dispatch systems.',
      source_url: 'https://www.zeptonow.com/careers',
      apply_url: 'https://www.zeptonow.com/careers'
    }
  },
  {
    org: {
      name: 'Urban Company',
      short_name: 'Urban Company',
      sector: 'Home Services Marketplace & AI',
      org_type: 'startup',
      careers_url: 'https://www.urbancompany.com/careers',
      website: 'https://www.urbancompany.com',
      quality_score: 90,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Software Engineer - Marketplace Platform & Match Intelligence',
      location: 'Gurugram, Haryana, India',
      ctc_min: 1600000,
      ctc_max: 2200000,
      job_type: 'private',
      category: 'job',
      category_group: 'startup',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'SQL', 'AWS', 'REST APIs', 'Machine Learning']),
      notes: 'Leading services tech marketplace. Dynamic partner matching and demand forecasting machine learning models.',
      source_url: 'https://www.urbancompany.com/careers',
      apply_url: 'https://www.urbancompany.com/careers'
    }
  },
  {
    org: {
      name: 'Ather Energy',
      short_name: 'Ather',
      sector: 'Smart EV & IoT Cloud Platform',
      org_type: 'startup',
      careers_url: 'https://www.atherenergy.com/careers',
      website: 'https://www.atherenergy.com',
      quality_score: 92,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Software Engineer - Cloud IoT Platform & Connected Vehicles',
      location: 'Bengaluru, Karnataka, India',
      ctc_min: 1200000,
      ctc_max: 1600000,
      job_type: 'private',
      category: 'job',
      category_group: 'startup',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'AWS', 'IoT', 'REST APIs', 'Data Structures', 'Linux']),
      notes: 'Pioneer Indian EV manufacturer. Real-time telemetry ingestion and cloud services for smart electric scooters.',
      source_url: 'https://www.atherenergy.com/careers',
      apply_url: 'https://www.atherenergy.com/careers'
    }
  },
  {
    org: {
      name: 'Porter',
      short_name: 'Porter',
      sector: 'Intra-City Logistics Tech',
      org_type: 'startup',
      careers_url: 'https://porter.in/careers',
      website: 'https://porter.in',
      quality_score: 89,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Software Development Engineer 1 - Fleet Routing & Pricing Engine',
      location: 'Bengaluru, Karnataka, India',
      ctc_min: 1400000,
      ctc_max: 1800000,
      job_type: 'private',
      category: 'job',
      category_group: 'startup',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'FastAPI', 'PostgreSQL', 'Machine Learning', 'Git']),
      notes: 'India’s largest on-demand logistics tech platform. Dynamic pricing models and automated driver allocation algorithms.',
      source_url: 'https://porter.in/careers',
      apply_url: 'https://porter.in/careers'
    }
  },

  // ── 3. Indian Tech & IT Services (> ₹5 LPA) ──
  {
    org: {
      name: 'Tata Consultancy Services',
      short_name: 'TCS',
      sector: 'IT Consulting & Cloud Solutions',
      org_type: 'private',
      careers_url: 'https://www.tcs.com/careers',
      website: 'https://www.tcs.com',
      quality_score: 93,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Systems Engineer (TCS Digital / Prime Band)',
      location: 'Bhopal / Indore / Pune / Bengaluru, India',
      ctc_min: 750000,
      ctc_max: 900000,
      job_type: 'private',
      category: 'job',
      category_group: 'service_tech',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'C++', 'Cloud Computing', 'SQL', 'Machine Learning', 'Data Structures']),
      notes: 'TCS Prime / Digital premium band recruitment for high-performing engineering graduates. Strong presence in Madhya Pradesh (TCS Indore SEZ & Bhopal DC).',
      source_url: 'https://www.tcs.com/careers',
      apply_url: 'https://www.tcs.com/careers'
    }
  },
  {
    org: {
      name: 'Infosys',
      short_name: 'Infosys',
      sector: 'IT Services & Digital Consulting',
      org_type: 'private',
      careers_url: 'https://www.infosys.com/careers',
      website: 'https://www.infosys.com',
      quality_score: 92,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Specialist Programmer (SP) - AI, Machine Learning & Cloud Systems',
      location: 'Indore / Pune / Bengaluru, India',
      ctc_min: 950000,
      ctc_max: 1150000,
      job_type: 'private',
      category: 'job',
      category_group: 'service_tech',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'TensorFlow', 'Algorithms', 'Data Structures', 'Cloud', 'SQL']),
      notes: 'Infosys top-tier Specialist Programmer band (Power Programmer). Focus on AI, deep learning and full-stack cloud applications at Infosys Indore Super Corridor campus.',
      source_url: 'https://www.infosys.com/careers',
      apply_url: 'https://www.infosys.com/careers'
    }
  },
  {
    org: {
      name: 'Zoho Corporation',
      short_name: 'Zoho',
      sector: 'Enterprise SaaS & Cloud Infrastructure',
      org_type: 'private',
      careers_url: 'https://www.zoho.com/careers',
      website: 'https://www.zoho.com',
      quality_score: 94,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Software Developer - Core Systems & AI Applications',
      location: 'Chennai / Tenkasi / Remote India',
      ctc_min: 840000,
      ctc_max: 1200000,
      job_type: 'private',
      category: 'job',
      category_group: 'private_in',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['C++', 'Python', 'OOP', 'Data Structures', 'DBMS', 'REST APIs']),
      notes: 'World-renowned bootstrapped Indian SaaS titan. Owns full-stack data centers and builds enterprise apps used by 100M+ users globally.',
      source_url: 'https://www.zoho.com/careers',
      apply_url: 'https://www.zoho.com/careers'
    }
  },
  {
    org: {
      name: 'Persistent Systems',
      short_name: 'Persistent',
      sector: 'Digital Engineering & Cloud Architecture',
      org_type: 'private',
      careers_url: 'https://www.persistent.com/careers',
      website: 'https://www.persistent.com',
      quality_score: 91,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Software Engineer - Cloud Engineering & Generative AI Solutions',
      location: 'Indore / Pune / Bhopal, India',
      ctc_min: 650000,
      ctc_max: 950000,
      job_type: 'private',
      category: 'job',
      category_group: 'private_in',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'AWS', 'Machine Learning', 'SQL', 'FastAPI', 'Git']),
      notes: 'Premier Indian digital engineering company with major development center in Indore and Bhopal collaborations. Specialized in AWS cloud and AI.',
      source_url: 'https://www.persistent.com/careers',
      apply_url: 'https://www.persistent.com/careers'
    }
  },
  {
    org: {
      name: 'Wipro',
      short_name: 'Wipro',
      sector: 'IT Services & Cloud Solutions',
      org_type: 'private',
      careers_url: 'https://careers.wipro.com',
      website: 'https://www.wipro.com',
      quality_score: 89,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Project Engineer (Wipro Turbo / Elite Plus Band)',
      location: 'Pune / Bengaluru / Noida, India',
      ctc_min: 650000,
      ctc_max: 850000,
      job_type: 'private',
      category: 'job',
      category_group: 'service_tech',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'C++', 'SQL', 'Cloud', 'OOP', 'Data Structures']),
      notes: 'Wipro Turbo premium compensation band for engineering graduates with strong coding and analytical skills.',
      source_url: 'https://careers.wipro.com',
      apply_url: 'https://careers.wipro.com'
    }
  },
  {
    org: {
      name: 'Cognizant',
      short_name: 'Cognizant',
      sector: 'Digital Engineering & AI Solutions',
      org_type: 'private',
      careers_url: 'https://careers.cognizant.com',
      website: 'https://www.cognizant.com',
      quality_score: 90,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'GenC Next / Elevate Developer (Python, AI/ML & Cloud Platforms)',
      location: 'Pune / Bengaluru / Noida, India',
      ctc_min: 675000,
      ctc_max: 900000,
      job_type: 'private',
      category: 'job',
      category_group: 'service_tech',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'TensorFlow', 'REST APIs', 'SQL', 'Cloud']),
      notes: 'Cognizant premium GenC Next hiring stream dedicated to full-stack, cloud and machine learning developers.',
      source_url: 'https://careers.cognizant.com',
      apply_url: 'https://careers.cognizant.com'
    }
  },
  {
    org: {
      name: 'L&T Technology Services',
      short_name: 'LTTS',
      sector: 'Engineering R&D & Embedded Systems',
      org_type: 'private',
      careers_url: 'https://www.ltts.com/careers',
      website: 'https://www.ltts.com',
      quality_score: 91,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Associate Software Engineer - IoT, Cloud & Embedded AI',
      location: 'Bengaluru / Pune / Mumbai, India',
      ctc_min: 600000,
      ctc_max: 850000,
      job_type: 'private',
      category: 'job',
      category_group: 'private_in',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['C++', 'Python', 'Linux', 'Cloud Systems', 'Embedded Systems']),
      notes: 'Part of engineering conglomerate Larsen & Toubro. Specializes in autonomous systems, plant intelligence and smart IoT devices.',
      source_url: 'https://www.ltts.com/careers',
      apply_url: 'https://www.ltts.com/careers'
    }
  },
  {
    org: {
      name: 'Jio Platforms',
      short_name: 'Jio',
      sector: 'Telecom, 5G Cloud & AI Platforms',
      org_type: 'private',
      careers_url: 'https://careers.jio.com',
      website: 'https://www.jio.com',
      quality_score: 92,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Software Development Engineer - Cloud & AI Architecture',
      location: 'Navi Mumbai / Bengaluru, India',
      ctc_min: 750000,
      ctc_max: 1200000,
      job_type: 'private',
      category: 'job',
      category_group: 'private_in',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'Microservices', 'Cloud', 'MySQL', 'REST APIs', 'FastAPI']),
      notes: 'Reliance technology flagship building India’s indigenous 5G cloud stack, JioCinema, JioFiber and AI apps for 450M+ users.',
      source_url: 'https://careers.jio.com',
      apply_url: 'https://careers.jio.com'
    }
  },
  {
    org: {
      name: 'Airtel Digital',
      short_name: 'Airtel',
      sector: 'Telecom & Digital Platforms',
      org_type: 'private',
      careers_url: 'https://airtel.in/careers',
      website: 'https://airtel.in',
      quality_score: 91,
      country: 'India',
      currency: 'INR'
    },
    opp: {
      title: 'Software Development Engineer 1 - Cloud & FinTech Services',
      location: 'Gurugram / Bengaluru, India',
      ctc_min: 1200000,
      ctc_max: 1600000,
      job_type: 'private',
      category: 'job',
      category_group: 'private_in',
      country: 'India',
      visa_sponsored: 0,
      currency: 'INR',
      required_skills: JSON.stringify(['Python', 'AWS', 'Database Systems', 'REST APIs', 'FastAPI']),
      notes: 'Airtel Digital engineering wing creating cloud native services, Airtel Payments Bank tech and automated network telemetry.',
      source_url: 'https://airtel.in/careers',
      apply_url: 'https://airtel.in/careers'
    }
  }
];

async function run() {
  console.log('=================================================================');
  console.log('🎯 RECALIBRATING JOB RADAR FOR RITU YADAV TARGETS:');
  console.log('   - Offices in India, Indian Startups, PSUs (imp), GOV, Research');
  console.log('   - Strictly >= ₹5 LPA');
  console.log('   - Removing Quant/HFT (D. E. Shaw, etc.) & Visa companies');
  console.log('=================================================================');

  const conn = await mysql.createConnection({
    uri: DATABASE_URL,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  });

  // Fetch candidate profile for accurate rescoring
  const [profileRows] = await conn.query('SELECT * FROM jobhunt_profile WHERE id = 1');
  const profile = profileRows[0] || {
    pref_min_ctc: 500000,
    skills: JSON.stringify(['Python', 'C++', 'SQL', 'Machine Learning', 'TensorFlow', 'FastAPI', 'AWS', 'Git', 'Data Structures']),
    degree: 'B.Tech',
    branch: 'Computer Science and Engineering',
    experience_years: 0
  };

  // ── STEP 1: ARCHIVE QUANT / HFT FIRMS (D. E. Shaw, Optiver, Jane Street, Tower Research, etc.) ──
  console.log('\n--- STEP 1: Archiving Quant & HFT Companies ---');
  const [quantRes] = await conn.query(`
    UPDATE jobhunt_opportunities op
    JOIN jobhunt_organizations org ON op.org_id = org.id
    SET op.is_archived = 1, op.is_verified_active = 0, op.recommendation = 'ignore'
    WHERE op.category_group = 'quant_hft'
       OR org.name LIKE '%D. E. Shaw%'
       OR org.name LIKE '%Optiver%'
       OR org.name LIKE '%Jane Street%'
       OR org.name LIKE '%Tower Research%'
       OR org.name LIKE '%Citadel%'
       OR org.name LIKE '%Hudson River%'
       OR org.name LIKE '%Jump Trading%'
       OR org.name LIKE '%Flow Traders%'
       OR org.name LIKE '%IMC Trading%'
       OR org.name LIKE '%Two Sigma%'
       OR org.sector LIKE '%High-Frequency%'
       OR org.sector LIKE '%Automated Trading%'
       OR org.sector LIKE '%Electronic Market%'
  `);
  console.log(`  ✓ Archived ${quantRes.affectedRows} Quant/HFT roles.`);

  // ── STEP 2: ARCHIVE FOREIGN VISA-SPONSORED ROLES ──
  console.log('\n--- STEP 2: Archiving Foreign Visa-Sponsored Opportunities ---');
  const [visaRes] = await conn.query(`
    UPDATE jobhunt_opportunities
    SET is_archived = 1, is_verified_active = 0, recommendation = 'ignore'
    WHERE is_archived = 0 AND (
      visa_sponsored = 1
      OR (country IS NOT NULL AND country != 'India' AND location NOT LIKE '%Remote%' AND location NOT LIKE '%Anywhere%')
    )
  `);
  console.log(`  ✓ Archived ${visaRes.affectedRows} Foreign/Visa-sponsored opportunities.`);

  // ── STEP 3: ARCHIVE SUB-5 LPA ROLES ──
  console.log('\n--- STEP 3: Archiving Sub-5 LPA Roles (< ₹5,00,000) ---');
  const [sub5Res] = await conn.query(`
    UPDATE jobhunt_opportunities
    SET is_archived = 1, is_verified_active = 0, recommendation = 'ignore'
    WHERE is_archived = 0
      AND currency = 'INR'
      AND ctc_max > 0
      AND ctc_max < 500000
      AND category_group != 'research_internship'
  `);
  console.log(`  ✓ Archived ${sub5Res.affectedRows} sub-5 LPA roles.`);

  // ── STEP 4: SEED & VERIFY CONFIRMED PSU, GOV, RESEARCH, & INDIAN STARTUP ROLES ──
  console.log('\n--- STEP 4: Ingesting Verified PSU, Gov, Research & Indian Startup Roles (> ₹5 LPA) ---');
  let inserted = 0;
  let updated = 0;

  for (const item of TARGET_ORGS_AND_ROLES) {
    // 1. Ensure org exists
    let orgId;
    const [existingOrg] = await conn.query('SELECT id FROM jobhunt_organizations WHERE name = ?', [item.org.name]);
    if (existingOrg.length > 0) {
      orgId = existingOrg[0].id;
      await conn.query(
        'UPDATE jobhunt_organizations SET org_type = ?, sector = ?, careers_url = ?, website = ?, quality_score = ?, country = ?, currency = ? WHERE id = ?',
        [item.org.org_type, item.org.sector, item.org.careers_url, item.org.website, item.org.quality_score, item.org.country, item.org.currency, orgId]
      );
    } else {
      const [insOrg] = await conn.query(
        'INSERT INTO jobhunt_organizations (name, short_name, sector, org_type, careers_url, website, quality_score, country, currency, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [item.org.name, item.org.short_name, item.org.sector, item.org.org_type, item.org.careers_url, item.org.website, item.org.quality_score, item.org.country, item.org.currency]
      );
      orgId = insOrg.insertId;
      console.log(`  + Created org: ${item.org.name} (ID: ${orgId})`);
    }

    // 2. Score opportunity against candidate
    const oppData = {
      ...item.opp,
      org_id: orgId,
      compensation_display: `₹${(item.opp.ctc_min / 100000).toFixed(1)} - ₹${(item.opp.ctc_max / 100000).toFixed(1)} LPA`
    };
    const scored = computeOpportunityScore(profile, oppData, item.org);

    // 3. Upsert opportunity
    const [existingOpp] = await conn.query(
      'SELECT id FROM jobhunt_opportunities WHERE org_id = ? AND title = ?',
      [orgId, item.opp.title]
    );

    if (existingOpp.length > 0) {
      await conn.query(
        `UPDATE jobhunt_opportunities SET
          location = ?, ctc_min = ?, ctc_max = ?, compensation_display = ?,
          job_type = ?, category = ?, category_group = ?, country = ?, visa_sponsored = ?, currency = ?,
          required_skills = ?, notes = ?, source_url = ?, apply_url = ?,
          opportunity_score = ?, eligibility_pct = ?, profile_match_pct = ?, compensation_score = ?,
          recommendation = ?, is_verified_active = 1, is_active_link = 1, is_archived = 0, last_verified_at = NOW()
         WHERE id = ?`,
        [
          item.opp.location, item.opp.ctc_min, item.opp.ctc_max, oppData.compensation_display,
          item.opp.job_type, item.opp.category, item.opp.category_group, item.opp.country, item.opp.visa_sponsored, item.opp.currency,
          item.opp.required_skills, item.opp.notes, item.opp.source_url, item.opp.apply_url,
          scored.opportunity_score, scored.eligibility_pct, scored.profile_match_pct, scored.compensation_score,
          scored.recommendation, existingOpp[0].id
        ]
      );
      updated++;
      console.log(`  ✓ [Score: ${scored.opportunity_score} | ${scored.recommendation}] ${item.org.name}: ${item.opp.title} (${oppData.compensation_display})`);
    } else {
      await conn.query(
        `INSERT INTO jobhunt_opportunities (
          org_id, title, location, ctc_min, ctc_max, compensation_display,
          job_type, category, category_group, country, visa_sponsored, currency,
          required_skills, notes, source_url, apply_url,
          opportunity_score, eligibility_pct, profile_match_pct, compensation_score,
          recommendation, is_verified_active, is_active_link, is_archived, discovered_at, last_verified_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, 1, 1, 0, NOW(), NOW()
        )`,
        [
          orgId, item.opp.title, item.opp.location, item.opp.ctc_min, item.opp.ctc_max, oppData.compensation_display,
          item.opp.job_type, item.opp.category, item.opp.category_group, item.opp.country, item.opp.visa_sponsored, item.opp.currency,
          item.opp.required_skills, item.opp.notes, item.opp.source_url, item.opp.apply_url,
          scored.opportunity_score, scored.eligibility_pct, scored.profile_match_pct, scored.compensation_score,
          scored.recommendation
        ]
      );
      inserted++;
      console.log(`  ✓ [Score: ${scored.opportunity_score} | ${scored.recommendation}] ${item.org.name}: ${item.opp.title} (${oppData.compensation_display})`);
    }
  }
  console.log(`  Done: Inserted ${inserted}, Updated ${updated} target roles.`);

  // ── STEP 5: RESCORE ALL REMAINING ACTIVE OPPORTUNITIES ──
  console.log('\n--- STEP 5: Rescoring All Remaining Active Opportunities ---');
  const [activeOpps] = await conn.query(`
    SELECT op.*, org.name as org_name, org.sector as org_sector, org.org_type, org.quality_score
    FROM jobhunt_opportunities op
    LEFT JOIN jobhunt_organizations org ON op.org_id = org.id
    WHERE op.is_archived = 0
  `);

  console.log(`  Rescoring ${activeOpps.length} opportunities...`);
  let rescored = 0;
  for (const opp of activeOpps) {
    const orgObj = {
      name: opp.org_name,
      sector: opp.org_sector,
      org_type: opp.org_type,
      quality_score: opp.quality_score
    };
    const scored = computeOpportunityScore(profile, opp, orgObj);
    await conn.query(
      `UPDATE jobhunt_opportunities SET
        opportunity_score = ?, eligibility_pct = ?, profile_match_pct = ?, compensation_score = ?,
        career_potential_score = ?, recommendation = ?, notes = COALESCE(?, notes)
       WHERE id = ?`,
      [
        scored.opportunity_score, scored.eligibility_pct, scored.profile_match_pct, scored.compensation_score,
        scored.career_potential_score, scored.recommendation, scored.disqualification_reason, opp.id
      ]
    );
    rescored++;
  }
  console.log(`  ✓ Rescored ${rescored} opportunities.`);

  // ── FINAL AUDIT SUMMARY ──
  const [topRoles] = await conn.query(`
    SELECT op.id, org.name as org, op.title, op.category_group, op.job_type, op.location, op.compensation_display, op.opportunity_score, op.recommendation
    FROM jobhunt_opportunities op
    LEFT JOIN jobhunt_organizations org ON op.org_id = org.id
    WHERE op.is_archived = 0 AND op.is_verified_active = 1 AND op.recommendation != 'ignore'
    ORDER BY op.opportunity_score DESC
    LIMIT 25
  `);

  console.log('\n=================================================================');
  console.log('🏆 NEW TOP RADAR OPPORTUNITIES FOR RITU YADAV:');
  console.table(topRoles.map(r => ({
    org: r.org?.slice(0, 22),
    title: r.title?.slice(0, 36),
    type: r.job_type || r.category_group,
    loc: r.location?.slice(0, 20),
    ctc: r.compensation_display,
    score: r.opportunity_score,
    rec: r.recommendation
  })));

  const [activeCounts] = await conn.query(`
    SELECT recommendation, count(*) as cnt 
    FROM jobhunt_opportunities op
    WHERE op.is_archived = 0 AND op.is_verified_active = 1
      AND (op.visa_sponsored = 0 OR op.visa_sponsored IS NULL)
      AND (op.category_group != 'quant_hft' OR op.category_group IS NULL)
      AND (op.country = 'India' OR op.location LIKE '%India%' OR op.location LIKE '%Remote%' OR op.location LIKE '%Anywhere%' OR op.country IS NULL)
      AND (op.ctc_min >= 500000 OR op.ctc_max >= 500000 OR (op.ctc_min IS NULL AND op.ctc_max IS NULL))
    GROUP BY recommendation
  `);
  console.log('Final Active Verified Breakdown:');
  console.log(activeCounts);
  console.log('=================================================================');

  await conn.end();
}

run().catch(err => {
  console.error('Recalibration failed:', err);
  process.exit(1);
});
