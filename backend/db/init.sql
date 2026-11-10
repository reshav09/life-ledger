-- Money Tracker schema
CREATE DATABASE IF NOT EXISTS money_tracker;
USE money_tracker;

-- Bank / cash accounts the user holds money in
CREATE TABLE IF NOT EXISTS accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  bank_name VARCHAR(100) DEFAULT NULL,
  account_type ENUM('bank','cash','wallet','other') NOT NULL DEFAULT 'bank',
  opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_pinned TINYINT(1) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  fx_rate_to_base DECIMAL(12,4) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Spend/income categories (food, rent, ebill, travel-cab, etc.)
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  type ENUM('income','expense') NOT NULL DEFAULT 'expense',
  icon VARCHAR(20) DEFAULT '💸',
  color VARCHAR(20) DEFAULT '#2F6F4E',
  is_default TINYINT(1) NOT NULL DEFAULT 0
);

-- Every single transaction, down to the last rupee
CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  category_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type ENUM('income','expense','transfer') NOT NULL DEFAULT 'expense',
  description VARCHAR(255) DEFAULT '',
  txn_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Salary / other recurring income log
CREATE TABLE IF NOT EXISTS salaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  label VARCHAR(100) DEFAULT 'Salary',
  received_on DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Monthly budget caps per category
CREATE TABLE IF NOT EXISTS budgets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  amount DECIMAL(12,2) NOT NULL,
  UNIQUE KEY uniq_cat_month (category_id, month),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Wishlist / planned purchases with affordability check
CREATE TABLE IF NOT EXISTS wishlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  cost DECIMAL(12,2) NOT NULL,
  category_id INT DEFAULT NULL,
  payment_mode ENUM('cash','emi') NOT NULL DEFAULT 'cash',
  emi_months INT DEFAULT NULL,
  priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  status ENUM('planned','bought','dropped') NOT NULL DEFAULT 'planned',
  notes VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Single-row-per-key app settings (reserve cap, currency, etc.)
CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(50) PRIMARY KEY,
  `value` VARCHAR(255) NOT NULL
);

-- Savings goals, fed by contributions that also log as real expense transactions
CREATE TABLE IF NOT EXISTS savings_goals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  target_amount DECIMAL(12,2) NOT NULL,
  target_date DATE DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS savings_contributions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  goal_id INT NOT NULL,
  transaction_id INT DEFAULT NULL,
  amount DECIMAL(12,2) NOT NULL,
  contributed_on DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

-- Loans/debts, with payments that also log as real expense transactions
CREATE TABLE IF NOT EXISTS loans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  principal DECIMAL(12,2) NOT NULL,
  interest_rate DECIMAL(5,2) DEFAULT NULL,
  emi_amount DECIMAL(12,2) DEFAULT NULL,
  tenure_months INT DEFAULT NULL,
  start_date DATE NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  notes VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loan_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  loan_id INT NOT NULL,
  transaction_id INT DEFAULT NULL,
  amount DECIMAL(12,2) NOT NULL,
  paid_on DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

-- Saved one-tap quick-add entries
CREATE TABLE IF NOT EXISTS templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  account_id INT NOT NULL,
  category_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type ENUM('income','expense') NOT NULL DEFAULT 'expense',
  description VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Recurring bill due-date reminders
CREATE TABLE IF NOT EXISTS bill_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  amount DECIMAL(12,2) DEFAULT NULL,
  category_id INT DEFAULT NULL,
  due_day INT NOT NULL,
  remind_days_before INT NOT NULL DEFAULT 3,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Envelope budgeting: moves between category caps within a month
CREATE TABLE IF NOT EXISTS budget_transfers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  month VARCHAR(7) NOT NULL,
  from_category_id INT NOT NULL,
  to_category_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  note VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_category_id) REFERENCES categories(id),
  FOREIGN KEY (to_category_id) REFERENCES categories(id)
);

-- Seed default categories
INSERT IGNORE INTO categories (name, type, icon, color, is_default) VALUES
('Salary', 'income', '💰', '#2F6F4E', 1),
('Other Income', 'income', '➕', '#2F6F4E', 1),
('Rent', 'expense', '🏠', '#B3432B', 1),
('Food & Groceries', 'expense', '🛒', '#C9852E', 1),
('Fast Food', 'expense', '🍔', '#D97757', 1),
('Electricity Bill', 'expense', '💡', '#5B7FBA', 1),
('Water Bill', 'expense', '🚿', '#5B7FBA', 1),
('Mobile/Internet Bill', 'expense', '📶', '#5B7FBA', 1),
('Travel - Cab', 'expense', '🚕', '#7A6FB0', 1),
('Travel - Rapido/Bike', 'expense', '🏍️', '#7A6FB0', 1),
('Travel - Train/Bus', 'expense', '🚆', '#7A6FB0', 1),
('Fuel', 'expense', '⛽', '#7A6FB0', 1),
('Stationery', 'expense', '✏️', '#8B8578', 1),
('Haircut/Grooming', 'expense', '💈', '#8B8578', 1),
('Medical', 'expense', '💊', '#B3432B', 1),
('Entertainment', 'expense', '🎬', '#C9852E', 1),
('Shopping', 'expense', '🛍️', '#D97757', 1),
('EMI/Loan', 'expense', '🏦', '#B3432B', 1),
('Savings', 'expense', '🐷', '#2F6F4E', 1),
('Misc', 'expense', '🔖', '#8B8578', 1);

-- Seed default settings
INSERT IGNORE INTO settings (`key`, `value`) VALUES
('reserve_cap', '0'),
('currency_symbol', '₹'),
('base_currency', 'INR'),
('monthly_budget_total', '0'),
('last_auto_backup_at', ''),
('theme', 'dark');

-- ── Universal Ledger: Routine & Schedule tables ──

-- Trackable activities (sleep, gym, study, etc.)
CREATE TABLE IF NOT EXISTS routine_activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(20) DEFAULT '📌',
  color VARCHAR(20) DEFAULT '#5B7FBA',
  default_hours DECIMAL(4,1) NOT NULL DEFAULT 1.0,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weekly schedule template (editable blocks per day)
CREATE TABLE IF NOT EXISTS routine_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  day_of_week TINYINT NOT NULL,
  activity_id INT NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,
  notes VARCHAR(255) DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (activity_id) REFERENCES routine_activities(id) ON DELETE CASCADE
);

-- Daily actuals — what you really did
CREATE TABLE IF NOT EXISTS routine_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  log_date DATE NOT NULL,
  activity_id INT NOT NULL,
  hours DECIMAL(4,2) NOT NULL DEFAULT 0,
  notes VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_date_activity (log_date, activity_id),
  FOREIGN KEY (activity_id) REFERENCES routine_activities(id) ON DELETE CASCADE
);

-- Job / competitive exam application tracker
CREATE TABLE IF NOT EXISTS applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  role VARCHAR(200) DEFAULT '',
  type VARCHAR(32) NOT NULL DEFAULT 'job',
  status ENUM('planning','applied','interview','offer','rejected','cleared') NOT NULL DEFAULT 'planning',
  deadline DATE DEFAULT NULL,
  url VARCHAR(500) DEFAULT '',
  notes TEXT,
  priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  opportunity_id INT DEFAULT NULL,
  scoring_features_snapshot JSON NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_app_opp (opportunity_id)
);

