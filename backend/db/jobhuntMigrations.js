// Additive Job Hunt upgrades only. Never reorder historical MIGRATIONS.
module.exports = [
  `ALTER TABLE jobhunt_opportunities ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) NULL`,
  `ALTER TABLE jobhunt_opportunities ADD COLUMN IF NOT EXISTS identity_key CHAR(64) NULL`,
  `ALTER TABLE jobhunt_opportunities ADD UNIQUE INDEX idx_jh_identity (identity_key)`,
  `ALTER TABLE jobhunt_evidence_claims ADD COLUMN IF NOT EXISTS source_key CHAR(64) NULL`,
  `ALTER TABLE jobhunt_evidence_claims ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1`,
  `ALTER TABLE jobhunt_evidence_claims ADD UNIQUE INDEX idx_jh_evidence_key (source_key)`,
  `ALTER TABLE jobhunt_document_packages ADD COLUMN IF NOT EXISTS profile_snapshot LONGTEXT NULL`,
  `ALTER TABLE jobhunt_document_packages ADD COLUMN IF NOT EXISTS evidence_snapshot LONGTEXT NULL`,
  `ALTER TABLE jobhunt_document_packages ADD COLUMN IF NOT EXISTS root_package_id INT NULL`,
  `ALTER TABLE jobhunt_document_packages ADD COLUMN IF NOT EXISTS content_hash CHAR(64) NULL`,
  `ALTER TABLE jobhunt_document_packages ADD COLUMN IF NOT EXISTS generation_key VARCHAR(64) NULL`,
  `ALTER TABLE jobhunt_document_packages ADD COLUMN IF NOT EXISTS generation_method VARCHAR(32) NOT NULL DEFAULT 'template'`,
  `ALTER TABLE jobhunt_document_packages ADD COLUMN IF NOT EXISTS generation_metadata JSON NULL`,
  `ALTER TABLE jobhunt_document_packages ADD UNIQUE INDEX idx_jh_generation_key (generation_key)`,
  `ALTER TABLE jobhunt_document_reviews ADD COLUMN IF NOT EXISTS content_hash CHAR(64) NULL`,
  `CREATE TABLE IF NOT EXISTS jobhunt_generation_jobs (
    id CHAR(36) PRIMARY KEY, request_key VARCHAR(64) NOT NULL UNIQUE,
    opportunity_id INT NULL, payload_json LONGTEXT NOT NULL,
    status ENUM('queued','running','complete','failed','cancelled') NOT NULL DEFAULT 'queued',
    attempts INT NOT NULL DEFAULT 0, lease_token CHAR(36) NULL, lease_until DATETIME NULL,
    result_package_id INT NULL, error TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_jh_jobs_status (status, lease_until)
  )`,
  `CREATE TABLE IF NOT EXISTS jobhunt_document_artifacts (
    id INT AUTO_INCREMENT PRIMARY KEY, package_id INT NOT NULL,
    doc_type ENUM('resume','cover_letter') NOT NULL, mime_type VARCHAR(80) NOT NULL DEFAULT 'application/pdf',
    sha256 CHAR(64) NOT NULL, content LONGBLOB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_jh_artifact (package_id, doc_type)
  )`,
  `CREATE TABLE IF NOT EXISTS jobhunt_followup_reminders (
    application_id INT PRIMARY KEY, snoozed_until DATETIME NULL,
    dismissed TINYINT(1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`
];
