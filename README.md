# 🎯 Job Radar OS

Autonomous opportunity discovery, ATS ingestion, and algorithmic career matching platform with 12-hour background updates and grounded resume/cover-letter drafting.

---

## 🚀 Quick Deploy on Railway (Zero Docker Required)

### Step 1: Create a Railway Project
1. Log in to [Railway.app](https://railway.app).
2. Click **+ New Project**.
3. Select **Provision MySQL** (or **MariaDB**). Railway will create your database in a few seconds.

### Step 2: Deploy this Repository
1. In the same Railway project, click **+ New** → **GitHub Repo**.
2. Select this repository and the `standalone-jobhunt` branch.
3. Railway will automatically detect the configuration, build the frontend, and launch the server.

### Step 3: Set Environment Variables
In your web service's **Variables** tab on Railway, add:
* `GEMINI_API_KEY` = *Your Google Gemini API Key* (for smart job description parsing & AI interview prep)
* `AUTH_USERNAME` = `admin` (or her preferred username)
* `AUTH_PASSWORD` = `your-password-here` (her preferred password)
* `JWT_SECRET` = *Any random string* (e.g. `jwt-secret-xyz-987`)
* `SESSION_HOURS` = `24`

*(Note: Database connection variables like `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD` are injected automatically by Railway when connected to your MySQL service!)*

---

## ⚡ Key Features

1. **Autonomous 12-Hour Sync**:
   * Every 12 hours, the platform automatically crawls active company ATS boards (Greenhouse, Lever, Ashby, Workday, etc.), public feeds, and PSU notifications.
   * Expired deadlines are purged, active roles are updated, and everything is re-scored against the candidate's profile.

2. **Personalized Profile & Algorithmic Scoring**:
   * Go to **06 My Profile** to input candidate details, degrees, target roles, preferred locations, and skills.
   * Every job is assigned a composite score from `0` to `100` based on eligibility, skills alignment, compensation, and competition signals.

3. **1-Click Application Workspace**:
   * Generates ATS-optimized resumes and cover letters strictly grounded in verified profile facts (zero hallucination).
   * Direct export to ATS HTML and printable PDF.

4. **Opportunity Radar**:
   * Interactive filters for **Apply Now**, **Worth It**, **Deadlines (≤7d, ≤14d)**, and specialized sectors (Startups, Quant/HFT, PSUs, EU Visa, Indian Tech).

---

## 🛠️ Local Development (Optional)

If running locally:
```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Build frontend into backend
cd ../frontend && npm run build
rm -rf ../backend/public && cp -r dist ../backend/public

# 3. Start backend
cd ../backend
node server.js
```
Open [http://localhost:4000](http://localhost:4000) in your browser.