-- ── Job Hunt Ledger tables ──

-- Your eligibility & preference profile (singleton)
CREATE TABLE IF NOT EXISTS jobhunt_profile (
  id INT PRIMARY KEY DEFAULT 1,
  full_name VARCHAR(200) DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  email VARCHAR(200) DEFAULT '',
  linkedin VARCHAR(255) DEFAULT '',
  github VARCHAR(255) DEFAULT '',
  summary TEXT DEFAULT '',
  degree VARCHAR(200) DEFAULT '',
  branch VARCHAR(200) DEFAULT '',
  graduation_year INT DEFAULT NULL,
  experience_years DECIMAL(3,1) DEFAULT 0,
  age INT DEFAULT NULL,
  education TEXT DEFAULT '',
  experience TEXT DEFAULT '',
  projects TEXT DEFAULT '',
  publications TEXT DEFAULT '',
  achievements TEXT DEFAULT '',
  skills TEXT DEFAULT '',
  certifications TEXT DEFAULT '',
  pref_min_ctc DECIMAL(12,2) DEFAULT NULL,
  pref_locations TEXT DEFAULT '',
  pref_job_types TEXT DEFAULT '',
  pref_sectors TEXT DEFAULT '',
  pref_remote_ok TINYINT(1) DEFAULT 1,
  has_gate TINYINT(1) DEFAULT 0,
  gate_score INT DEFAULT NULL,
  gate_year INT DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO jobhunt_profile (
  id, full_name, phone, email, linkedin, github, summary,
  degree, branch, graduation_year, experience_years, age,
  education, experience, projects, publications, achievements,
  skills, certifications, pref_locations, pref_sectors, pref_job_types, pref_min_ctc,
  has_gate
) VALUES (
  1,
  'Reshav Sharma',
  '8839750668',
  'reshav2004b@gmail.com',
  'https://linkedin.com/in/reshav-sharma-844320173',
  'https://github.com/reshav09',
  'Cloud/DevOps Engineer with hands-on production experience across AWS, Azure, and GCP. Currently driving multi-cloud FinOps and cost-optimization work delivering approximately $180K in annualized client savings; previously automated infrastructure and resolved live production incidents for government ERP systems serving 141 municipalities. Strong foundation in Python, Bash, Infrastructure-as-Code, and cloud cost management.',
  'B.Tech CSE (SIRT) & BS Data Science (IIT Madras)',
  'Computer Science / Data Science',
  2026,
  1.5,
  22,
  '[{"institution":"Sagar Institute of Research and Technology","degree":"B.Tech","branch":"Computer Science and Engineering","cgpa":"8.19","period":"Aug 2022 – Jul 2026","location":"Bhopal, Madhya Pradesh","status":"In Progress"},{"institution":"Indian Institute of Technology, Madras","degree":"BS","branch":"Data Science and Applications","cgpa":"","period":"Aug 2023 – Expected 2027","location":"Chennai, Tamil Nadu","status":"In Progress"}]',
  '[{"company":"FinOps Engineer","role":"FinOps Engineer","location":"Noida, India","period":"Feb 2026 – Present","highlights":["Perform cloud cost optimization and wastage-tracking analysis across 6 client accounts spanning AWS, Azure, and GCP, identifying and implementing an aggregate ~$15,000/month (~$180K annualized) in verified savings.","Delivered the two largest single-account reductions — $5,400/month and $5,000/month — through infrastructure rightsizing and elimination of idle/underutilized resources.","Support ongoing FinOps decision-making with recurring cost-visibility reporting across a multi-cloud environment."]},{"company":"Netlink Software Group America Inc","role":"DevOps Intern — MP Government ENP2.0 e-Nagar Palika Project","location":"Bhopal, Madhya Pradesh","period":"Dec 2024 – Jul 2025","highlights":["Automated server health monitoring and resource reporting for ERP servers across 141 municipalities, reducing manual analysis time by 80%; presented key metrics to the Deputy Commissioner (UADD).","Built access control and onboarding automation scripts in ERPNext, decreasing ERP rollout time by 50%.","Diagnosed critical production login failures using trace logs, enabling a 24-hour fix and preventing service downtime.","Contributed to compliance automation integrating Aadhaar & Samagra APIs within government cloud systems.","Deployed on containerized services like Docker and Kubernetes; automated server monitoring and integrated with Prometheus and Grafana for system observability."]}]',
  '[{"title":"Automated Data Pipeline & Analysis Platform","tech_stack":"Python, FastAPI, Gemini LLM, Docker","link":"https://github.com/reshav09/TDS-Project-2-May-2025","description":"Built automated data ingestion and processing pipelines to extract, clean, and structure heterogeneous datasets. Designed fault-tolerant execution logic with retry mechanisms to maintain reliability during large-scale data processing."},{"title":"Virtual Tutor for TDS Course","tech_stack":"Flask, RAG, OpenAI, Docker, YAML","link":"","description":"Engineered a low-latency, Dockerized Flask API for real-time academic Q&A using Retrieval-Augmented Generation (RAG). Designed end-to-end pipeline with structured data indexing, OpenAI integration, and automated YAML testing."},{"title":"Plant Disease Prediction System","tech_stack":"Python, Custom CNNs, ResNet50, TensorFlow, scikit-learn","link":"","description":"Designed end-to-end modeling pipelines including data preprocessing, feature normalization, and train–validation evaluation protocols. Analyzed model behavior using confusion matrices and feature-level visualizations."},{"title":"Real Estate Price Prediction","tech_stack":"Flask, XGBoost, MP Gov Data 2018–2024","link":"","description":"Developed regression and ensemble models to predict asset prices using multi-year structured government datasets, improving predictive accuracy by 25%"}]',
  '[{"title":"Solving Transportation Problem Using Python","authors":"Prof. Sarla Raigar, Reshav Sharma","venue":"International Research Journal of Modernization in Engineering Technology and Science (IRJMETS)","year":"May 2025","description":"Formulated balanced transportation problems using linear programming constraints and matrix representations. Designed and implemented multiple solution algorithms (NWCM, LCM, Supply–Demand methods) in Python."},{"title":"SR Method for Balanced and Unbalanced Assignment Problems","authors":"Reshav Sharma","venue":"Publication in Process (Under Review)","year":"2025","description":"Proposed a novel algorithm for solving balanced and unbalanced assignment problems as a special case of transportation models. Developed mathematical formulations and benchmarked performance against the Hungarian Method."},{"title":"Use of Mathematics in Real-World Research","authors":"Reshav Sharma","venue":"Government of India Copyright Registered","year":"Sep 2024","description":"Explored mathematical influence from ancient civilizations to modern industry use-cases and computing."}]',
  '[{"title":"Best Student Research Award","organization":"IEEE International Conference","year":"Sep 2024","description":"Ranked in top 1% of student research papers at IEEE International Conference."},{"title":"Star Student (2025–2026)","organization":"Sagar Institute of Research and Technology","year":"2025–2026","description":"Recognized as Student of the Year for academic and leadership excellence."},{"title":"Leadership Award","organization":"John Snow Inc True Sage Foundation EduKiran Project","year":"Aug 2023","description":"Recognized for leading education initiatives benefiting underserved communities."},{"title":"Coordinator — Educational Outreach","organization":"John Snow India Pvt. Ltd. (JSIPL)","year":"Jan 2024 – May 2024","description":"Led 50+ volunteers, improving student English proficiency scores by ~30% and implemented Google Read Along."},{"title":"Discipline Committee Head & CII YI Yuva Co-Chair","organization":"CII Yuva & SIRT","year":"2024–2025","description":"Directed discipline and logistics for 15+ campus events (1,000+ attendees); led 12 teams under CII Yuva."}]',
  '["Python","Bash","SQL","C++","JavaScript","AWS","Azure","GCP","FinOps","Cloud Cost Optimization","Cost Reporting","Docker","Kubernetes","Linux","Git","Prometheus","Grafana","FastAPI","Streamlit","ERPNext","Frappe","Machine Learning","DSA","System Design","Computer Networking","Observability","CI/CD"]',
  '["Azure AZ-900 Series","GCP Workshop","IEEE Best Student Research Award","Govt of India Copyright Registered","Star Student 2025-2026"]',
  '["Noida","Bhopal","Bangalore","Pune","Delhi NCR","Hyderabad","Chennai","Remote"]',
  '["Cloud","FinOps","DevOps","IT","Defence","Research","PSU"]',
  '["private","psu","govt","research","defence"]',
  1200000.00,
  0
);

-- Organization Registry
CREATE TABLE IF NOT EXISTS jobhunt_organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(300) NOT NULL,
  short_name VARCHAR(100) DEFAULT '',
  sector VARCHAR(100) DEFAULT '',
  org_type VARCHAR(100) DEFAULT '',
  parent_org_id INT DEFAULT NULL,
  careers_url VARCHAR(500) DEFAULT '',
  notification_url VARCHAR(500) DEFAULT '',
  pdf_page_url VARCHAR(500) DEFAULT '',
  website VARCHAR(500) DEFAULT '',
  notes TEXT DEFAULT '',
  quality_score INT DEFAULT NULL,
  poll_frequency_days INT DEFAULT 7,
  last_checked_at TIMESTAMP DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  category_group VARCHAR(50) NOT NULL DEFAULT 'psu',
  country VARCHAR(100) NOT NULL DEFAULT 'India',
  region VARCHAR(100) NOT NULL DEFAULT 'India',
  visa_sponsored TINYINT(1) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  min_ctc_threshold DECIMAL(12,2) DEFAULT NULL,
  ats_type VARCHAR(32) NOT NULL DEFAULT 'custom_scrape',
  ats_id VARCHAR(128) NULL DEFAULT NULL,
  last_crawl_status VARCHAR(64) NULL DEFAULT NULL,
  last_jobs_found INT NOT NULL DEFAULT 0,
  last_successful_pull TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Discovered opportunities
CREATE TABLE IF NOT EXISTS jobhunt_opportunities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT DEFAULT NULL,
  title VARCHAR(500) NOT NULL,
  source_url VARCHAR(500) DEFAULT '',
  source_type VARCHAR(50) DEFAULT 'manual',
  required_degree VARCHAR(300) DEFAULT '',
  required_branch VARCHAR(300) DEFAULT '',
  min_experience_years DECIMAL(3,1) DEFAULT NULL,
  max_age INT DEFAULT NULL,
  min_age INT DEFAULT NULL,
  required_skills TEXT DEFAULT '',
  vacancies INT DEFAULT NULL,
  location VARCHAR(300) DEFAULT '',
  pay_scale VARCHAR(200) DEFAULT '',
  ctc_min DECIMAL(12,2) DEFAULT NULL,
  ctc_max DECIMAL(12,2) DEFAULT NULL,
  application_deadline DATE DEFAULT NULL,
  exam_date DATE DEFAULT NULL,
  apply_url VARCHAR(500) DEFAULT '',
  job_type ENUM('govt','psu','defence','private','research','contractual','other') DEFAULT 'other',
  category ENUM('job','exam','internship','fellowship','project','other') DEFAULT 'job',
  eligibility_pct INT DEFAULT NULL,
  profile_match_pct INT DEFAULT NULL,
  compensation_score INT DEFAULT NULL,
  career_potential_score INT DEFAULT NULL,
  competition_signal INT DEFAULT NULL,
  application_difficulty_score INT DEFAULT NULL,
  org_quality_score INT DEFAULT NULL,
  deadline_urgency_score INT DEFAULT NULL,
  opportunity_score INT DEFAULT NULL,
  recommendation ENUM('apply_now','worth_applying','investigate','ignore') DEFAULT NULL,
  content_hash VARCHAR(64) DEFAULT '',
  raw_text TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_new TINYINT(1) NOT NULL DEFAULT 1,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  requires_gate TINYINT(1) DEFAULT 0,
  is_verified_active TINYINT(1) DEFAULT 1,
  verification_source VARCHAR(255) DEFAULT '',
  verified_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  is_applied TINYINT(1) DEFAULT 0,
  applied_at TIMESTAMP NULL DEFAULT NULL,
  category_group VARCHAR(50) NOT NULL DEFAULT 'private_in',
  country VARCHAR(100) NOT NULL DEFAULT 'India',
  region VARCHAR(100) NOT NULL DEFAULT 'India',
  visa_sponsored TINYINT(1) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  compensation_display VARCHAR(100) NOT NULL DEFAULT '',
  posted_date DATE DEFAULT NULL,
  confidence_metadata JSON NULL DEFAULT NULL,
  is_active_link TINYINT(1) NOT NULL DEFAULT 1,
  last_verified_at TIMESTAMP NULL DEFAULT NULL,
  discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Change detection hashes (for future automated crawling)
CREATE TABLE IF NOT EXISTS jobhunt_content_hashes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  title_hint VARCHAR(300) DEFAULT '',
  source_url VARCHAR(500) DEFAULT '',
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_org_hash (org_id, content_hash)
);

