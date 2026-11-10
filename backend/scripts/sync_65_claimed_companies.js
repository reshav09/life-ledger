const pool = require('../db/db');

// 38 existing companies to update with claimed salary ranges and updated URLs if applicable
const existingUpdates = [
  { name: "Atlassian", claimed: "40–70 LPA", sector: "Developer and collaboration software" },
  { name: "Postman", claimed: "35–60 LPA", sector: "API development tools" },
  { name: "BrowserStack", claimed: "30–50 LPA", sector: "Web and mobile testing" },
  { name: "Razorpay", claimed: "30–45 LPA", sector: "Payments and business finance" },
  { name: "Juspay", claimed: "30–50 LPA", sector: "Payment infrastructure" },
  { name: "Groww", claimed: "30–45 LPA", sector: "Investing and stockbroking" },
  { name: "CRED", claimed: "30–50 LPA", sector: "Consumer fintech" },
  { name: "Snowflake", claimed: "50–90 LPA", sector: "Cloud data and AI platform" },
  { name: "Databricks", claimed: "45–80 LPA", sector: "Data engineering, analytics and AI" },
  { name: "Palantir Technologies", altName: "Palantir", claimed: "35–60 LPA", sector: "Data analytics and AI software" },
  { name: "Figma", claimed: "30–50 LPA", sector: "Collaborative design software" },
  { name: "Plaid", claimed: "30–55 LPA", sector: "Financial data infrastructure" },
  { name: "Stripe", claimed: "35–60 LPA", sector: "Payments and financial infrastructure" },
  { name: "Coinbase", claimed: "30–55 LPA", sector: "Cryptocurrency platform" },
  { name: "Salesforce", claimed: "30–60 LPA", sector: "CRM and enterprise software" },
  { name: "SAP", claimed: "30–50 LPA", sector: "ERP and enterprise software" },
  { name: "Adobe", claimed: "30–55 LPA", sector: "Creative and marketing software" },
  { name: "Intuit", claimed: "30–50 LPA", sector: "Accounting, tax and financial software" },
  { name: "Nutanix", claimed: "30–50 LPA", sector: "Cloud infrastructure" },
  { name: "NVIDIA", claimed: "40–80 LPA", sector: "GPUs, AI computing and systems" },
  { name: "Intel", claimed: "30–45 LPA", sector: "Semiconductors and computing" },
  { name: "Microsoft", claimed: "30–60 LPA", sector: "Software, cloud and AI" },
  { name: "Google", claimed: "30–60 LPA", sector: "Search, cloud, advertising and AI" },
  { name: "Amazon", claimed: "30–50 LPA", sector: "E-commerce and cloud computing" },
  { name: "Apple", claimed: "30–50 LPA", sector: "Consumer devices, software and services" },
  { name: "Uber", claimed: "30–50 LPA", sector: "Mobility and delivery platforms" },
  { name: "Airbnb", claimed: "30–50 LPA", sector: "Travel and accommodation marketplace" },
  { name: "PhonePe", claimed: "30–45 LPA", sector: "Digital payments and financial services" },
  { name: "Flipkart", claimed: "30–45 LPA", sector: "E-commerce" },
  { name: "Walmart Global Tech", claimed: "30–50 LPA", sector: "Retail technology and supply-chain systems" },
  { name: "JPMorgan Chase", claimed: "35–60 LPA", sector: "Banking and financial technology" },
  { name: "Goldman Sachs", claimed: "40–70 LPA", sector: "Investment banking and financial technology" },
  { name: "Morgan Stanley", claimed: "35–60 LPA", sector: "Financial services and technology" },
  { name: "BlackRock", claimed: "35–60 LPA", sector: "Asset management and investment technology" },
  { name: "Dropbox", claimed: "30–50 LPA", sector: "Cloud storage and collaboration" },
  { name: "Zepto", claimed: "30–45 LPA", sector: "Quick commerce" },
  { name: "Swiggy", claimed: "30–45 LPA", sector: "Food delivery and quick commerce" },
  { name: "Publicis Sapient", claimed: "30–45 LPA", sector: "Digital transformation and consulting" }
];

