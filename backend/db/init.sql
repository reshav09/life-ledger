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
  type ENUM('job','exam','other') NOT NULL DEFAULT 'job',
  status ENUM('planning','applied','interview','offer','rejected','cleared') NOT NULL DEFAULT 'planning',
  deadline DATE DEFAULT NULL,
  url VARCHAR(500) DEFAULT '',
  notes TEXT,
  priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