-- Seed Premier PSUs, Strategic R&D, and Central Banking Organizations
INSERT INTO jobhunt_organizations (id, name, short_name, sector, org_type, careers_url, notification_url, website, quality_score, notes, poll_frequency_days, is_active) VALUES
  (1, 'Centre for Development of Advanced Computing', 'C-DAC', 'IT & High Performance Computing', 'Autonomous Society (MeitY)', 'https://www.cdac.in/index.aspx?id=current_jobs', 'https://www.cdac.in/index.aspx?id=current_jobs', 'https://www.cdac.in', 93, 'Project Engineer, Senior Project Engineer, Principal Engineer. Pay: ₹12,00,000 - ₹18,00,000 consolidated.', 7, 1),
  (2, 'Indian Space Research Organisation', 'ISRO', 'Space & Satellite Technology', 'Department of Space (Govt of India)', 'https://www.isro.gov.in/Careers.html', 'https://www.isro.gov.in/CurrentOpportunities.html', 'https://www.isro.gov.in', 98, 'Scientist/Engineer \'SC\' (ICRB / Direct). 7th CPC Pay Matrix Level 10 (₹56,100 - ₹1,77,500). Gross CTC ₹15 - ₹18 LPA with HRA & PRIS incentives.', 7, 1),
  (4, 'Oil and Natural Gas Corporation', 'ONGC', 'Oil & Gas', 'Maharatna CPSE', 'https://ongcindia.com/web/eng/career', 'https://ongcindia.com/web/eng/career/recruitment-notices', 'https://ongcindia.com', 96, 'Assistant Executive Engineer (AEE) in Engg / IT / Geo-sciences. Pay Scale: ₹60,000 - ₹1,80,000 (E-1). Typical CTC: ₹22 - ₹25 LPA + offshore allowances.', 7, 1),
  (5, 'Indian Oil Corporation Limited', 'IOCL', 'Oil & Gas', 'Maharatna CPSE', 'https://iocl.com/latest-job-opening', 'https://iocl.com/latest-job-opening', 'https://iocl.com', 95, 'Officers / Engineers (Grade A / E-2). Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹17 - ₹21 LPA.', 7, 1),
  (6, 'NTPC Limited', 'NTPC', 'Power & Energy', 'Maharatna CPSE', 'https://careers.ntpc.co.in/', 'https://careers.ntpc.co.in/recruitment/', 'https://ntpc.co.in', 95, 'Engineering Executive Trainees (EET) & Assistant Manager (IT/Systems). Pay Scale: ₹60,000 - ₹1,80,000 (E-2). Typical CTC: ₹18 - ₹22 LPA.', 7, 1),
  (7, 'Bharat Heavy Electricals Limited', 'BHEL', 'Heavy Engineering & Power', 'Maharatna CPSE', 'https://careers.bhel.in/', 'https://careers.bhel.in/bhel/jsp/', 'https://www.bhel.com', 92, 'Engineer Trainees (ET) in Mech, Elec, Civil, IT. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹15.5 - ₹18 LPA.', 7, 1),
  (8, 'GAIL (India) Limited', 'GAIL', 'Oil & Gas / Petrochemicals', 'Maharatna CPSE', 'https://gailonline.com/CRApplyingGail.html', 'https://gailonline.com/CRApplyingGail.html', 'https://gailonline.com', 95, 'Executive Trainees (ET) in Engg / Telecom / IT / HR. Pay Scale: ₹60,000 - ₹1,80,000 (E-2). Typical CTC: ₹18 - ₹22 LPA.', 7, 1),
  (9, 'Bharat Petroleum Corporation Limited', 'BPCL', 'Oil & Gas', 'Maharatna CPSE', 'https://www.bharatpetroleum.in/careers/careers.aspx', 'https://www.bharatpetroleum.in/careers/current-openings.aspx', 'https://www.bharatpetroleum.in', 94, 'Management Trainee / General Work Engineer (GWE). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹18 - ₹22 LPA.', 7, 1),
  (10, 'Hindustan Petroleum Corporation Limited', 'HPCL', 'Oil & Gas', 'Maharatna CPSE', 'https://www.hindustanpetroleum.com/job-openings', 'https://jobs.hpcl.co.in/', 'https://www.hindustanpetroleum.com', 94, 'Officers / Engineers (E-2). Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹16.8 - ₹20.5 LPA.', 7, 1),
  (11, 'Coal India Limited', 'CIL', 'Mining & Energy', 'Maharatna CPSE', 'https://www.coalindia.in/career-at-cil/', 'https://www.coalindia.in/career-at-cil/jobs-at-coal-india/', 'https://www.coalindia.in', 93, 'Management Trainees (E-2) in Mining, Civil, Mechanical, Systems/IT. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16 - ₹19 LPA.', 7, 1),
  (12, 'Power Grid Corporation of India Limited', 'POWERGRID', 'Power Transmission & Telecom', 'Maharatna CPSE', 'https://www.powergrid.in/job-opportunities', 'https://www.powergrid.in/job-opportunities', 'https://www.powergrid.in', 95, 'Engineer Trainee (Electrical, Electronics, Civil, Computer Science). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹18 - ₹21.5 LPA.', 7, 1),
  (13, 'Steel Authority of India Limited', 'SAIL', 'Steel & Metals', 'Maharatna CPSE', 'https://sail.co.in/en/plants/careers', 'https://www.sailcareers.com/', 'https://sail.co.in', 91, 'Management Trainee (Technical - MTT). Pay Scale: ₹60,000 - ₹1,80,000 (E-1/E-2). Typical CTC: ₹15 - ₹18 LPA.', 7, 1),
  (14, 'Power Finance Corporation', 'PFC', 'Financial Services / NBFC', 'Maharatna CPSE', 'https://pfcindia.com/Career', 'https://pfcindia.com/Career', 'https://pfcindia.com', 95, 'Assistant Manager / Officer in IT / Finance / Technical. Pay Scale: ₹60,000 - ₹1,80,000 (E-2). Typical CTC: ₹20 - ₹26 LPA.', 7, 1),
  (15, 'REC Limited', 'REC', 'Financial Services / Infrastructure', 'Maharatna CPSE', 'https://recindia.nic.in/careers', 'https://recindia.nic.in/careers', 'https://recindia.nic.in', 95, 'Assistant Executive / Officer in IT, Engineering, Finance. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹20 - ₹25 LPA.', 7, 1),
  (16, 'Oil India Limited', 'OIL', 'Oil & Gas / Exploration', 'Maharatna CPSE', 'https://www.oil-india.com/Current-openings', 'https://www.oil-india.com/Current-openings', 'https://www.oil-india.com', 94, 'Executive Trainee (Grade B/E-2). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹17.5 - ₹22 LPA.', 7, 1),
  (17, 'Bharat Electronics Limited', 'BEL', 'Defence Electronics & Aerospace', 'Navratna CPSE', 'https://bel-india.in/careers/', 'https://bel-india.in/recruitment/', 'https://bel-india.in', 94, 'Probationary Engineer (PE) in Radar, Software, Electronics. Pay Scale: ₹40,000 - ₹1,40,000 / ₹50,000 - ₹1,60,000. Typical CTC: ₹14.5 - ₹17.5 LPA.', 7, 1),
  (18, 'Hindustan Aeronautics Limited', 'HAL', 'Aerospace & Defence', 'Navratna CPSE', 'https://hal-india.co.in/Career_Active.aspx', 'https://hal-india.co.in/Career_Active.aspx', 'https://hal-india.co.in', 93, 'Management Trainee (Technical) / Design Trainee. Pay Scale: ₹40,000 - ₹1,40,000 / E-2. Typical CTC: ₹15 - ₹18 LPA.', 7, 1),
  (19, 'National Aluminium Company Limited', 'NALCO', 'Metals & Mining', 'Navratna CPSE', 'https://nalcoindia.com/career/', 'https://nalcoindia.com/career/current-openings/', 'https://nalcoindia.com', 90, 'Graduate Engineer Trainee (GET) in Mech, Elec, Mining, Systems. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹15.5 - ₹18.5 LPA.', 7, 1),
  (20, 'NMDC Limited', 'NMDC', 'Mining & Exploration', 'Navratna CPSE', 'https://www.nmdc.co.in/careers', 'https://www.nmdc.co.in/careers', 'https://www.nmdc.co.in', 92, 'Executive Trainee (Technical). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16 - ₹19.5 LPA.', 7, 1),
  (21, 'Engineers India Limited', 'EIL', 'Consultancy & Petrochemical Engg', 'Navratna CPSE', 'https://recruitment.eil.co.in/', 'https://recruitment.eil.co.in/', 'https://engineersindia.com', 92, 'Management Trainee (Construction/Design/IT). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16.5 - ₹19.5 LPA.', 7, 1),
  (22, 'NBCC (India) Limited', 'NBCC', 'Infrastructure & Construction', 'Navratna CPSE', 'https://www.nbccindia.in/webEnglish/jobs', 'https://www.nbccindia.in/webEnglish/jobs', 'https://www.nbccindia.in', 89, 'Management Trainee (Civil, Electrical, IT). Pay Scale: ₹40,000 - ₹1,40,000 / E-2. Typical CTC: ₹14 - ₹16.5 LPA.', 7, 1),
  (23, 'Container Corporation of India', 'CONCOR', 'Logistics & Transportation', 'Navratna CPSE', 'https://concor.co.in/currentopening.asp', 'https://concor.co.in/currentopening.asp', 'https://concor.co.in', 90, 'Management Trainee (IT, Operations, Civil, Tech). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16 - ₹19 LPA.', 7, 1),
  (24, 'Rashtriya Ispat Nigam Limited', 'RINL', 'Steel & Heavy Industry', 'Navratna CPSE', 'https://www.vizagsteel.com/myindex.asp?cccode=careers', 'https://www.vizagsteel.com/myindex.asp?cccode=careers', 'https://www.vizagsteel.com', 89, 'Management Trainee (Technical - MTT). Pay Scale: ₹50,000 - ₹1,60,000 (E-1/E-2). Typical CTC: ₹14.5 - ₹17 LPA.', 7, 1),
  (25, 'NLC India Limited', 'NLCIL', 'Power & Lignite Mining', 'Navratna CPSE', 'https://www.nlcindia.in/new_website/careers/careers.php', 'https://web.nlcindia.in/career/', 'https://www.nlcindia.in', 91, 'Graduate Executive Trainee (GET) in Mech, Elec, Civil, Mining, CSE. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16 - ₹19 LPA.', 7, 1),
  (26, 'Rail Vikas Nigam Limited', 'RVNL', 'Railways Infrastructure', 'Navratna CPSE', 'https://rvnl.org/career', 'https://rvnl.org/career', 'https://rvnl.org', 91, 'Assistant Manager (Civil, Electrical, S&T, IT). Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹15 - ₹18 LPA.', 7, 1),
  (27, 'IRCON International Limited', 'IRCON', 'Railways & Infrastructure', 'Navratna CPSE', 'https://www.ircon.org/index.php?option=com_content&view=article&id=16&Itemid=121&lang=en', 'https://www.ircon.org/index.php?option=com_content&view=article&id=16&Itemid=121&lang=en', 'https://www.ircon.org', 90, 'Executive Trainee / Assistant Manager (Civil, S&T, Electrical). Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹15 - ₹18 LPA.', 7, 1),
  (28, 'RITES Limited', 'RITES', 'Transport Infrastructure Consultancy', 'Navratna CPSE', 'https://rites.com/career', 'https://rites.com/career', 'https://rites.com', 91, 'Graduate Executive Trainee / Engineer. Pay Scale: ₹50,000 - ₹1,60,000 (E-2). Typical CTC: ₹15.5 - ₹18 LPA.', 7, 1),
  (29, 'Indian Renewable Energy Development Agency', 'IREDA', 'Renewable Energy Finance', 'Navratna CPSE', 'https://www.ireda.in/career', 'https://www.ireda.in/career', 'https://www.ireda.in', 93, 'Assistant Manager in Technical / IT / Green Finance. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹18 - ₹22 LPA.', 7, 1),
  (30, 'Housing and Urban Development Corporation', 'HUDCO', 'Housing & Urban Finance', 'Navratna CPSE', 'https://hudco.org.in/career', 'https://hudco.org.in/career', 'https://hudco.org.in', 90, 'Trainee Officers / Assistant Manager. Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹15 - ₹18 LPA.', 7, 1),
  (31, 'NHPC Limited', 'NHPC', 'Hydroelectric Power', 'Navratna CPSE', 'https://www.nhpcindia.com/welcome/career', 'https://www.nhpcindia.com/welcome/career', 'https://www.nhpcindia.com', 92, 'Trainee Engineer / Trainee Officer (E-2). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16 - ₹19 LPA.', 7, 1),
  (32, 'SJVN Limited', 'SJVN', 'Hydro & Renewable Energy', 'Navratna CPSE', 'https://sjvn.nic.in/current-jobs', 'https://sjvn.nic.in/current-jobs', 'https://sjvn.nic.in', 91, 'Executive Trainee in Civil, Electrical, Mechanical, IT. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹15.5 - ₹18.5 LPA.', 7, 1),
  (33, 'Solar Energy Corporation of India', 'SECI', 'Solar Energy & Green Hydrogen', 'Navratna CPSE', 'https://www.seci.co.in/careers', 'https://www.seci.co.in/careers', 'https://www.seci.co.in', 92, 'Senior Engineer / Deputy Manager in Solar Power & Grid Integration. Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹16 - ₹19 LPA.', 7, 1),
  (34, 'RailTel Corporation of India', 'RailTel', 'Telecom & Cloud Infrastructure', 'Navratna CPSE', 'https://www.railtel.in/careers.html', 'https://www.railtel.in/careers.html', 'https://www.railtel.in', 91, 'Assistant Manager (Technical / Telecom / IT / Cloud). Pay Scale: ₹40,000 - ₹1,40,000 (E-1). Typical CTC: ₹14.5 - ₹17 LPA.', 7, 1),
  (35, 'Mazagon Dock Shipbuilders Limited', 'MDL', 'Defence Shipbuilding & Submarines', 'Navratna CPSE', 'https://mazagondock.in/careers.aspx', 'https://mazagondock.in/careers.aspx', 'https://mazagondock.in', 92, 'Executive Trainee (Naval Architecture, Mechanical, Electrical). Pay Scale: ₹40,000 - ₹1,40,000 / E-2. Typical CTC: ₹15 - ₹18 LPA.', 7, 1),
  (36, 'Rashtriya Chemicals and Fertilizers', 'RCF', 'Fertilizers & Chemicals', 'Navratna CPSE', 'https://www.rcfltd.com/recruitment', 'https://www.rcfltd.com/recruitment', 'https://www.rcfltd.com', 90, 'Management Trainee in Chemical, Mechanical, Electrical, IT. Pay Scale: ₹40,000 - ₹1,40,000 / E-2. Typical CTC: ₹15 - ₹17.5 LPA.', 7, 1),
  (37, 'Nuclear Power Corporation of India Limited', 'NPCIL', 'Nuclear Power & Energy', 'Miniratna CPSE', 'https://www.npcilcareers.co.in/MainSite/default.aspx', 'https://www.npcilcareers.co.in/', 'https://www.npcil.nic.in', 95, 'Executive Trainee (ET) in Mech, Chem, Elec, Electronics, Instrumentation, Civil. Pay Level 10. Typical CTC: ₹18 - ₹22 LPA.', 7, 1),
  (38, 'THDC India Limited', 'THDC', 'Hydro & Thermal Power', 'Miniratna CPSE', 'https://thdc.co.in/recruitment', 'https://thdc.co.in/recruitment', 'https://thdc.co.in', 90, 'Executive Trainee (Civil, Electrical, Mechanical, IT). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16 - ₹19 LPA.', 7, 1),
  (39, 'Garden Reach Shipbuilders & Engineers', 'GRSE', 'Defence Shipbuilding', 'Miniratna CPSE', 'https://grse.in/current-jobs/', 'https://jobapply.in/grse/', 'https://grse.in', 90, 'Management Trainee (Technical). Pay Scale: ₹40,000 - ₹1,40,000 (E-1/E-2). Typical CTC: ₹14.5 - ₹17 LPA.', 7, 1),
  (40, 'Bharat Dynamics Limited', 'BDL', 'Missiles & Defence Systems', 'Miniratna CPSE', 'https://bdl-india.in/careers', 'https://bdl-india.in/careers', 'https://bdl-india.in', 92, 'Management Trainee (Mech, ECE, EEE, Civil, CSE). Pay Scale: ₹40,000 - ₹1,40,000 / E-2. Typical CTC: ₹15 - ₹18 LPA.', 7, 1),
  (41, 'Mishra Dhatu Nigam Limited', 'MIDHANI', 'Special Alloys & Strategic Metals', 'Miniratna CPSE', 'https://midhani-india.in/careers/', 'https://midhani-india.in/careers/', 'https://midhani-india.in', 90, 'Management Trainee (Metallurgy, Mech, EEE, ECE). Pay Scale: ₹40,000 - ₹1,40,000. Typical CTC: ₹14.5 - ₹17 LPA.', 7, 1),
  (42, 'Cochin Shipyard Limited', 'CSL', 'Shipbuilding & Marine Engineering', 'Miniratna CPSE', 'https://cochinshipyard.in/career', 'https://cochinshipyard.in/career', 'https://cochinshipyard.in', 91, 'Executive Trainee in Mechanical, Electrical, Electronics, Naval Architecture. Pay Scale: ₹40,000 - ₹1,40,000. Typical CTC: ₹15 - ₹18 LPA.', 7, 1),
  (43, 'Goa Shipyard Limited', 'GSL', 'Defence Shipbuilding', 'Miniratna CPSE', 'https://goashipyard.in/careers/vacancies/', 'https://goashipyard.in/careers/vacancies/', 'https://goashipyard.in', 89, 'Management Trainee (Naval Architecture, Mech, Electrical, IT). Pay Scale: ₹40,000 - ₹1,40,000. Typical CTC: ₹14.5 - ₹16.5 LPA.', 7, 1),
  (44, 'BEML Limited', 'BEML', 'Heavy Earthmoving, Rail & Metro', 'Miniratna CPSE', 'https://www.bemlindia.in/current-openings/', 'https://www.bemlindia.in/current-openings/', 'https://www.bemlindia.in', 90, 'Management Trainee (Mech, EEE, ECE, Production). Pay Scale: ₹40,000 - ₹1,40,000. Typical CTC: ₹14.5 - ₹17 LPA.', 7, 1),
  (45, 'Mangalore Refinery and Petrochemicals Limited', 'MRPL', 'Refining & Petrochemicals', 'Miniratna CPSE', 'https://www.mrpl.co.in/careers', 'https://www.mrpl.co.in/careers', 'https://www.mrpl.co.in', 92, 'Executive Trainee (Chemical, Mechanical, Electrical, Instrumentation, IT). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹17 - ₹20 LPA.', 7, 1),
  (46, 'Chennai Petroleum Corporation Limited', 'CPCL', 'Refining & Energy', 'Miniratna CPSE', 'https://cpcl.co.in/people-careers/recruitment-drive/', 'https://cpcl.co.in/people-careers/recruitment-drive/', 'https://cpcl.co.in', 91, 'Engineer / Officer in Chemical, Mechanical, Electrical, IT. Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹16 - ₹19 LPA.', 7, 1),
  (47, 'Brahmaputra Cracker and Polymer Limited', 'BCPL', 'Petrochemicals', 'Miniratna CPSE', 'https://bcplonline.co.in/Careers', 'https://bcplonline.co.in/Careers', 'https://bcplonline.co.in', 89, 'Executive Trainee in Chemical, Mechanical, Electrical, IT. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16 - ₹19 LPA.', 7, 1),
  (48, 'Airports Authority of India', 'AAI', 'Civil Aviation & Air Traffic Control', 'Miniratna CPSE', 'https://www.aai.aero/en/careers/recruitment', 'https://www.aai.aero/en/careers/recruitment', 'https://www.aai.aero', 93, 'Junior Executive (Air Traffic Control, Electronics, IT, Civil, Electrical). Pay Scale: ₹40,000 - ₹1,40,000 (E-1). Typical CTC: ₹15 - ₹18.5 LPA.', 7, 1),
  (49, 'Dedicated Freight Corridor Corporation of India', 'DFCCIL', 'Railways Infrastructure', 'Miniratna CPSE', 'https://dfccil.com/Home/ActiveCareer', 'https://dfccil.com/Home/ActiveCareer', 'https://dfccil.com', 91, 'Junior Manager (Civil, Electrical, S&T, IT, Operations). Pay Scale: ₹50,000 - ₹1,60,000 (E-2). Typical CTC: ₹15 - ₹18 LPA.', 7, 1),
  (50, 'Delhi Metro Rail Corporation', 'DMRC', 'Urban Mass Transit', 'Joint Venture PSU', 'https://www.delhimetrorail.com/career', 'https://www.delhimetrorail.com/career', 'https://www.delhimetrorail.com', 91, 'Assistant Manager (Electrical, S&T, Civil, Operations, IT). Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹15 - ₹18 LPA.', 7, 1),
  (51, 'National Highways Authority of India', 'NHAI', 'Road Infrastructure', 'Statutory Authority', 'https://nhai.gov.in/#/vacancies/current', 'https://nhai.gov.in/#/vacancies/current', 'https://nhai.gov.in', 92, 'Deputy Manager (Technical / Civil / IT). Pay Level 10 (₹56,100 - ₹1,77,500). Typical CTC: ₹15.5 - ₹18.5 LPA.', 7, 1),
  (52, 'National Fertilizers Limited', 'NFL', 'Fertilizers & Chemicals', 'Miniratna CPSE', 'https://www.nationalfertilizers.com/careers', 'https://www.nationalfertilizers.com/careers', 'https://www.nationalfertilizers.com', 89, 'Management Trainee in Chemical, Mechanical, Electrical, Instrumentation, IT. Pay Scale: ₹40,000 - ₹1,40,000. Typical CTC: ₹14.5 - ₹16.5 LPA.', 7, 1),
  (53, 'IREL (India) Limited', 'IREL', 'Strategic Minerals & Rare Earths', 'Miniratna CPSE (DAE)', 'https://www.irel.co.in/careers', 'https://www.irel.co.in/careers', 'https://www.irel.co.in', 90, 'Management Trainee in Mining, Chemical, Mechanical, Electrical. Pay Scale: ₹40,000 - ₹1,40,000. Typical CTC: ₹14.5 - ₹17 LPA.', 7, 1),
  (54, 'Security Printing and Minting Corporation of India', 'SPMCIL', 'Currency, Minting & Security Paper', 'Miniratna CPSE', 'https://www.spmcil.com/en/careers/', 'https://www.spmcil.com/en/careers/', 'https://www.spmcil.com', 91, 'Assistant Manager (Tech Ops, IT, Materials, Electrical). Pay Scale: ₹40,000 - ₹1,40,000 (E-1). Typical CTC: ₹15 - ₹18 LPA.', 7, 1),
  (55, 'Reserve Bank of India', 'RBI', 'Central Banking & Financial Regulation', 'Regulatory / Statutory Body', 'https://opportunities.rbi.org.in/scripts/vacancies.aspx', 'https://opportunities.rbi.org.in/', 'https://www.rbi.org.in', 99, 'Grade B Officer (General / DEPR / DSIM / Information Technology). Starting CTC exceeds ₹28 - ₹32 LPA with Mumbai lease, allowances, and perks.', 7, 1),
  (56, 'Securities and Exchange Board of India', 'SEBI', 'Capital Markets Regulation', 'Regulatory / Statutory Body', 'https://www.sebi.gov.in/sebiweb/other/career.jsp', 'https://www.sebi.gov.in/sebiweb/other/career.jsp', 'https://www.sebi.gov.in', 98, 'Officer Grade A (Assistant Manager) in IT, General, Legal, Research. Starting CTC ₹24 - ₹28 LPA.', 7, 1),
  (57, 'National Bank for Agriculture and Rural Development', 'NABARD', 'Development Finance & Agriculture', 'Statutory Body', 'https://www.nabard.org/careers-notices.aspx', 'https://www.nabard.org/careers-notices.aspx', 'https://www.nabard.org', 96, 'Assistant Manager (Grade A) in Information Technology, General, Finance. Starting CTC ₹18 - ₹22 LPA.', 7, 1),
  (58, 'Small Industries Development Bank of India', 'SIDBI', 'MSME Development Finance', 'Statutory Body', 'https://www.sidbi.in/en/careers', 'https://www.sidbi.in/en/careers', 'https://www.sidbi.in', 95, 'Assistant Manager (Grade A) in General & IT streams. Starting CTC ₹18 - ₹22 LPA.', 7, 1),
  (59, 'Export-Import Bank of India', 'EXIM Bank', 'International Trade & Finance', 'Statutory Body', 'https://www.eximbankindia.in/careers', 'https://www.eximbankindia.in/careers', 'https://www.eximbankindia.in', 95, 'Management Trainee / Deputy Manager (IT, International Trade, Credit). Starting CTC ₹18 - ₹21 LPA.', 7, 1),
  (60, 'Insurance Regulatory and Development Authority of India', 'IRDAI', 'Insurance Regulation', 'Regulatory / Statutory Body', 'https://irdai.gov.in/careers', 'https://irdai.gov.in/careers', 'https://irdai.gov.in', 96, 'Assistant Manager in IT, Actuarial, General. Starting CTC ₹20 - ₹25 LPA.', 7, 1),
  (61, 'Pension Fund Regulatory and Development Authority', 'PFRDA', 'Pension Regulation', 'Regulatory / Statutory Body', 'https://www.pfrda.org.in/index1.cshtml?lsid=78', 'https://www.pfrda.org.in/index1.cshtml?lsid=78', 'https://www.pfrda.org.in', 95, 'Officer Grade A (Assistant Manager) in IT, Finance, General. Starting CTC ₹20 - ₹24 LPA.', 7, 1),
  (62, 'ECGC Limited', 'ECGC', 'Export Insurance & Trade', 'CPSE', 'https://www.ecgc.in/career/', 'https://www.ecgc.in/career/', 'https://www.ecgc.in', 93, 'Probationary Officer (Executive Officer). Pay Scale: ₹53,600 - ₹1,02,900. Typical CTC: ₹16 - ₹19.5 LPA.', 7, 1),
  (63, 'State Bank of India', 'SBI', 'Public Sector Banking', 'Statutory Banking Corporation', 'https://sbi.co.in/web/careers/current-openings', 'https://sbi.co.in/web/careers/current-openings', 'https://sbi.co.in', 95, 'Probationary Officer (PO) & Specialist Cadre Officer (SCO - Cloud Architect, DevOps, Security). CTC: ₹16 - ₹24 LPA.', 7, 1),
  (64, 'Vikram Sarabhai Space Centre', 'VSSC', 'Space Launch Vehicles', 'ISRO Lead Centre', 'https://www.vssc.gov.in/recruitment.html', 'https://www.vssc.gov.in/recruitment.html', 'https://www.vssc.gov.in', 97, 'Scientist/Engineer \'SC\' (Level 10: ₹56,100 - ₹1,77,500). Launch vehicle avionics, propulsion, guidance & flight software. CTC ~₹15 - ₹18 LPA.', 7, 1),
  (65, 'U R Rao Satellite Centre', 'URSC', 'Satellite Systems & Payload', 'ISRO Lead Centre', 'https://www.ursc.gov.in/careers/', 'https://www.ursc.gov.in/careers/', 'https://www.ursc.gov.in', 97, 'Scientist/Engineer \'SC\' (Level 10). Spacecraft electronics, satellite bus, computing systems. CTC ~₹15 - ₹18 LPA.', 7, 1),
  (66, 'Space Applications Centre', 'SAC', 'Remote Sensing & Satcom Payloads', 'ISRO Lead Centre', 'https://www.sac.gov.in/Vyom/recruitment.jsp', 'https://www.sac.gov.in/Vyom/recruitment.jsp', 'https://www.sac.gov.in', 96, 'Scientist/Engineer \'SC\' (Level 10). AI/ML, computer vision, satellite communications. CTC ~₹15 - ₹18 LPA.', 7, 1),
  (67, 'IN-SPACe (Indian National Space Promotion and Authorization Centre)', 'IN-SPACe', 'Space Technology & Commercial Space', 'Autonomous Agency (Dept of Space)', 'https://www.inspace.gov.in/inspace?id=inspace_careers', 'https://www.inspace.gov.in/inspace?id=inspace_careers', 'https://www.inspace.gov.in', 95, 'Deputy Director, Lead Systems Architect, Space Systems Engineer. CTC ₹16 - ₹24 LPA.', 7, 1),
  (68, 'Defence Research and Development Organisation', 'DRDO', 'Defence R&D & Strategic Systems', 'Ministry of Defence (Govt of India)', 'https://rac.gov.in/', 'https://rac.gov.in/index.php?lang=en&id=0', 'https://www.drdo.gov.in', 97, 'Scientist \'B\' recruited via Recruitment and Assessment Centre (RAC). 7th CPC Level 10 (₹56,100 - ₹1,77,500). Gross CTC ₹15 - ₹18.5 LPA + PRIS.', 7, 1),
  (69, 'National Informatics Centre', 'NIC', 'Govt IT & Cloud Infrastructure', 'Ministry of Electronics & IT (MeitY)', 'https://recruitment.nic.in/', 'https://www.calicut.nielit.in/nic21/', 'https://www.nic.in', 95, 'Scientist \'B\' & Scientific/Technical Assistant \'A\' (MeitY). 7th CPC Level 10 (₹56,100 - ₹1,77,500). Gross CTC ₹15 - ₹18 LPA.', 7, 1),
  (70, 'Bhabha Atomic Research Centre', 'BARC', 'Atomic Energy & Nuclear R&D', 'Department of Atomic Energy (DAE)', 'https://www.barcocenter.gov.in/', 'https://barcrecruit.gov.in/', 'https://www.barc.gov.in', 97, 'Scientific Officer \'C\' via OCES / DGFS / Direct. Level 10 (₹56,100 - ₹1,77,500). Gross CTC ₹16 - ₹19.5 LPA.', 7, 1),
  (71, 'Indira Gandhi Centre for Atomic Research', 'IGCAR', 'Fast Reactor & Nuclear R&D', 'Department of Atomic Energy (DAE)', 'https://www.igcar.gov.in/recruitment/', 'https://www.igcar.gov.in/recruitment/', 'https://www.igcar.gov.in', 94, 'Scientific Officer \'C\' (Level 10: ₹56,100 - ₹1,77,500). Typical CTC: ₹15.5 - ₹18.5 LPA.', 7, 1),
  (72, 'Centre for Development of Telematics', 'C-DOT', 'Telecom, 5G & Cyber Systems', 'Autonomous Telecom R&D (DoT)', 'https://www.cdot.in/cdotweb/web/careers.php', 'https://www.cdot.in/cdotweb/web/careers.php', 'https://www.cdot.in', 94, 'Research Engineers in 5G, Optical, Cloud & Telecom Software. CTC: ₹16 - ₹22 LPA.', 7, 1),
  (73, 'Council of Scientific and Industrial Research', 'CSIR', 'Scientific & Industrial Research', 'Autonomous R&D (DSIR)', 'https://www.csir.res.in/career-opportunities', 'https://www.csir.res.in/notifications', 'https://www.csir.res.in', 93, 'Scientist (Level 11: ₹67,700 - ₹2,08,700) / Senior Scientist across 37 CSIR national laboratories. Gross CTC ₹16 - ₹20 LPA.', 7, 1),
  (74, 'National Technical Research Organisation', 'NTRO', 'Geospatial & Cyber Intelligence', 'Cabinet Secretariat / PMO', 'https://ntro.gov.in/ntroWeb/loadRecruitmentsHome.do', 'https://ntro.gov.in/', 'https://ntro.gov.in', 97, 'Scientist \'B\' & Technical Officer in Cyber, Satcom, Cryptology. 7th CPC Level 10 (₹56,100 - ₹1,77,500) + 20% Special Security Allowance. CTC ₹17 - ₹21 LPA.', 7, 1),
  (75, 'Bureau of Indian Standards', 'BIS', 'Standards & Quality Certification', 'Statutory Body (Consumer Affairs)', 'https://www.services.bis.gov.in/php/BIS_2.0/bis_core/careers/', 'https://www.bis.gov.in/career-opportunity/', 'https://www.bis.gov.in', 93, 'Scientist-B in Computer, Mechanical, Electrical, Civil, Chemical. 7th CPC Level 10 (₹56,100 - ₹1,77,500). Gross CTC ₹15.5 - ₹18.5 LPA.', 7, 1),
  (76, 'Society for Applied Microwave Electronics Engineering & Research', 'SAMEER', 'RF, Microwave & Radar R&D', 'Autonomous R&D (MeitY)', 'https://www.sameer.gov.in/recruitment', 'https://www.sameer.gov.in/recruitment', 'https://www.sameer.gov.in', 92, 'Scientist \'B\' in RF, Microwave, Cloud, DSP. 7th CPC Level 10. Typical CTC: ₹15 - ₹18 LPA.', 7, 1),
  (77, 'Centre for Railway Information Systems', 'CRIS', 'Railways IT & Enterprise Cloud', 'Autonomous Society (Ministry of Railways)', 'https://cris.org.in/crisweb/design1/index.jsp', 'https://cris.org.in/', 'https://cris.org.in', 94, 'Assistant Software Engineer (ASE) / Assistant Data Analyst (ADA). Pay Scale: ₹60,000 - ₹1,80,000 (7th CPC Level 7 / E-2). Typical CTC: ₹16 - ₹19 LPA.', 7, 1),
  (78, 'ERNET India', 'ERNET', 'Education & Research Networking', 'Autonomous Society (MeitY)', 'https://ernet.in/careers', 'https://ernet.in/careers', 'https://ernet.in', 90, 'Scientific Officer & Senior Systems Engineer. Level 10 (CTC ~₹15 - ₹17.5 LPA).', 7, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), careers_url = VALUES(careers_url);