// 27 missing companies to insert
const missingToInsert = [
  {
    name: "Chargebee", short_name: "Chargebee", sector: "Subscription billing software",
    category_group: "startup", country: "India", region: "Chennai",
    website: "https://www.chargebee.com", careers_url: "https://www.chargebee.com/company/careers/",
    claimed: "30–45 LPA", quality_score: 91, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Subscription billing & recurring payments SaaS unicorn ($3.5B+). Claimed CTC: ₹30–45 LPA. Chennai & Bengaluru hubs. Backed by Accel, Tiger Global."
  },
  {
    name: "Confluent", short_name: "Confluent", sector: "Data streaming infrastructure",
    category_group: "private_in", country: "India", region: "Bengaluru",
    website: "https://www.confluent.io", careers_url: "https://www.ibm.com/careers/search?q=confluent",
    claimed: "40–70 LPA", quality_score: 93, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Apache Kafka enterprise event streaming cloud platform. Careers URL redirects via IBM job search portal. High compensation: claimed ₹40–70 LPA. Distributed systems."
  },
  {
    name: "Twilio", short_name: "Twilio", sector: "Communication APIs",
    category_group: "private_in", country: "India", region: "Bengaluru",
    website: "https://www.twilio.com", careers_url: "https://jobs.twilio.com/careers",
    claimed: "30–50 LPA", quality_score: 90, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Customer engagement & cloud communications platform (SMS, Voice, Video APIs). Bengaluru engineering center. Claimed CTC: ₹30–50 LPA."
  },
  {
    name: "Okta", short_name: "Okta", sector: "Identity and access management",
    category_group: "private_in", country: "India", region: "Bengaluru",
    website: "https://www.okta.com", careers_url: "https://www.okta.com/company/careers/",
    claimed: "25–45 LPA", quality_score: 91, ats_type: "greenhouse", ats_id: "okta", is_active: 1,
    notes: "World leader in enterprise identity and access management (IAM) & Auth0 parent. Bengaluru innovation hub. Claimed CTC: ₹25–45 LPA. Greenhouse ATS enabled."
  },
  {
    name: "Elastic", short_name: "Elastic", sector: "Search, observability and security",
    category_group: "private_global", country: "Global", region: "Remote",
    website: "https://www.elastic.co", careers_url: "https://www.elastic.co/careers",
    claimed: "30–50 LPA", quality_score: 92, ats_type: "greenhouse", ats_id: "elastic", is_active: 1,
    notes: "Creators of Elasticsearch, Kibana, Logstash, and Lucene vector search engine. Distributed remote-first culture. Claimed CTC: ₹30–50 LPA. Greenhouse ATS enabled."
  },
  {
    name: "CrowdStrike", short_name: "CrowdStrike", sector: "Cybersecurity",
    category_group: "private_in", country: "India", region: "Pune",
    website: "https://www.crowdstrike.com", careers_url: "https://www.crowdstrike.com/en-us/careers/",
    claimed: "30–55 LPA", quality_score: 93, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Falcon cloud-native endpoint security & threat intelligence leader. Major R&D centers in Pune and Bengaluru. Claimed CTC: ₹30–55 LPA. Kernel & cloud systems."
  },
  {
    name: "Brex", short_name: "Brex", sector: "Corporate cards and expense management",
    category_group: "private_global", country: "United States", region: "Global Remote",
    website: "https://www.brex.com", careers_url: "https://www.brex.com/careers",
    claimed: "30–55 LPA", quality_score: 92, ats_type: "greenhouse", ats_id: "brex", is_active: 1,
    notes: "AI-powered corporate credit cards & global financial OS for startups & enterprises. Remote-friendly tech org. Claimed CTC: ₹30–55 LPA. Greenhouse ATS enabled."
  },
  {
    name: "ServiceNow", short_name: "ServiceNow", sector: "Enterprise workflow automation",
    category_group: "private_in", country: "India", region: "Hyderabad",
    website: "https://www.servicenow.com", careers_url: "https://careers.servicenow.com/",
    claimed: "30–55 LPA", quality_score: 92, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Cloud digital workflow automation platform ($160B+ market cap). Massive Hyderabad & Bengaluru engineering campuses. High base compensation (claimed ₹30–55 LPA)."
  },
  {
    name: "Workday", short_name: "Workday", sector: "HR and financial management software",
    category_group: "private_in", country: "India", region: "Pune",
    website: "https://www.workday.com", careers_url: "https://www.workday.com/en-us/company/careers/overview.html",
    claimed: "30–50 LPA", quality_score: 91, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Enterprise cloud software for financial management, payroll, and human capital. Rapidly growing Pune & Bengaluru technology centers. Claimed CTC: ₹30–50 LPA."
  },
  {
    name: "VMware (via Broadcom)", short_name: "VMware", sector: "Virtualization and cloud infrastructure",
    category_group: "private_in", country: "India", region: "Bengaluru",
    website: "https://www.broadcom.com", careers_url: "https://www.broadcom.com/company/careers",
    claimed: "30–50 LPA", quality_score: 91, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Pioneers of virtualization (ESXi, vSphere, Tanzu). Acquired by Broadcom; careers through Broadcom portal. Major Bengaluru engineering hub. Claimed CTC: ₹30–50 LPA."
  },
  {
    name: "AMD", short_name: "AMD", sector: "CPUs, GPUs and semiconductors",
    category_group: "private_in", country: "India", region: "Bengaluru",
    website: "https://www.amd.com", careers_url: "https://www.amd.com/en/corporate/careers.html",
    claimed: "35–60 LPA", quality_score: 94, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Semiconductor computing pioneer (Ryzen, EPYC, Instinct AI GPUs, Xilinx). World's largest AMD design center at Bangalore Technopark. Claimed CTC: ₹35–60 LPA."
  },
  {
    name: "Qualcomm", short_name: "Qualcomm", sector: "Semiconductors and wireless technology",
    category_group: "private_in", country: "India", region: "Hyderabad",
    website: "https://www.qualcomm.com", careers_url: "https://careers.qualcomm.com/careers",
    claimed: "30–50 LPA", quality_score: 93, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Wireless communications and mobile silicon leader (Snapdragon, 5G, modem & edge NPU). Giant Hyderabad & Bengaluru design centers. Claimed CTC: ₹30–50 LPA."
  },
  {
    name: "Paytm", short_name: "Paytm", sector: "Payments and financial services",
    category_group: "startup", country: "India", region: "Noida",
    website: "https://paytm.com", careers_url: "https://paytm.com/careers",
    claimed: "30–45 LPA", quality_score: 87, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Digital payments pioneer, Soundbox inventor, and financial services platform (One97 Communications). Noida HQ. Claimed CTC: ₹30–45 LPA."
  },
  {
    name: "Meesho", short_name: "Meesho", sector: "E-commerce",
    category_group: "startup", country: "India", region: "Bengaluru",
    website: "https://meesho.io", careers_url: "https://www.meesho.io/jobs",
    claimed: "30–45 LPA", quality_score: 91, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "India's largest zero-commission social commerce marketplace. Tech unicorn ($5B+). High compensation & ESOPs (claimed ₹30–45 LPA). High-scale distributed systems."
  },
  {
    name: "Target", short_name: "Target", sector: "Retail and retail technology",
    category_group: "private_in", country: "India", region: "Bengaluru",
    website: "https://corporate.target.com", careers_url: "https://corporate.target.com/careers",
    claimed: "30–50 LPA", quality_score: 90, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Target in India innovation center in Manyata Tech Park, Bengaluru. Powers global retail search, supply chain robotics, and omnichannel AI. Claimed CTC: ₹30–50 LPA."
  },
  {
    name: "American Express", short_name: "Amex", sector: "Payments, cards and financial services",
    category_group: "private_in", country: "India", region: "Gurugram",
    website: "https://www.americanexpress.com", careers_url: "https://careers.americanexpress.com/en/sites/CX_1/jobs",
    claimed: "30–50 LPA", quality_score: 91, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Premium global payments network. Massive technology campus in Gurugram (Sector 74A) and Bengaluru. Sub-second fraud detection & payments engine. Claimed CTC: ₹30–50 LPA."
  },
  {
    name: "HSBC", short_name: "HSBC", sector: "Banking and financial technology",
    category_group: "private_in", country: "India", region: "Hyderabad",
    website: "https://www.hsbc.com", careers_url: "https://www.hsbc.com/careers",
    claimed: "30–45 LPA", quality_score: 88, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "HSBC Technology India (HTI) engineering center building core banking, institutional trading, and global payments across Hyderabad, Pune, and Bengaluru. Claimed CTC: ₹30–45 LPA."
  },
  {
    name: "Turnitin", short_name: "Turnitin", sector: "Education and academic integrity software",
    category_group: "private_in", country: "India", region: "Noida",
    website: "https://www.turnitin.com", careers_url: "https://in.turnitin.com/about/careers",
    claimed: "30–45 LPA", quality_score: 87, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Global edtech platform for plagiarism detection, AI writing analysis, and academic integrity. Noida development center. Claimed CTC: ₹30–45 LPA."
  },
  {
    name: "UiPath", short_name: "UiPath", sector: "Business automation and AI",
    category_group: "private_in", country: "India", region: "Bengaluru",
    website: "https://www.uipath.com", careers_url: "https://www.uipath.com/careers",
    claimed: "30–50 LPA", quality_score: 91, ats_type: "ashby", ats_id: "uipath", is_active: 1,
    notes: "Enterprise robotic process automation (RPA) and agentic workflow platform. Bengaluru R&D center. Claimed CTC: ₹30–50 LPA. Ashby ATS enabled."
  },
  {
    name: "Canva", short_name: "Canva", sector: "Visual design platform",
    category_group: "private_global", country: "Australia", region: "Global Remote",
    website: "https://www.canva.com", careers_url: "https://www.lifeatcanva.com/en/",
    claimed: "30–50 LPA", quality_score: 93, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Global visual communication & design collaboration platform ($26B+). High engineering bar, remote-friendly team. Claimed CTC: ₹30–50 LPA."
  },
  {
    name: "Checkout.com", short_name: "Checkout.com", sector: "Payment processing",
    category_group: "private_global", country: "United Kingdom", region: "Global Remote",
    website: "https://www.checkout.com", careers_url: "https://www.checkout.com/careers",
    claimed: "30–50 LPA", quality_score: 91, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Cloud payment processing and merchant acquiring platform ($11B+ valuation). Remote-first engineering culture. Claimed CTC: ₹30–50 LPA."
  },
  {
    name: "Dunzo", short_name: "Dunzo", sector: "Hyperlocal delivery",
    category_group: "startup", country: "India", region: "Bengaluru",
    website: "https://www.dunzo.com", careers_url: "",
    claimed: "30–45 LPA", quality_score: 50, ats_type: "custom_scrape", ats_id: null, is_active: 0,
    notes: "⚠️ INACTIVE / SHUT DOWN: Reported to have officially ceased operations / shut down in January 2025. Not an active hiring lead. Historical salary range claimed was ₹30–45 LPA."
  },
  {
    name: "Zomato (Eternal)", short_name: "Zomato", sector: "Food delivery and restaurant discovery",
    category_group: "startup", country: "India", region: "Gurugram",
    website: "https://www.zomato.com", careers_url: "https://www.eternal.com/careers/",
    claimed: "30–45 LPA", quality_score: 93, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Food tech leader and parent of Blinkit, Hyperpure, and District under Eternal umbrella. Careers portal unified at eternal.com/careers. High-scale logistics. Claimed CTC: ₹30–45 LPA."
  },
  {
    name: "Blinkit (Eternal)", short_name: "Blinkit", sector: "Quick commerce",
    category_group: "startup", country: "India", region: "Gurugram",
    website: "https://blinkit.com", careers_url: "https://www.eternal.com/careers/",
    claimed: "30–45 LPA", quality_score: 93, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Quick commerce market leader (10-minute delivery). Subsidiary of Eternal (Zomato); careers redirect to eternal.com/careers. Claimed CTC: ₹30–45 LPA."
  },
  {
    name: "LTIMindtree", short_name: "LTIMindtree", sector: "IT services and consulting",
    category_group: "service_tech", country: "India", region: "Mumbai",
    website: "https://www.ltimindtree.com", careers_url: "https://careers.ltm.com/?locale=en_US",
    claimed: "30–45 LPA", quality_score: 82, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Tier-1 IT consulting & digital transformation services (Larsen & Toubro group). Specialist digital engineering & cloud units offer ₹30–45 LPA claimed senior packages."
  },
  {
    name: "Thoughtworks", short_name: "Thoughtworks", sector: "Software engineering and consulting",
    category_group: "private_in", country: "India", region: "Bengaluru",
    website: "https://www.thoughtworks.com", careers_url: "https://www.thoughtworks.com/careers",
    claimed: "30–45 LPA", quality_score: 92, ats_type: "greenhouse", ats_id: "thoughtworks", is_active: 1,
    notes: "Global software consultancy renowned for agile, Extreme Programming (XP), and microservices architecture. High engineering bar. Claimed CTC: ₹30–45 LPA. Greenhouse ATS enabled."
  },
  {
    name: "EPAM Systems", short_name: "EPAM", sector: "Software engineering and IT services",
    category_group: "private_in", country: "India", region: "Hyderabad",
    website: "https://www.epam.com", careers_url: "https://www.epam.com/careers",
    claimed: "30–45 LPA", quality_score: 86, ats_type: "custom_scrape", ats_id: null, is_active: 1,
    notes: "Global digital platform engineering and software product development consultancy. Large India development centers in Hyderabad, Bengaluru, and Pune. Claimed CTC: ₹30–45 LPA."
  }
];

