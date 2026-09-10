# 📒 Life Ledger — Universal Personal Operating System

> **A private, self-hosted, multi-ledger personal operating system for tracking your finances, nutrition, daily routines, health metrics, and applications — all running locally in Docker.**

[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MariaDB](https://img.shields.io/badge/MariaDB-003545?style=flat&logo=mariadb&logoColor=white)](https://mariadb.org/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

---

## 🌟 Overview

**Life Ledger** replaces fragmented apps, subscriptions, and disconnected spreadsheets with a unified, private dashboard. Built with a dark-first editorial aesthetic, it runs completely on your own machine using Docker and MariaDB. Nothing touches third-party clouds or external servers without your explicit setup.

---

## 🧭 Core Ledgers & Capabilities

### 💰 1. Money Ledger (Personal Finance & Wealth)
- **Multi-Account Tracking**: Real-time balances across bank accounts, cash, digital wallets, and custom asset accounts with multi-currency & FX support.
- **Granular Transaction Log**: Track expenses and income down to ₹1. Features instant search, category filtering, inline editing, batch selection/bulk-delete, and reusable quick-add templates.
- **Salary Cycle Analytics**: Log monthly salary credits and track net burn across true salary cycles rather than arbitrary calendar months.
- **Savings Goals & Surplus Allocation**: Define milestone goals and lock end-of-cycle unspent cash directly into goals or a protected Reserve Cap.
- **Envelopes & Budget Caps**: Monthly category budget ceilings with visual progress bars, over-budget warnings, and envelope-to-envelope money transfers.
- **Loans & EMI Debt Tracker**: Track loan principals, interest rates, tenure, and EMI payoff schedules linked directly to live balance transactions.
- **Affordability Planner**: Evaluate whether a future purchase is safe to buy (cash or EMI) while strictly protecting your emergency reserve buffer.
- **Net Worth & Analytics**: Interactive wealth progression graphs, spending heatmaps, category breakdowns, and one-click downloadable PDF monthly reports.
- **Privacy Mode**: Tap-to-reveal or master toggle to blur all account balances and transaction amounts when in public or shared spaces.

### 🍽️ 2. Food & Diet Ledger (Nutrition & Hydration)
- **Daily Meal Logging**: Log meals across breakfast, lunch, snacks, and dinner with automatic calculation of Calories, Protein, Carbohydrates, and Fats.
- **Macro Goals & Visual Progress**: Track daily macronutrient distribution against personalized targets.
- **Dedicated Water Intake Manager**:
  - 1-tap quick adds (`+250ml`, `+500ml`, `+1000ml`) or custom ml inputs.
  - Logged entry timeline with exact timestamps.
  - Granular control: delete individual test entries or reset all daily logs with one click.
- **Diet Spending Breakdown**: Tag and categorize grocery, dining out, and nutritional purchases to analyze how diet habits impact your wallet.
- **Calendar & Date Navigation**: Seamlessly review and edit yesterday's, today's, or historical logs without accidental page refreshes or state loss.

### 📋 3. Routine Ledger (Habits, Time & Schedule)
- **Activity Tracker**: Customize daily activities (Deep Work, Sleep, Exercise, Study, Commute) with custom icons, colors, and default target durations.
- **Weekly Routine Templates**: Build an ideal weekly schedule block-by-block.
- **Daily Time Logs**: Log actual hours spent per activity to analyze adherence and spot time leaks.
- **Consistency Insights**: Review streaks and visual distributions across productive vs. leisure hours.

### 🏥 4. Health Ledger (Vitals & Clinical Reports)
- **Biomarker & Measurement History**: Track body weight, blood pressure, fasting glucose, lipid profiles, and micronutrient levels over time.
- **Clinical Report Archiving**: Upload lab results, blood test PDFs, and prescription images directly into your self-hosted instance.
- **Data Association**: Link specific biomarker entries directly to their source medical report files.

### 💼 5. Applications Ledger (Career & Exam Pipeline)
- **Kanban / Pipeline Management**: Organize job applications, internships, and competitive exam registrations.
- **Stage Tracking**: `Planning` ➔ `Applied` ➔ `Interview` ➔ `Offer` ➔ `Cleared` / `Rejected`.
- **Key Details**: Deadlines, direct application URLs, priority levels, interview rounds, and notes.

### 🤖 6. AI Analyzer (Private Intelligence)
- **Bring-Your-Own-Key (BYOK)**: Supports Google Gemini, Anthropic Claude, and OpenAI GPT models.
- **Secure Key Storage**: API keys are encrypted at rest using AES-256 before storage.
- **Contextual Intelligence**: Ask questions about your personal trends — from financial advice to routine optimization and diet suggestions grounded in your actual log history.

### 🎨 7. Universal App Experience
- **Unified Themed Dialogs**: Replaces browser popups with contextual, dark-themed alert and confirmation dialogs branded to each ledger (`🍽️ Food Ledger says`, `💰 Money Ledger says`, `📋 Routine Ledger says`, etc.).
- **Quick Dump Modal**: Global floating trigger (`Ctrl+K` / Bottom Button) to quickly log expenses, food, or routine activities from anywhere in the app in seconds.
- **Automated Backups & Restore**: Automated weekly JSON database dumps saved straight to your host disk, paired with a full backup/restore wizard.

---

## 🏗️ Architecture & Tech Stack

```
life-ledger/
├── backend/                # Node.js + Express REST API
│   ├── routes/             # Modular controllers (accounts, transactions, diet, routine, etc.)
│   ├── services/           # Crypto, AI analyzer, PDF generation, backup scheduler
│   ├── db/                 # MariaDB connection pool & schema migrations
│   └── server.js           # HTTP/HTTPS entry point
├── frontend/               # React 18 Single Page Application
│   ├── src/pages/          # Dedicated ledger views & dashboards
│   ├── src/components/     # Reusable UI cards, modals, themed dialog provider
│   └── src/index.css       # Complete CSS design token system
├── docker-compose.yml      # Multi-container orchestration (App + MariaDB)
├── Dockerfile              # Multi-stage production build (Node + Vite)
├── k8s/                    # Kubernetes production manifests
└── nginx/                  # Production reverse proxy config (gzip, rate-limiting)
```

- **Frontend**: React 18, Vite, React Router 6, Recharts, Fraunces & Inter typography, CSS custom properties.
- **Backend**: Node.js 20, Express, MySQL2, Tini, OpenSSL, Cron-based automatic backup scheduler.
- **Database**: MariaDB 11 with persistent named volumes and healthcheck validation.
- **Deployment**: Docker Compose, Kubernetes manifests, and optional Nginx reverse proxy.

---

## 🚀 Quick Start Guide

### Prerequisites
Make sure you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Docker Compose on Linux) installed and running.