-- Opportunities are populated and maintained dynamically via crawler and verified seed scripts.

-- ── Phase 9: Dossier & AI Job Search Workflow Integration ──

CREATE TABLE IF NOT EXISTS jobhunt_evidence_claims (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  source_title VARCHAR(255) NOT NULL,
  claim_text TEXT NOT NULL,
  metrics_json JSON NULL,
  skills_tags JSON NULL,
  is_verified TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ev_cat (category),
  INDEX idx_ev_verified (is_verified)
);

CREATE TABLE IF NOT EXISTS jobhunt_document_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  opportunity_id INT NULL,
  application_id INT NULL,
  org_name VARCHAR(255) NOT NULL,
  role_title VARCHAR(255) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  status ENUM('draft', 'reviewed', 'approved', 'submitted', 'archived') NOT NULL DEFAULT 'draft',
  tailored_resume_markdown MEDIUMTEXT NOT NULL,
  tailored_cover_letter_markdown MEDIUMTEXT NULL,
  target_job_description MEDIUMTEXT NULL,
  key_skills_addressed JSON NULL,
  evidence_claims_used JSON NULL,
  submitted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pkg_opp (opportunity_id),
  INDEX idx_pkg_app (application_id),
  INDEX idx_pkg_status (status)
);

CREATE TABLE IF NOT EXISTS jobhunt_document_reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_id INT NOT NULL,
  review_score INT NOT NULL DEFAULT 100,
  hallucination_risk ENUM('none', 'low', 'medium', 'high') NOT NULL DEFAULT 'none',
  unsupported_claims JSON NULL,
  missing_requirements JSON NULL,
  critique_notes TEXT NULL,
  reviewer_agent VARCHAR(64) NOT NULL DEFAULT 'dossier_fact_reviewer',
  reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rev_pkg (package_id)
);

CREATE TABLE IF NOT EXISTS jobhunt_application_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  title VARCHAR(255) NOT NULL,
  notes TEXT NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_evt_app (application_id),
  INDEX idx_evt_date (event_date)
);

CREATE TABLE IF NOT EXISTS jobhunt_mock_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  opportunity_id INT NULL,
  application_id INT NULL,
  package_id INT NULL,
  role_title VARCHAR(255) NOT NULL,
  org_name VARCHAR(255) NOT NULL,
  stage_name VARCHAR(100) NOT NULL DEFAULT 'Technical Round',
  status ENUM('active', 'completed', 'abandoned') NOT NULL DEFAULT 'active',
  questions_json JSON NOT NULL,
  current_question_index INT NOT NULL DEFAULT 0,
  answers_json JSON NULL,
  overall_feedback TEXT NULL,
  overall_score INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_mock_opp (opportunity_id),
  INDEX idx_mock_app (application_id),
  INDEX idx_mock_status (status)
);