async function run() {
  console.log("=== Updating 38 Existing Organizations with Claimed LPA Ranges ===");
  for (const item of existingUpdates) {
    const minMatch = item.claimed.match(/^(\d+)/);
    const minVal = minMatch ? parseInt(minMatch[1], 10) : null;
    
    // Find the record by name
    const [rows] = await pool.query(
      "SELECT id, notes, min_ctc_threshold FROM jobhunt_organizations WHERE name = ? OR name = ? OR short_name = ?",
      [item.name, item.altName || item.name, item.name]
    );

    if (rows.length > 0) {
      const org = rows[0];
      let notes = org.notes || "";
      if (!notes.includes("Claimed CTC:")) {
        notes = `${notes} | Claimed CTC: ₹${item.claimed}`.trim();
      }
      await pool.query(
        "UPDATE jobhunt_organizations SET notes = ?, min_ctc_threshold = COALESCE(min_ctc_threshold, ?) WHERE id = ?",
        [notes, minVal, org.id]
      );
      console.log(`Updated [${org.id}] ${item.name} -> Claimed: ₹${item.claimed}`);
    } else {
      console.log(`Could not find existing record for: ${item.name}`);
    }
  }

  console.log("\n=== Inserting 27 Missing Organizations ===");
  let inserted = 0;
  for (const item of missingToInsert) {
    const minMatch = item.claimed.match(/^(\d+)/);
    const minVal = minMatch ? parseInt(minMatch[1], 10) : null;

    const [existing] = await pool.query("SELECT id FROM jobhunt_organizations WHERE name = ?", [item.name]);
    if (existing.length > 0) {
      console.log(`Already exists: ${item.name} [${existing[0].id}]`);
      continue;
    }

    await pool.query(
      `INSERT INTO jobhunt_organizations 
       (name, short_name, sector, org_type, careers_url, notification_url, pdf_page_url, website, notes, quality_score, poll_frequency_days, is_active, category_group, country, region, visa_sponsored, currency, min_ctc_threshold, ats_type, ats_id, last_jobs_found)
       VALUES (?, ?, ?, 'private', ?, '', '', ?, ?, ?, 7, ?, ?, ?, ?, 0, 'INR', ?, ?, ?, 0)`,
      [
        item.name, item.short_name, item.sector, item.careers_url, item.website,
        item.notes, item.quality_score, item.is_active, item.category_group, item.country, item.region,
        minVal, item.ats_type, item.ats_id
      ]
    );
    console.log(`✅ Inserted: ${item.name} (${item.category_group}) | CTC: ₹${item.claimed} | ATS: ${item.ats_type}`);
    inserted++;
  }

  console.log(`\nAll operations completed. Inserted: ${inserted} / ${missingToInsert.length}`);
  const [total] = await pool.query("SELECT COUNT(*) as count FROM jobhunt_organizations");
  console.log(`Total organizations now in database: ${total[0].count}`);
  process.exit(0);
}

run().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});

