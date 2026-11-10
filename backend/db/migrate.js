const pool = require('./db');

// Every statement here must be safe to run repeatedly (IF NOT EXISTS / INSERT IGNORE),
// since this runs on every startup, including against a database that already has
// real data in it from a previous deployment.
const MIGRATIONS = [
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_pinned TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'INR'`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS fx_rate_to_base DECIMAL(12,4) NOT NULL DEFAULT 1`,

  `CREATE TABLE IF NOT EXISTS savings_goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    target_amount DECIMAL(12,2) NOT NULL,
    target_date DATE DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS savings_contributions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    goal_id INT NOT NULL,
    transaction_id INT DEFAULT NULL,
    amount DECIMAL(12,2) NOT NULL,
    contributed_on DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS loans (
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
  )`,

  `CREATE TABLE IF NOT EXISTS loan_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    loan_id INT NOT NULL,
    transaction_id INT DEFAULT NULL,
    amount DECIMAL(12,2) NOT NULL,
    paid_on DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS templates (
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
  )`,

  `CREATE TABLE IF NOT EXISTS bill_reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    amount DECIMAL(12,2) DEFAULT NULL,
    category_id INT DEFAULT NULL,
    due_day INT NOT NULL,
    remind_days_before INT NOT NULL DEFAULT 3,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS budget_transfers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    month VARCHAR(7) NOT NULL,
    from_category_id INT NOT NULL,
    to_category_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    note VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_category_id) REFERENCES categories(id),
    FOREIGN KEY (to_category_id) REFERENCES categories(id)
  )`,

  `INSERT IGNORE INTO categories (name, type, icon, color, is_default) VALUES ('Savings', 'expense', '🐷', '#2F6F4E', 1)`,
  `INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('base_currency', 'INR')`,
  `INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('last_auto_backup_at', '')`,
  `INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('theme', 'dark')`,

  // ── Universal Ledger: Routine & Schedule tables ──

  `CREATE TABLE IF NOT EXISTS routine_activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(20) DEFAULT '📌',
    color VARCHAR(20) DEFAULT '#5B7FBA',
    default_hours DECIMAL(4,1) NOT NULL DEFAULT 1.0,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS routine_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day_of_week TINYINT NOT NULL,
    activity_id INT NOT NULL,
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    notes VARCHAR(255) DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (activity_id) REFERENCES routine_activities(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS routine_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    log_date DATE NOT NULL,
    activity_id INT NOT NULL,
    hours DECIMAL(4,2) NOT NULL DEFAULT 0,
    notes VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_date_activity (log_date, activity_id),
    FOREIGN KEY (activity_id) REFERENCES routine_activities(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    role VARCHAR(200) DEFAULT '',
    type VARCHAR(32) NOT NULL DEFAULT 'job',
    status ENUM('planning','applied','interview','offer','rejected','cleared') NOT NULL DEFAULT 'planning',
    deadline DATE DEFAULT NULL,
    url VARCHAR(500) DEFAULT '',
    notes TEXT,
    priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // Seed routine activities (INSERT IGNORE so existing data is never touched)
  `INSERT IGNORE INTO routine_activities (id, name, icon, color, default_hours, sort_order) VALUES
    (1,  'Sleep',           '😴', '#5B6BAA', 7.0,  1),
    (2,  'Gym',             '🏋️', '#E07C4F', 1.5,  2),
    (3,  'Running',         '🏃', '#4FA97A', 1.0,  3),
    (4,  'Shower/Breakfast','🚿', '#8B8578', 0.5,  4),
    (5,  'DSA',             '🧩', '#C9852E', 1.0,  5),
    (6,  'Commute',         '🚌', '#7A6FB0', 1.5,  6),
    (7,  'Office/Work',     '💼', '#2F6F4E', 9.0,  7),
    (8,  'Dinner/Decompress','🍽️','#D97757', 0.5,  8),
    (9,  'Kubernetes',      '☸️', '#326CE5', 2.0,  9),
    (10, 'System Design',   '🏗️', '#B4791F', 2.0, 10),
    (11, 'IITM Study',      '📚', '#B3432B', 2.0, 11),
    (12, 'IITM Projects',   '🔬', '#E37A5D', 3.0, 12),
    (13, 'FOCP',            '💻', '#5B7FBA', 2.0, 13),
    (14, 'GCP',             '☁️', '#4285F4', 1.0, 14),
    (15, 'Netflix/Series',  '🎬', '#E50914', 1.0, 15),
    (16, 'Mobile Gaming',   '🎮', '#9B59B6', 0.5, 16),
    (17, 'Wind Down',       '🌙', '#6E7A8A', 0.5, 17),
    (18, 'Misc',            '📌', '#8B8578', 0.5, 18),
    (19, 'Weekly Review',   '📝', '#2F6F4E', 0.5, 19),
    (20, 'Catch-up Buffer', '🔄', '#C9852E', 2.0, 20)`,

  // Seed weekday routine template (Mon=0 .. Sun=6)
  // Monday
  `INSERT IGNORE INTO routine_templates (id, day_of_week, activity_id, start_time, end_time, notes, sort_order) VALUES
    (1,  0, 1,  '22:45','05:45','Sleep — 7 hours, non-negotiable', 1),
    (2,  0, 2,  '06:00','07:30','Gym — 90 min', 2),
    (3,  0, 4,  '07:30','08:00','Shower + breakfast', 3),
    (4,  0, 5,  '08:00','08:45','Morning DSA — hardest thing first', 4),
    (5,  0, 6,  '08:45','09:45','Commute to office', 5),
    (6,  0, 7,  '10:00','19:00','Office — AWS/Azure practice, GCP in slack time', 6),
    (7,  0, 6,  '19:00','19:50','Commute home', 7),
    (8,  0, 8,  '19:45','20:15','Dinner + decompress — no scrolling', 8),
    (9,  0, 9,  '20:15','22:15','Evening: Kubernetes — pods, deployments, services', 9),
    (10, 0, 17, '22:15','22:45','Wind down, no screens, glance at tomorrow', 10)`,

  // Tuesday
  `INSERT IGNORE INTO routine_templates (id, day_of_week, activity_id, start_time, end_time, notes, sort_order) VALUES
    (11, 1, 1,  '22:45','05:45','Sleep', 1),
    (12, 1, 2,  '06:00','07:30','Gym', 2),
    (13, 1, 4,  '07:30','08:00','Shower + breakfast', 3),
    (14, 1, 5,  '08:00','08:45','Morning DSA', 4),
    (15, 1, 6,  '08:45','09:45','Commute to office', 5),
    (16, 1, 7,  '10:00','19:00','Office', 6),
    (17, 1, 6,  '19:00','19:50','Commute home', 7),
    (18, 1, 8,  '19:45','20:15','Dinner + decompress', 8),
    (19, 1, 5,  '20:15','22:15','Evening: DSA deep dive', 9),
    (20, 1, 17, '22:15','22:45','Wind down', 10)`,

  // Wednesday
  `INSERT IGNORE INTO routine_templates (id, day_of_week, activity_id, start_time, end_time, notes, sort_order) VALUES
    (21, 2, 1,  '22:45','05:45','Sleep', 1),
    (22, 2, 2,  '06:00','07:30','Gym', 2),
    (23, 2, 4,  '07:30','08:00','Shower + breakfast', 3),
    (24, 2, 5,  '08:00','08:45','Morning DSA', 4),
    (25, 2, 6,  '08:45','09:45','Commute to office', 5),
    (26, 2, 7,  '10:00','19:00','Office', 6),
    (27, 2, 6,  '19:00','19:50','Commute home', 7),
    (28, 2, 8,  '19:45','20:15','Dinner + decompress', 8),
    (29, 2, 10, '20:15','22:15','Evening: System Design + GCP', 9),
    (30, 2, 17, '22:15','22:45','Wind down', 10)`,

  // Thursday
  `INSERT IGNORE INTO routine_templates (id, day_of_week, activity_id, start_time, end_time, notes, sort_order) VALUES
    (31, 3, 1,  '22:45','05:45','Sleep', 1),
    (32, 3, 2,  '06:00','07:30','Gym', 2),
    (33, 3, 4,  '07:30','08:00','Shower + breakfast', 3),
    (34, 3, 5,  '08:00','08:45','Morning DSA', 4),
    (35, 3, 6,  '08:45','09:45','Commute to office', 5),
    (36, 3, 7,  '10:00','19:00','Office', 6),
    (37, 3, 6,  '19:00','19:50','Commute home', 7),
    (38, 3, 8,  '19:45','20:15','Dinner + decompress', 8),
    (39, 3, 11, '20:15','22:15','Evening: IITM BS — exam material, not projects', 9),
    (40, 3, 17, '22:15','22:45','Wind down', 10)`,

  // Friday
  `INSERT IGNORE INTO routine_templates (id, day_of_week, activity_id, start_time, end_time, notes, sort_order) VALUES
    (41, 4, 1,  '22:45','05:45','Sleep', 1),
    (42, 4, 2,  '06:00','07:30','Gym', 2),
    (43, 4, 4,  '07:30','08:00','Shower + breakfast', 3),
    (44, 4, 5,  '08:00','08:45','Morning DSA', 4),
    (45, 4, 6,  '08:45','09:45','Commute to office', 5),
    (46, 4, 7,  '10:00','19:00','Office', 6),
    (47, 4, 6,  '19:00','19:50','Commute home', 7),
    (48, 4, 8,  '19:45','20:15','Dinner + decompress', 8),
    (49, 4, 13, '20:15','22:15','Evening: FOCP study material', 9),
    (50, 4, 17, '22:15','22:45','Wind down', 10)`,

  // Saturday (day_of_week = 5)
  `INSERT IGNORE INTO routine_templates (id, day_of_week, activity_id, start_time, end_time, notes, sort_order) VALUES
    (51, 5, 1,  '23:00','07:00','Sleep — slightly later wake on weekends', 1),
    (52, 5, 2,  '07:30','09:00','Gym or lighter session', 2),
    (53, 5, 4,  '09:00','09:30','Shower + breakfast', 3),
    (54, 5, 12, '09:30','12:30','IITM project + viva prep — 3h uninterrupted', 4),
    (55, 5, 8,  '12:30','13:30','Lunch + break', 5),
    (56, 5, 9,  '13:30','15:30','Kubernetes / System Design deep dive — 2h', 6),
    (57, 5, 18, '15:30','17:00','Free time / buffer', 7),
    (58, 5, 3,  '17:00','18:00','Run 5-10km', 8),
    (59, 5, 8,  '18:00','19:00','Dinner', 9),
    (60, 5, 18, '19:00','23:00','Evening free / rest', 10)`,

  // Sunday (day_of_week = 6)
  `INSERT IGNORE INTO routine_templates (id, day_of_week, activity_id, start_time, end_time, notes, sort_order) VALUES
    (61, 6, 1,  '23:00','07:00','Sleep', 1),
    (62, 6, 4,  '07:00','08:00','Morning routine + breakfast', 2),
    (63, 6, 13, '08:00','11:00','FOCP study/practice — 2-3h block', 3),
    (64, 6, 20, '11:00','13:00','Catch-up buffer — whatever slipped during the week, or extra DSA', 4),
    (65, 6, 8,  '13:00','14:00','Lunch + break', 5),
    (66, 6, 19, '14:00','14:30','Weekly review — what got done, what didnt, adjust next week', 6),
    (67, 6, 3,  '15:00','16:00','Run (alternate with Saturday)', 7),
    (68, 6, 18, '16:00','23:00','Genuine rest — no productivity guilt, protects the week', 8)`,

  // ==================== Diet & Health Ledger ====================
  // A "Gym" category for the Money Ledger did not exist before — adding it
  // additively (INSERT IGNORE, unique on name) is what makes §16/§17's
  // read-only gym-spending detection possible without touching existing
  // transactions or categories.
  `INSERT IGNORE INTO categories (name, type, icon, color, is_default) VALUES ('Gym', 'expense', '🏋️', '#B3432B', 1)`,

  // Singleton row (id=1) holding current, non-historical settings. Weight
  // and goals are NOT here — they live in health_measurements / diet_goals
  // as proper history, per the "no duplicate sources of truth" rule.
  `CREATE TABLE IF NOT EXISTS health_profile (
    id INT PRIMARY KEY DEFAULT 1,
    height_cm DECIMAL(5,1) DEFAULT NULL,
    birth_year INT DEFAULT NULL,
    sex ENUM('male','female','unspecified') DEFAULT 'unspecified',
    activity_level ENUM('sedentary','light','moderate','active','very_active') DEFAULT 'moderate',
    gym_status ENUM('not_started','starting_soon','active') DEFAULT 'not_started',
    training_days VARCHAR(50) DEFAULT '',
    training_goal VARCHAR(100) DEFAULT '',
    calorie_target_override INT DEFAULT NULL,
    protein_target_override INT DEFAULT NULL,
    carb_target_override INT DEFAULT NULL,
    fat_target_override INT DEFAULT NULL,
    fiber_target_override INT DEFAULT NULL,
    water_target_ml_override INT DEFAULT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `INSERT IGNORE INTO health_profile (id) VALUES (1)`,

  // Append-only: each row is a goal that was set at some point. "Current
  // goal" = latest row. Old goals are never overwritten (§6, §37).
  `CREATE TABLE IF NOT EXISTS diet_goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    goal_type ENUM('weight_gain','weight_loss','maintenance','muscle_gain','general_fitness','improved_nutrition','gym_prep','strength_training') NOT NULL,
    notes VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Uploaded report documents. The file itself lives on disk (like backups);
  // this just keeps the source traceable per §4/§39. Created before
  // health_measurements so its FK can be declared inline below.
  `CREATE TABLE IF NOT EXISTS health_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    report_date DATE DEFAULT NULL,
    notes VARCHAR(255) DEFAULT '',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Time-series for weight AND every lab/body marker. measurement_type is
  // free text on purpose so a future report's marker never needs a schema
  // change. source distinguishes what you typed vs what a report said.
  `CREATE TABLE IF NOT EXISTS health_measurements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    measurement_type VARCHAR(100) NOT NULL,
    value DECIMAL(10,3) NOT NULL,
    unit VARCHAR(30) DEFAULT '',
    reference_range VARCHAR(100) DEFAULT NULL,
    source ENUM('user_entered','health_report') NOT NULL DEFAULT 'user_entered',
    source_report_id INT DEFAULT NULL,
    measurement_date DATE NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes VARCHAR(255) DEFAULT '',
    FOREIGN KEY (source_report_id) REFERENCES health_reports(id) ON DELETE SET NULL
  )`,

  // Daily food log. data_source distinguishes what you confirmed vs what an
  // AI estimated from a natural-language description (§9).
  `CREATE TABLE IF NOT EXISTS food_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meal_type ENUM('breakfast','lunch','dinner','snack','drink','supplement','other') NOT NULL DEFAULT 'other',
    description VARCHAR(255) NOT NULL,
    calories DECIMAL(7,1) DEFAULT NULL,
    protein_g DECIMAL(6,1) DEFAULT NULL,
    carbs_g DECIMAL(6,1) DEFAULT NULL,
    fat_g DECIMAL(6,1) DEFAULT NULL,
    fiber_g DECIMAL(6,1) DEFAULT NULL,
    serving_note VARCHAR(150) DEFAULT '',
    data_source ENUM('user_confirmed','ai_estimated') NOT NULL DEFAULT 'user_confirmed',
    entry_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS water_intake_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entry_date DATE NOT NULL,
    amount_ml INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Read-only reference to a Money transaction + this ledger's own
  // classification of what it was for. Never writes to `transactions`.
  `CREATE TABLE IF NOT EXISTS gym_purchase_classifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT NOT NULL,
    purchase_type ENUM('protein','supplement','membership','equipment','clothing','food','other') NOT NULL,
    amount_allocated DECIMAL(12,2) NOT NULL,
    notes VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
  )`,

  // ==================== AI Analyzer ====================
  // Singleton holding which provider is active and its key. Keys are only
  // ever read server-side to call the provider — never returned to the
  // frontend in full (masked), never logged.
  `CREATE TABLE IF NOT EXISTS ai_settings (
    id INT PRIMARY KEY DEFAULT 1,
    active_provider ENUM('anthropic','openai','gemini') DEFAULT NULL,
    anthropic_api_key VARCHAR(255) DEFAULT NULL,
    anthropic_model VARCHAR(100) DEFAULT 'claude-sonnet-4-5-20250929',
    openai_api_key VARCHAR(255) DEFAULT NULL,
    openai_model VARCHAR(100) DEFAULT 'gpt-4o-mini',
    gemini_api_key VARCHAR(255) DEFAULT NULL,
    gemini_model VARCHAR(100) DEFAULT 'gemini-2.0-flash',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `INSERT IGNORE INTO ai_settings (id) VALUES (1)`,

  // Generated insights/predictions/suggestions are logged (not silently
  // regenerated on every render, per §36) so their history is inspectable.
  `CREATE TABLE IF NOT EXISTS ai_insights (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kind ENUM('daily_analysis','weekly_insight','prediction','suggestion') NOT NULL,
    context_date DATE NOT NULL,
    content TEXT NOT NULL,
    provider_used VARCHAR(30) DEFAULT NULL,
    model_used VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role ENUM('user','assistant') NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Update default Gemini model to gemini-3.5-flash for reliability and free-tier compatibility
  `UPDATE ai_settings SET gemini_model = 'gemini-3.5-flash' WHERE id = 1 AND (gemini_model = 'gemini-2.0-flash' OR gemini_model = 'gemini-1.5-flash' OR gemini_model IS NULL)`,

  // Remove any legacy food estimation prompts from conversational chat history
  `DELETE FROM ai_chat_messages WHERE content LIKE '%Estimate nutrition for this food%' OR content LIKE '{"calories"%'`,

  // ==================== Modernization: updated_at timestamps ====================
  // These use IF NOT EXISTS so they're safe to re-run on existing databases.
  `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE budgets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE savings_contributions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE loans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE loan_payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE bill_reminders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE budget_transfers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE food_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE water_intake_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE health_measurements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  `ALTER TABLE routine_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,

  // ==================== Phase Update: DSA + MAD2 + Aptitude Routine ====================
  // Add new activities for MAD2 and Aptitude (INSERT IGNORE ensures idempotency)
  `INSERT IGNORE INTO routine_activities (id, name, icon, color, default_hours, sort_order) VALUES
    (21, 'MAD2 Project', '🌐', '#E37A5D', 2.0, 21),
    (22, 'Aptitude',     '📐', '#B4791F', 1.5, 22)`,

  // Clear old routine templates and insert the new Bhopal Routine (DSA+MAD2+Aptitude phase)
  // Using DELETE + INSERT instead of UPDATE since template IDs may not match
  `DELETE FROM routine_templates WHERE id BETWEEN 1 AND 68`,

  // Monday (day 0): Evening = DSA video + code along
  `INSERT IGNORE INTO routine_templates (id, day_of_week, activity_id, start_time, end_time, notes, sort_order) VALUES
    (101, 0, 1,  '22:45','05:45','Sleep — 7 hours, non-negotiable', 1),
    (102, 0, 2,  '06:00','07:30','Gym — 90 min', 2),
    (103, 0, 4,  '07:30','08:00','Shower + breakfast', 3),
    (104, 0, 5,  '08:00','08:45','Morning DSA (book) — hardest thing first', 4),
    (105, 0, 6,  '08:45','09:45','Commute to office', 5),
    (106, 0, 7,  '10:00','19:00','Office — AWS/Azure practice, GCP in slack time', 6),
    (107, 0, 6,  '19:00','19:50','Commute home', 7),
    (108, 0, 8,  '19:45','20:15','Dinner + decompress — no scrolling', 8),
    (109, 0, 5,  '20:15','22:15','DSA — video, code along (continue PDSA sequence)', 9),
    (110, 0, 17, '22:15','22:45','Wind down, no screens, glance at tomorrow', 10)`,

  // Tuesday (day 1): Evening = DSA practice only, no new video
  `INSERT IGNORE INTO routine_templates (id, day_of_week, activity_id, start_time, end_time, notes, sort_order) VALUES
    (111, 1, 1,  '22:45','05:45','Sleep', 1),
    (112, 1, 2,  '06:00','07:30','Gym', 2),
    (113, 1, 4,  '07:30','08:00','Shower + breakfast', 3),
    (114, 1, 5,  '08:00','08:45','Morning DSA (book)', 4),
    (115, 1, 6,  '08:45','09:45','Commute to office', 5),
    (116, 1, 7,  '10:00','19:00','Office', 6),
    (117, 1, 6,  '19:00','19:50','Commute home', 7),
    (118, 1, 8,  '19:45','20:15','Dinner + decompress', 8),
    (119, 1, 5,  '20:15','22:15','DSA — practice only, re-code 2-3 problems from Mon (no peeking)', 9),
    (120, 1, 17, '22:15','22:45','Wind down', 10)`,

  // Wednesday (day 2): Evening = DSA video + code along
  `INSERT IGNORE INTO routine_templates (id, day_of_week, activity_id, start_time, end_time, notes, sort_order) VALUES
    (121, 2, 1,  '22:45','05:45','Sleep', 1),
    (122, 2, 2,  '06:00','07:30','Gym', 2),
    (123, 2, 4,  '07:30','08:00','Shower + breakfast', 3),
    (124, 2, 5,  '08:00','08:45','Morning DSA (book)', 4),
    (125, 2, 6,  '08:45','09:45','Commute to office', 5),
    (126, 2, 7,  '10:00','19:00','Office', 6),
    (127, 2, 6,  '19:00','19:50','Commute home', 7),
    (128, 2, 8,  '19:45','20:15','Dinner + decompress', 8),
    (129, 2, 5,  '20:15','22:15','DSA — video, code along (continue Phase sequence)', 9),
    (130, 2, 17, '22:15','22:45','Wind down', 10)`,

  // Thursday (day 3): Evening = MAD2 video + build
  `INSERT IGNORE INTO routine_templates (id, day_of_week, activity_id, start_time, end_time, notes, sort_order) VALUES
    (131, 3, 1,  '22:45','05:45','Sleep', 1),
    (132, 3, 2,  '06:00','07:30','Gym', 2),
    (133, 3, 4,  '07:30','08:00','Shower + breakfast', 3),
    (134, 3, 5,  '08:00','08:45','Morning DSA (book)', 4),
    (135, 3, 6,  '08:45','09:45','Commute to office', 5),
    (136, 3, 7,  '10:00','19:00','Office', 6),
    (137, 3, 6,  '19:00','19:50','Commute home', 7),
    (138, 3, 8,  '19:45','20:15','Dinner + decompress', 8),
    (139, 3, 21, '20:15','22:15','MAD2 — Flask/Vue tutorials + hands-on building', 9),
    (140, 3, 17, '22:15','22:45','Wind down', 10)`,

  // Friday (day 4): Evening = DSA practice + catch-up
  `INSERT IGNORE INTO routine_templates (id, day_of_week, activity_id, start_time, end_time, notes, sort_order) VALUES
    (141, 4, 1,  '22:45','05:45','Sleep', 1),
    (142, 4, 2,  '06:00','07:30','Gym', 2),
    (143, 4, 4,  '07:30','08:00','Shower + breakfast', 3),
    (144, 4, 5,  '08:00','08:45','Morning DSA (book)', 4),
    (145, 4, 6,  '08:45','09:45','Commute to office', 5),
    (146, 4, 7,  '10:00','19:00','Office', 6),
    (147, 4, 6,  '19:00','19:50','Commute home', 7),
    (148, 4, 8,  '19:45','20:15','Dinner + decompress', 8),
    (149, 4, 5,  '20:15','22:15','DSA — practice + catch-up (whatever slipped this week)', 9),
    (150, 4, 17, '22:15','22:45','Wind down', 10)`,

  // Saturday (day 5): MAD2 building + Aptitude + Run
  `INSERT IGNORE INTO routine_templates (id, day_of_week, activity_id, start_time, end_time, notes, sort_order) VALUES
    (151, 5, 1,  '23:00','07:00','Sleep — slightly later wake', 1),
    (152, 5, 2,  '07:30','09:00','Gym or lighter session', 2),
    (153, 5, 4,  '09:00','09:30','Shower + breakfast', 3),
    (154, 5, 21, '09:30','12:30','MAD2 building — continue bootcamp, build the project', 4),
    (155, 5, 8,  '12:30','13:30','Lunch + break', 5),
    (156, 5, 22, '13:30','15:30','Aptitude — highest-ROI chapters first', 6),
    (157, 5, 18, '15:30','17:00','Free time / buffer', 7),
    (158, 5, 3,  '17:00','18:00','Run 5-10km', 8),
    (159, 5, 8,  '18:00','19:00','Dinner', 9),
    (160, 5, 18, '19:00','23:00','Evening rest', 10)`,

  // Sunday (day 6): Aptitude + DSA catch-up + Weekly review + Rest
  `INSERT IGNORE INTO routine_templates (id, day_of_week, activity_id, start_time, end_time, notes, sort_order) VALUES
    (161, 6, 1,  '23:00','07:00','Sleep', 1),
    (162, 6, 4,  '07:00','08:00','Morning routine + breakfast', 2),
    (163, 6, 22, '08:00','10:00','Aptitude continued', 3),
    (164, 6, 5,  '10:00','12:00','DSA catch-up buffer — whatever slipped, or extra practice', 4),
    (165, 6, 8,  '12:00','13:00','Lunch + break', 5),
    (166, 6, 19, '13:00','13:30','Weekly review — check progress tracker honestly, adjust next week', 6),
    (167, 6, 3,  '15:00','16:00','Run (alternate with Saturday)', 7),
    (168, 6, 18, '16:00','23:00','Genuine rest — no productivity guilt, protects the week', 8)`,

  // ==================== Diet Plan based on Blood Report ====================
  `CREATE TABLE IF NOT EXISTS diet_plan_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL DEFAULT 'current',
    meal_slot VARCHAR(50) NOT NULL,
    meal_time VARCHAR(20) DEFAULT '',
    foods TEXT NOT NULL,
    purpose VARCHAR(255) DEFAULT '',
    targets_deficiency VARCHAR(255) DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS health_report_markers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    marker_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    value DECIMAL(10,3) NOT NULL,
    unit VARCHAR(30) DEFAULT '',
    reference_low DECIMAL(10,3) DEFAULT NULL,
    reference_high DECIMAL(10,3) DEFAULT NULL,
    status ENUM('normal','low','high','critical_low','critical_high') NOT NULL DEFAULT 'normal',
    dietary_action TEXT DEFAULT NULL,
    report_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Seed health markers from blood report (04 Jun 2026)
  `INSERT IGNORE INTO health_report_markers (id, marker_name, category, value, unit, reference_low, reference_high, status, dietary_action, report_date) VALUES
    (1,  'Vitamin D',         'vitamin',    11.6,   'ng/mL',  30,    100,   'critical_low', 'Supplement 60,000 IU/week for 8 weeks (doctor prescribed). 15-20 min morning sun. 2 eggs daily. Fortified milk.', '2026-06-04'),
    (2,  'Uric Acid',         'renal',      8.9,    'mg/dL',  4.2,   7.3,   'high',         'AVOID rajma/kidney beans. Reduce mushrooms, limit dal to 1 serving/day. Increase water to 3.5-4L. Add lemon water. Avoid organ meats.', '2026-06-04'),
    (3,  'SGOT (AST)',        'liver',      88.82,  'U/L',    0,     35,    'critical_high','Likely gym-related muscle damage. Reduce whey to 1 scoop/day max. Avoid alcohol completely. Add green tea, amla juice. Retest in 4-6 weeks.', '2026-06-04'),
    (4,  'SGPT (ALT)',        'liver',      45.64,  'U/L',    0,     45,    'high',         'Borderline elevated. Monitor with SGOT. Add liver-friendly foods: turmeric, garlic, leafy greens.', '2026-06-04'),
    (5,  'HDL Cholesterol',   'lipid',      34,     'mg/dL',  40,    60,    'low',          'Add healthy fats: flaxseed (1 tsp/day), walnuts (3-4 daily), olive oil on salad. Consider fish oil capsule.', '2026-06-04'),
    (6,  'Calcium',           'renal',      8.28,   'mg/dL',  8.8,   10.6,  'low',          'Linked to Vitamin D deficiency. Curd/dahi daily, sesame seeds (til), ragi, paneer, fortified milk.', '2026-06-04'),
    (7,  'Hemoglobin',        'blood',      14,     'g/dL',   13,    17,    'normal',       NULL, '2026-06-04'),
    (8,  'Iron',              'blood',      80,     'µg/dL',  65,    175,   'normal',       NULL, '2026-06-04'),
    (9,  'Vitamin B12',       'vitamin',    227,    'pg/mL',  197,   771,   'normal',       'Low-normal range. Maintain with eggs, milk, curd.', '2026-06-04'),
    (10, 'Testosterone',      'hormone',    924,    'ng/dL',  164.94,753.38,'high',         'Above range but beneficial for muscle gain at gym. Monitor if symptoms appear. High protein diet supports this.', '2026-06-04'),
    (11, 'Total Cholesterol',  'lipid',     103,    'mg/dL',  0,     200,   'normal',       NULL, '2026-06-04'),
    (12, 'LDL Cholesterol',   'lipid',      59,     'mg/dL',  0,     100,   'normal',       NULL, '2026-06-04'),
    (13, 'Triglycerides',     'lipid',      35,     'mg/dL',  0,     150,   'normal',       NULL, '2026-06-04'),
    (14, 'HbA1c',             'diabetes',   5,      '%',      0,     5.7,   'normal',       NULL, '2026-06-04'),
    (15, 'TSH',               'thyroid',    1.43,   'µIU/mL', 0.54,  5.30,  'normal',       NULL, '2026-06-04'),
    (16, 'eGFR',              'renal',      125,    'mL/min', 90,    999,   'normal',       NULL, '2026-06-04'),
    (17, 'RDW-CV',            'blood',      14.4,   '%',      11.6,  14,    'high',         'Slightly elevated. May indicate early iron deficiency or B12 variation. Monitor.', '2026-06-04'),
    (18, 'Basophils Abs',     'blood',      0.01,   'X10³/µL',0.02, 0.1,   'low',          'Marginally below range. Usually not clinically significant. No dietary action needed.', '2026-06-04')`,

  // Seed diet plan items based on health report analysis
  `INSERT IGNORE INTO diet_plan_items (id, plan_name, meal_slot, meal_time, foods, purpose, targets_deficiency, sort_order) VALUES
    (1,  'current', 'Pre-gym',         '05:50', 'Soaked almonds (5-6) + 1 banana',                                                        'Light energy, magnesium for workout',           'calcium,vitamin_d',         1),
    (2,  'current', 'Post-gym Shake',  '07:30', 'Whey protein (1 scoop only) + milk + 1 tsp flaxseed',                                    'Protein recovery + omega-3 for HDL',             'hdl,liver',                 2),
    (3,  'current', 'Breakfast',       '07:45', 'Oats + milk + kaddu seeds + watermelon + 2 boiled eggs',                                  'Carbs + protein + Vit D from eggs + hydration',  'vitamin_d,calcium,protein', 3),
    (4,  'current', 'Mid-morning',     '10:30', 'Soaked chana + peanuts + amla (1 piece)',                                                 'Protein + fiber + Vit C for iron absorption',     'b12,iron',                  4),
    (5,  'current', 'Lunch',           '13:00', '2 roti + dal (moong/toor, NOT rajma) + paneer sabzi (palak/methi) + curd + salad w/ lemon','Balanced meal + calcium from curd + iron from greens','uric_acid,calcium,hdl',  5),
    (6,  'current', 'Evening snack',   '17:30', 'Green tea + 3-4 walnuts + seasonal fruit (apple/guava)',                                  'Antioxidants + HDL boost + liver support',        'hdl,liver',                 6),
    (7,  'current', 'Pre-study snack', '19:45', 'Masala Safola Oats OR sprouts chaat with lemon',                                          'Light fuel for study block',                      'general',                   7),
    (8,  'current', 'Dinner',          '20:00', 'Eggs (2) or paneer + 1 roti + sabzi (lauki/tinda/parval) — keep light',                   'Easy to digest, liver-friendly, not heavy before study','liver,vitamin_d',     8),
    (9,  'current', 'Before bed',      '22:15', 'Warm turmeric milk (haldi doodh) with a pinch of black pepper',                           'Anti-inflammatory + calcium + sleep quality',     'calcium,liver',             9),
    (10, 'current', 'All day',         '',      'Water 3.5-4 litres consistently (NOT big infrequent gulps) + 1 glass lemon water',         'Hydration + flush uric acid + kidney health',     'uric_acid,general',         10)`,

  // ==================== Job Hunt Ledger ====================
  // Your eligibility & preference profile (singleton row)
  `CREATE TABLE IF NOT EXISTS jobhunt_profile (
    id INT PRIMARY KEY DEFAULT 1,
    full_name VARCHAR(200) DEFAULT '',
    degree VARCHAR(200) DEFAULT '',
    branch VARCHAR(200) DEFAULT '',
    graduation_year INT DEFAULT NULL,
    experience_years DECIMAL(3,1) DEFAULT 0,
    age INT DEFAULT NULL,
    skills TEXT DEFAULT '',
    certifications TEXT DEFAULT '',
    pref_min_ctc DECIMAL(12,2) DEFAULT NULL,
    pref_locations TEXT DEFAULT '',
    pref_job_types TEXT DEFAULT '',
    pref_sectors TEXT DEFAULT '',
    pref_remote_ok TINYINT(1) DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `INSERT IGNORE INTO jobhunt_profile (id, degree, branch, skills, pref_sectors, pref_job_types) VALUES (
    1,
    'B.Sc Data Science (IIT Madras)',
    'Computer Science / Data Science',
    '["Python","JavaScript","Docker","Kubernetes","AWS","GCP","Azure","Node.js","React","Linux","Git","DSA","System Design"]',
    '["IT","Defence","Cloud","DevOps","Research","PSU"]',
    '["govt","psu","defence","private","research"]'
  )`,

  // Organization Registry — the source of truth for where opportunities come from
  `CREATE TABLE IF NOT EXISTS jobhunt_organizations (
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // Discovered opportunities (manual or future-automated)
  `CREATE TABLE IF NOT EXISTS jobhunt_opportunities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT DEFAULT NULL,
    title VARCHAR(500) NOT NULL,
    source_url VARCHAR(500) DEFAULT '',
    source_type ENUM('careers_page','pdf','portal','employment_news','manual','other') DEFAULT 'manual',
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
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // Change detection hashes — for future automated crawling
  `CREATE TABLE IF NOT EXISTS jobhunt_content_hashes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    title_hint VARCHAR(300) DEFAULT '',
    source_url VARCHAR(500) DEFAULT '',
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_org_hash (org_id, content_hash)
  )`,

  // ── Multi-Education, Work History, Projects & Publications Support ──
  `ALTER TABLE jobhunt_profile ADD COLUMN IF NOT EXISTS phone VARCHAR(50) DEFAULT ''`,
  `ALTER TABLE jobhunt_profile ADD COLUMN IF NOT EXISTS email VARCHAR(200) DEFAULT ''`,
  `ALTER TABLE jobhunt_profile ADD COLUMN IF NOT EXISTS linkedin VARCHAR(255) DEFAULT ''`,
  `ALTER TABLE jobhunt_profile ADD COLUMN IF NOT EXISTS github VARCHAR(255) DEFAULT ''`,
  `ALTER TABLE jobhunt_profile ADD COLUMN IF NOT EXISTS summary TEXT DEFAULT ''`,
  `ALTER TABLE jobhunt_profile ADD COLUMN IF NOT EXISTS education TEXT DEFAULT ''`,
  `ALTER TABLE jobhunt_profile ADD COLUMN IF NOT EXISTS experience TEXT DEFAULT ''`,
  `ALTER TABLE jobhunt_profile ADD COLUMN IF NOT EXISTS projects TEXT DEFAULT ''`,
  `ALTER TABLE jobhunt_profile ADD COLUMN IF NOT EXISTS publications TEXT DEFAULT ''`,
  `ALTER TABLE jobhunt_profile ADD COLUMN IF NOT EXISTS achievements TEXT DEFAULT ''`,

  // Seed Reshav Sharma's full profile from resume
  `UPDATE jobhunt_profile SET
    full_name = 'Reshav Sharma',
    phone = '8839750668',
    email = 'reshav2004b@gmail.com',
    linkedin = 'https://linkedin.com/in/reshav-sharma-844320173',
    github = 'https://github.com/reshav09',
    summary = 'Cloud/DevOps Engineer with hands-on production experience across AWS, Azure, and GCP. Currently driving multi-cloud FinOps and cost-optimization work delivering approximately $180K in annualized client savings; previously automated infrastructure and resolved live production incidents for government ERP systems serving 141 municipalities. Strong foundation in Python, Bash, Infrastructure-as-Code, and cloud cost management.',
    degree = 'B.Tech CSE (SIRT) & BS Data Science (IIT Madras)',
    branch = 'Computer Science / Data Science',
    graduation_year = 2026,
    experience_years = 1.5,
    age = 22,
    education = '[{\"institution\":\"Sagar Institute of Research and Technology\",\"degree\":\"B.Tech\",\"branch\":\"Computer Science and Engineering\",\"cgpa\":\"8.19\",\"period\":\"Aug 2022 – Jul 2026\",\"location\":\"Bhopal, Madhya Pradesh\",\"status\":\"In Progress\"},{\"institution\":\"Indian Institute of Technology, Madras\",\"degree\":\"BS\",\"branch\":\"Data Science and Applications\",\"cgpa\":\"\",\"period\":\"Aug 2023 – Expected 2027\",\"location\":\"Chennai, Tamil Nadu\",\"status\":\"In Progress\"}]',
    experience = '[{\"company\":\"FinOps Engineer\",\"role\":\"FinOps Engineer\",\"location\":\"Noida, India\",\"period\":\"Feb 2026 – Present\",\"highlights\":[\"Perform cloud cost optimization and wastage-tracking analysis across 6 client accounts spanning AWS, Azure, and GCP, identifying and implementing an aggregate ~$15,000/month (~$180K annualized) in verified savings.\",\"Delivered the two largest single-account reductions — $5,400/month and $5,000/month — through infrastructure rightsizing and elimination of idle/underutilized resources.\",\"Support ongoing FinOps decision-making with recurring cost-visibility reporting across a multi-cloud environment.\"]},{\"company\":\"Netlink Software Group America Inc\",\"role\":\"DevOps Intern — MP Government ENP2.0 e-Nagar Palika Project\",\"location\":\"Bhopal, Madhya Pradesh\",\"period\":\"Dec 2024 – Jul 2025\",\"highlights\":[\"Automated server health monitoring and resource reporting for ERP servers across 141 municipalities, reducing manual analysis time by 80%; presented key metrics to the Deputy Commissioner (UADD).\",\"Built access control and onboarding automation scripts in ERPNext, decreasing ERP rollout time by 50%.\",\"Diagnosed critical production login failures using trace logs, enabling a 24-hour fix and preventing service downtime.\",\"Contributed to compliance automation integrating Aadhaar & Samagra APIs within government cloud systems.\",\"Deployed on containerized services like Docker and Kubernetes; automated server monitoring and integrated with Prometheus and Grafana for system observability.\"]}]',
    projects = '[{\"title\":\"Automated Data Pipeline & Analysis Platform\",\"tech_stack\":\"Python, FastAPI, Gemini LLM, Docker\",\"link\":\"https://github.com/reshav09/TDS-Project-2-May-2025\",\"description\":\"Built automated data ingestion and processing pipelines to extract, clean, and structure heterogeneous datasets. Designed fault-tolerant execution logic with retry mechanisms to maintain reliability during large-scale data processing.\"},{\"title\":\"Virtual Tutor for TDS Course\",\"tech_stack\":\"Flask, RAG, OpenAI, Docker, YAML\",\"link\":\"\",\"description\":\"Engineered a low-latency, Dockerized Flask API for real-time academic Q&A using Retrieval-Augmented Generation (RAG). Designed end-to-end pipeline with structured data indexing, OpenAI integration, and automated YAML testing.\"},{\"title\":\"Plant Disease Prediction System\",\"tech_stack\":\"Python, Custom CNNs, ResNet50, TensorFlow, scikit-learn\",\"link\":\"\",\"description\":\"Designed end-to-end modeling pipelines including data preprocessing, feature normalization, and train–validation evaluation protocols. Analyzed model behavior using confusion matrices and feature-level visualizations.\"},{\"title\":\"Real Estate Price Prediction\",\"tech_stack\":\"Flask, XGBoost, MP Gov Data 2018–2024\",\"link\":\"\",\"description\":\"Developed regression and ensemble models to predict asset prices using multi-year structured government datasets, improving predictive accuracy by 25%.\"} ]',
    publications = '[{\"title\":\"Solving Transportation Problem Using Python\",\"authors\":\"Prof. Sarla Raigar, Reshav Sharma\",\"venue\":\"International Research Journal of Modernization in Engineering Technology and Science (IRJMETS)\",\"year\":\"May 2025\",\"description\":\"Formulated balanced transportation problems using linear programming constraints and matrix representations. Designed and implemented multiple solution algorithms (NWCM, LCM, Supply–Demand methods) in Python.\"},{\"title\":\"SR Method for Balanced and Unbalanced Assignment Problems\",\"authors\":\"Reshav Sharma\",\"venue\":\"Publication in Process (Under Review)\",\"year\":\"2025\",\"description\":\"Proposed a novel algorithm for solving balanced and unbalanced assignment problems as a special case of transportation models. Developed mathematical formulations and benchmarked performance against the Hungarian Method.\"},{\"title\":\"Use of Mathematics in Real-World Research\",\"authors\":\"Reshav Sharma\",\"venue\":\"Government of India Copyright Registered\",\"year\":\"Sep 2024\",\"description\":\"Explored mathematical influence from ancient civilizations to modern industry use-cases and computing.\"} ]',
    achievements = '[{\"title\":\"Best Student Research Award\",\"organization\":\"IEEE International Conference\",\"year\":\"Sep 2024\",\"description\":\"Ranked in top 1% of student research papers at IEEE International Conference.\"},{\"title\":\"Star Student (2025–2026)\",\"organization\":\"Sagar Institute of Research and Technology\",\"year\":\"2025–2026\",\"description\":\"Recognized as Student of the Year for academic and leadership excellence.\"},{\"title\":\"Leadership Award\",\"organization\":\"John Snow Inc True Sage Foundation EduKiran Project\",\"year\":\"Aug 2023\",\"description\":\"Recognized for leading education initiatives benefiting underserved communities.\"},{\"title\":\"Coordinator — Educational Outreach\",\"organization\":\"John Snow India Pvt. Ltd. (JSIPL)\",\"year\":\"Jan 2024 – May 2024\",\"description\":\"Led 50+ volunteers, improving student English proficiency scores by ~30% and implemented Google Read Along.\"},{\"title\":\"Discipline Committee Head & CII YI Yuva Co-Chair\",\"organization\":\"CII Yuva & SIRT\",\"year\":\"2024–2025\",\"description\":\"Directed discipline and logistics for 15+ campus events (1,000+ attendees); led 12 teams under CII Yuva.\"} ]',
    skills = \'["Python","Bash","SQL","C++","JavaScript","AWS","Azure","GCP","FinOps","Cloud Cost Optimization","Cost Reporting","Docker","Kubernetes","Linux","Git","Prometheus","Grafana","FastAPI","Streamlit","ERPNext","Frappe","Machine Learning","DSA","System Design","Computer Networking","Observability","CI/CD"]\',
    certifications = \'["Azure AZ-900 Series","GCP Workshop","IEEE Best Student Research Award","Govt of India Copyright Registered","Star Student 2025-2026"]\',
    pref_locations = \'["Noida","Bhopal","Bangalore","Pune","Delhi NCR","Hyderabad","Chennai","Remote"]\',
    pref_sectors = \'["Cloud","FinOps","DevOps","IT","Defence","Research","PSU"]\',
    pref_job_types = \'["private","psu","govt","research","defence"]\',
    pref_min_ctc = 1200000.00
   WHERE id = 1`,

  // Extend source_type in jobhunt_opportunities to VARCHAR(50)
  `ALTER TABLE jobhunt_opportunities MODIFY COLUMN source_type VARCHAR(50) DEFAULT 'manual'`,

  // Phase 4: Track applications from opportunities
  `ALTER TABLE applications ADD COLUMN IF NOT EXISTS opportunity_id INT DEFAULT NULL`,
  `ALTER TABLE applications ADD INDEX IF NOT EXISTS idx_app_opp (opportunity_id)`,
  `ALTER TABLE jobhunt_opportunities ADD COLUMN IF NOT EXISTS is_applied TINYINT(1) DEFAULT 0`,
  `ALTER TABLE jobhunt_opportunities ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP NULL DEFAULT NULL`,

  // Phase 5: Category Hubs & Private Companies (India >=20LPA, EU/SG Visa >=$100k)
  `ALTER TABLE jobhunt_organizations ADD COLUMN IF NOT EXISTS category_group VARCHAR(50) NOT NULL DEFAULT 'psu'`,
  `ALTER TABLE jobhunt_organizations ADD COLUMN IF NOT EXISTS country VARCHAR(100) NOT NULL DEFAULT 'India'`,
  `ALTER TABLE jobhunt_organizations ADD COLUMN IF NOT EXISTS region VARCHAR(100) NOT NULL DEFAULT 'India'`,
  `ALTER TABLE jobhunt_organizations ADD COLUMN IF NOT EXISTS visa_sponsored TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE jobhunt_organizations ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'INR'`,
  `ALTER TABLE jobhunt_organizations ADD COLUMN IF NOT EXISTS min_ctc_threshold DECIMAL(12,2) DEFAULT NULL`,
  `ALTER TABLE jobhunt_opportunities ADD COLUMN IF NOT EXISTS category_group VARCHAR(50) NOT NULL DEFAULT 'psu'`,
  `ALTER TABLE jobhunt_opportunities ADD COLUMN IF NOT EXISTS country VARCHAR(100) NOT NULL DEFAULT 'India'`,
  `ALTER TABLE jobhunt_opportunities ADD COLUMN IF NOT EXISTS region VARCHAR(100) NOT NULL DEFAULT 'India'`,
  `ALTER TABLE jobhunt_opportunities ADD COLUMN IF NOT EXISTS visa_sponsored TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE jobhunt_opportunities ADD COLUMN IF NOT EXISTS compensation_display VARCHAR(100) NOT NULL DEFAULT ''`,
  // Phase 6: Job Posting Recency & Automated Expiration Rules
  `ALTER TABLE jobhunt_opportunities ADD COLUMN IF NOT EXISTS posted_date DATE NULL DEFAULT NULL`,
  `ALTER TABLE jobhunt_opportunities ADD INDEX IF NOT EXISTS idx_opp_posted_date (posted_date)`,
  `UPDATE jobhunt_opportunities SET posted_date = DATE(discovered_at) WHERE posted_date IS NULL`,

  // Phase 7: ATS Direct Ingestion, Confidence Chains, Ghost Job Prevention & Feedback Loop
  `ALTER TABLE jobhunt_organizations ADD COLUMN IF NOT EXISTS ats_type VARCHAR(32) NOT NULL DEFAULT 'custom_scrape'`,
  `ALTER TABLE jobhunt_organizations ADD COLUMN IF NOT EXISTS ats_id VARCHAR(128) NULL DEFAULT NULL`,
  `ALTER TABLE jobhunt_organizations ADD COLUMN IF NOT EXISTS last_crawl_status VARCHAR(64) NULL DEFAULT NULL`,
  `ALTER TABLE jobhunt_organizations ADD COLUMN IF NOT EXISTS last_jobs_found INT NOT NULL DEFAULT 0`,
  `ALTER TABLE jobhunt_organizations ADD COLUMN IF NOT EXISTS last_successful_pull TIMESTAMP NULL DEFAULT NULL`,

  `ALTER TABLE jobhunt_opportunities ADD COLUMN IF NOT EXISTS confidence_metadata JSON NULL DEFAULT NULL`,
  `ALTER TABLE jobhunt_opportunities ADD COLUMN IF NOT EXISTS is_active_link TINYINT(1) NOT NULL DEFAULT 1`,
  `ALTER TABLE jobhunt_opportunities ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP NULL DEFAULT NULL`,

  `ALTER TABLE applications ADD COLUMN IF NOT EXISTS scoring_features_snapshot JSON NULL DEFAULT NULL`,
  // Expand applications.type from ENUM to VARCHAR(32) to support internships, fellowships, and diverse pathways
  `ALTER TABLE applications MODIFY COLUMN type VARCHAR(32) NOT NULL DEFAULT 'job'`,

  // Phase 8: Career-Intelligence Automated Interview & Exam Preparation Hub
  `CREATE TABLE IF NOT EXISTS jobhunt_interview_prep (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NULL,
    org_name VARCHAR(255) NOT NULL,
    opportunity_id INT NULL,
    role_title VARCHAR(255) NOT NULL,
    role_category VARCHAR(50) NOT NULL DEFAULT 'sde',
    process_type VARCHAR(50) NOT NULL DEFAULT 'private_tech',
    total_stages INT NOT NULL DEFAULT 1,
    confidence ENUM('high', 'medium', 'based_on_notification', 'insufficient_data') NOT NULL DEFAULT 'medium',
    confidence_reason TEXT,
    stages LONGTEXT,
    exam_pattern LONGTEXT,
    prep_roadmap LONGTEXT,
    curated_resources LONGTEXT,
    sources LONGTEXT,
    user_notes TEXT,
    user_progress LONGTEXT,
    last_researched_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_prep_org (org_id),
    INDEX idx_prep_role (role_title),
    INDEX idx_prep_category (role_category),
    INDEX idx_prep_confidence (confidence)
  )`,

  `CREATE TABLE IF NOT EXISTS jobhunt_question_bank (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    company_tag VARCHAR(100) DEFAULT 'General',
    title VARCHAR(500) NOT NULL,
    difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
    topic VARCHAR(100) NOT NULL,
    url VARCHAR(500) DEFAULT NULL,
    question_text TEXT NOT NULL,
    answer_text LONGTEXT DEFAULT NULL,
    frequency_pct DECIMAL(5,2) DEFAULT NULL,
    source_repo VARCHAR(100) NOT NULL,
    is_solved TINYINT(1) DEFAULT 0,
    solved_at TIMESTAMP NULL DEFAULT NULL,
    user_notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_qb_category (category),
    INDEX idx_qb_company (company_tag),
    INDEX idx_qb_topic (topic),
    INDEX idx_qb_diff (difficulty)
  )`,

  // Phase 9: Dossier & AI Job Search Workflow Integration
  `CREATE TABLE IF NOT EXISTS jobhunt_evidence_claims (
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
  )`,

  `CREATE TABLE IF NOT EXISTS jobhunt_document_packages (
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
  )`,

  `CREATE TABLE IF NOT EXISTS jobhunt_document_reviews (
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
  )`,

  `CREATE TABLE IF NOT EXISTS jobhunt_application_events (
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
  )`,

  `CREATE TABLE IF NOT EXISTS jobhunt_mock_sessions (
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
  )`
];

const fs = require('fs');
const path = require('path');

async function ensureBaseSchema() {
  const initSqlPath = path.join(__dirname, 'init.sql');
  if (!fs.existsSync(initSqlPath)) return;

  const content = fs.readFileSync(initSqlPath, 'utf8');
  const statements = content
    .replace(/--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
    } catch (err) {
      if (!err.message.includes('already exists')) {
        // Silently skip or log non-fatal warnings
      }
    }
  }
}

async function runMigrations() {
  // Ensure base schema exists from init.sql for fresh clusters / environments
  await ensureBaseSchema();

  // Ensure schema_migrations table exists to track applied versions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      migration_hash VARCHAR(64) NOT NULL UNIQUE,
      statement_preview VARCHAR(120) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const crypto = require('crypto');
  let appliedCount = 0;

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const sql = MIGRATIONS[i].trim();
    if (!sql) continue;

    // Use normalized hash so formatting tweaks don't duplicate
    const hash = crypto.createHash('sha256').update(`v${i + 1}:${sql.replace(/\s+/g, ' ')}`).digest('hex');
    const [[existing]] = await pool.query('SELECT id FROM schema_migrations WHERE migration_hash = ? LIMIT 1', [hash]);

    if (!existing) {
      await pool.query(sql);
      const preview = sql.slice(0, 100).replace(/\s+/g, ' ');
      await pool.query(
        'INSERT INTO schema_migrations (migration_hash, statement_preview) VALUES (?, ?)',
        [hash, preview]
      );
      appliedCount++;
    }
  }

  if (appliedCount > 0) {
    console.log(`Successfully applied ${appliedCount} new database migration(s).`);
  } else {
    console.log('Database schema is up to date (no new migrations needed).');
  }

  // Ensure PSU & Premier Org registry is populated
  try {
    const [[{ orgCount }]] = await pool.query('SELECT COUNT(*) AS orgCount FROM jobhunt_organizations WHERE is_active = 1');
    if (orgCount < 10) {
      console.log('Seeding initial PSU & Govt R&D organizations registry...');
      const { seedOrganizations } = require('../scripts/seedPSUs');
      await seedOrganizations(pool);
    }
  } catch (err) {
    console.warn('Could not run initial PSU org seed:', err.message);
  }

  // Ensure high-CTC recruitment opportunities are populated only if table is empty
  try {
    const [[{ oppCount }]] = await pool.query('SELECT COUNT(*) AS oppCount FROM jobhunt_opportunities WHERE is_archived = 0');
    if (oppCount === 0) {
      console.log('Seeding initial high-CTC (>15 LPA) PSU opportunities...');
      const { seedOpportunities } = require('../scripts/seedOpportunities');
      await seedOpportunities(pool);
    }
  } catch (err) {
    console.warn('Could not run initial PSU opportunities seed:', err.message);
  }

  // Ensure tier list & user curated companies & verified opportunities are synced
  try {
    const { seedTierListCompanies } = require('../scripts/seedTierListCompanies');
    await seedTierListCompanies(pool);
  } catch (err) {
    console.warn('Could not run seedTierListCompanies:', err.message);
  }

  // Ensure verified ATS platform mappings are configured
  try {
    const { syncATSOrgs } = require('../scripts/syncATSOrgs');
    await syncATSOrgs(pool);
  } catch (err) {
    console.warn('Could not run syncATSOrgs:', err.message);
  }
}

async function runMigrationsWithRetry(retries = 15, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await runMigrations();
      return;
    } catch (err) {
      console.log(`Migration attempt ${attempt}/${retries} failed (${err.message}), retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  console.error('Could not apply migrations after retries — starting anyway.');
}

module.exports = { runMigrationsWithRetry, runMigrations };