```bash
docker --version
docker compose version
```

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/<your-repo-name>.git
cd <your-repo-name>
```

### 2. Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env
```
Open `.env` in your text editor and customize your passwords:
```env
# Database Credentials
DB_ROOT_PASSWORD=your_strong_root_password
DB_NAME=money_tracker
DB_USER=money_user
DB_PASSWORD=your_strong_db_password

# Web App Login
AUTH_USERNAME=admin
AUTH_PASSWORD=your_secure_login_password

# Session Security
JWT_SECRET=your_super_long_random_secret_string
SESSION_HOURS=4
```

### 3. Build and Start the Application
Start the containers in detached mode:
```bash
docker compose up --build -d
```

### 4. Access the App
Open your web browser:
- **HTTP**: [http://localhost:5000](http://localhost:5000)
- **HTTPS**: [https://localhost:5443](https://localhost:5443) *(enables microphone voice inputs on mobile)*

Log in using the `AUTH_USERNAME` and `AUTH_PASSWORD` configured in your `.env`.

---

## 🔒 Security & Privacy by Design

- **Local Host Isolation**: MariaDB port `3307` is bound strictly to `127.0.0.1`, preventing exposure to your local network (LAN).
- **Zero Cloud Leakage**: Personal logs, medical files, and backups are stored exclusively on your host filesystem under `./backups` and `./health-reports`.
- **Sensitive File Protection**: All database backups, uploaded health reports, `.env` files, and SSL keys are strictly ignored by `.gitignore`.
- **Non-Root Execution**: Application processes in Docker run under an unprivileged user (`appuser`).
- **Session Auto-Expiry**: Tokens automatically expire after the configured `SESSION_HOURS` to prevent unauthorized access on shared devices.

---

## 💾 Backups & Data Portability

- **Automatic Backups**: The system automatically generates a complete JSON dump of your database every Sunday at midnight into `./backups/`.
- **Manual Backups**: Navigate to **Settings ➔ Backup & Data** to download a snapshot anytime.
- **Instant Restore**: Easily migrate or restore your database by uploading any valid backup JSON file directly via the Settings page.

---

## ☸️ Kubernetes Deployment (Optional)

Production-ready Kubernetes manifests are provided under the `k8s/` directory:
1. Create the namespace:
   ```bash
   kubectl apply -f k8s/namespace.yaml
   ```
2. Copy and configure secrets:
   ```bash
   cp k8s/secret.yaml.example k8s/secret.yaml
   # Edit k8s/secret.yaml with your base64-encoded credentials
   kubectl apply -f k8s/secret.yaml
   ```
3. Deploy database, configuration, and app:
   ```bash
   kubectl apply -f k8s/configmap.yaml
   kubectl apply -f k8s/mariadb.yaml
   kubectl apply -f k8s/app.yaml
   kubectl apply -f k8s/ingress.yaml
   ```

---

## 🛠️ Development & Useful Commands

| Command | Description |
| :--- | :--- |
| `docker compose up -d` | Start services in the background |
| `docker compose stop` | Gracefully stop running containers |
| `docker compose logs -f app` | Tail live application server logs |
| `docker compose up --build -d` | Recompile frontend & restart after making code changes |
| `docker compose down -v` | ⚠️ **Wipe everything** (including database volume) |

---

## 📄 License

This project is licensed under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0).
