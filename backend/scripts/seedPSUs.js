/**
 * Seed script: Populates official careers URLs and metadata for all major
 * Indian PSUs (Maharatna, Navratna, Miniratna), premier Govt R&D labs,
 * scientific organizations, and regulatory bodies where Engineer/Officer CTC >= 15 LPA.
 */

const defaultPool = require('../db/db');
require('dotenv').config();

const ORG_REGISTRY = [
  // ==========================================
  // 1. MAHARATNA CPSEs (All CTC ~17 - 26+ LPA)
  // ==========================================
  {
    name: 'Oil and Natural Gas Corporation',
    short_name: 'ONGC',
    sector: 'Oil & Gas',
    org_type: 'Maharatna CPSE',
    careers_url: 'https://ongcindia.com/web/eng/career',
    notification_url: 'https://ongcindia.com/web/eng/career/recruitment-notices',
    website: 'https://ongcindia.com',
    quality_score: 96,
    notes: 'Assistant Executive Engineer (AEE) in Engg / IT / Geo-sciences. Pay Scale: ₹60,000 - ₹1,80,000 (E-1). Typical CTC: ₹22 - ₹25 LPA + offshore allowances.',
    poll_frequency_days: 7
  },
  {
    name: 'Indian Oil Corporation Limited',
    short_name: 'IOCL',
    sector: 'Oil & Gas',
    org_type: 'Maharatna CPSE',
    careers_url: 'https://iocl.com/latest-job-opening',
    notification_url: 'https://iocl.com/latest-job-opening',
    website: 'https://iocl.com',
    quality_score: 95,
    notes: 'Officers / Engineers (Grade A / E-2). Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹17 - ₹21 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'NTPC Limited',
    short_name: 'NTPC',
    sector: 'Power & Energy',
    org_type: 'Maharatna CPSE',
    careers_url: 'https://careers.ntpc.co.in/',
    notification_url: 'https://careers.ntpc.co.in/recruitment/',
    website: 'https://ntpc.co.in',
    quality_score: 95,
    notes: 'Engineering Executive Trainees (EET) & Assistant Manager (IT/Systems). Pay Scale: ₹60,000 - ₹1,80,000 (E-2). Typical CTC: ₹18 - ₹22 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Bharat Heavy Electricals Limited',
    short_name: 'BHEL',
    sector: 'Heavy Engineering & Power',
    org_type: 'Maharatna CPSE',
    careers_url: 'https://careers.bhel.in/',
    notification_url: 'https://careers.bhel.in/bhel/jsp/',
    website: 'https://www.bhel.com',
    quality_score: 92,
    notes: 'Engineer Trainees (ET) in Mech, Elec, Civil, IT. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹15.5 - ₹18 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'GAIL (India) Limited',
    short_name: 'GAIL',
    sector: 'Oil & Gas / Petrochemicals',
    org_type: 'Maharatna CPSE',
    careers_url: 'https://gailonline.com/CRApplyingGail.html',
    notification_url: 'https://gailonline.com/CRApplyingGail.html',
    website: 'https://gailonline.com',
    quality_score: 95,
    notes: 'Executive Trainees (ET) in Engg / Telecom / IT / HR. Pay Scale: ₹60,000 - ₹1,80,000 (E-2). Typical CTC: ₹18 - ₹22 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Bharat Petroleum Corporation Limited',
    short_name: 'BPCL',
    sector: 'Oil & Gas',
    org_type: 'Maharatna CPSE',
    careers_url: 'https://www.bharatpetroleum.in/careers/careers.aspx',
    notification_url: 'https://www.bharatpetroleum.in/careers/current-openings.aspx',
    website: 'https://www.bharatpetroleum.in',
    quality_score: 94,
    notes: 'Management Trainee / General Work Engineer (GWE). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹18 - ₹22 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Hindustan Petroleum Corporation Limited',
    short_name: 'HPCL',
    sector: 'Oil & Gas',
    org_type: 'Maharatna CPSE',
    careers_url: 'https://www.hindustanpetroleum.com/job-openings',
    notification_url: 'https://jobs.hpcl.co.in/',
    website: 'https://www.hindustanpetroleum.com',
    quality_score: 94,
    notes: 'Officers / Engineers (E-2). Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹16.8 - ₹20.5 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Coal India Limited',
    short_name: 'CIL',
    sector: 'Mining & Energy',
    org_type: 'Maharatna CPSE',
    careers_url: 'https://www.coalindia.in/career-at-cil/',
    notification_url: 'https://www.coalindia.in/career-at-cil/jobs-at-coal-india/',
    website: 'https://www.coalindia.in',
    quality_score: 93,
    notes: 'Management Trainees (E-2) in Mining, Civil, Mechanical, Systems/IT. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16 - ₹19 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Power Grid Corporation of India Limited',
    short_name: 'POWERGRID',
    sector: 'Power Transmission & Telecom',
    org_type: 'Maharatna CPSE',
    careers_url: 'https://www.powergrid.in/job-opportunities',
    notification_url: 'https://www.powergrid.in/job-opportunities',
    website: 'https://www.powergrid.in',
    quality_score: 95,
    notes: 'Engineer Trainee (Electrical, Electronics, Civil, Computer Science). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹18 - ₹21.5 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Steel Authority of India Limited',
    short_name: 'SAIL',
    sector: 'Steel & Metals',
    org_type: 'Maharatna CPSE',
    careers_url: 'https://sail.co.in/en/plants/careers',
    notification_url: 'https://www.sailcareers.com/',
    website: 'https://sail.co.in',
    quality_score: 91,
    notes: 'Management Trainee (Technical - MTT). Pay Scale: ₹60,000 - ₹1,80,000 (E-1/E-2). Typical CTC: ₹15 - ₹18 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Power Finance Corporation',
    short_name: 'PFC',
    sector: 'Financial Services / NBFC',
    org_type: 'Maharatna CPSE',
    careers_url: 'https://pfcindia.com/Career',
    notification_url: 'https://pfcindia.com/Career',
    website: 'https://pfcindia.com',
    quality_score: 95,
    notes: 'Assistant Manager / Officer in IT / Finance / Technical. Pay Scale: ₹60,000 - ₹1,80,000 (E-2). Typical CTC: ₹20 - ₹26 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'REC Limited',
    short_name: 'REC',
    sector: 'Financial Services / Infrastructure',
    org_type: 'Maharatna CPSE',
    careers_url: 'https://recindia.nic.in/careers',
    notification_url: 'https://recindia.nic.in/careers',
    website: 'https://recindia.nic.in',
    quality_score: 95,
    notes: 'Assistant Executive / Officer in IT, Engineering, Finance. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹20 - ₹25 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Oil India Limited',
    short_name: 'OIL',
    sector: 'Oil & Gas / Exploration',
    org_type: 'Maharatna CPSE',
    careers_url: 'https://www.oil-india.com/Current-openings',
    notification_url: 'https://www.oil-india.com/Current-openings',
    website: 'https://www.oil-india.com',
    quality_score: 94,
    notes: 'Executive Trainee (Grade B/E-2). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹17.5 - ₹22 LPA.',
    poll_frequency_days: 7
  },

  // ==========================================
  // 2. NAVRATNA CPSEs (All CTC ~15 - 20+ LPA)
  // ==========================================
  {
    name: 'Bharat Electronics Limited',
    short_name: 'BEL',
    sector: 'Defence Electronics & Aerospace',
    org_type: 'Navratna CPSE',
    careers_url: 'https://bel-india.in/careers/',
    notification_url: 'https://bel-india.in/recruitment/',
    website: 'https://bel-india.in',
    quality_score: 94,
    notes: 'Probationary Engineer (PE) in Radar, Software, Electronics. Pay Scale: ₹40,000 - ₹1,40,000 / ₹50,000 - ₹1,60,000. Typical CTC: ₹14.5 - ₹17.5 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Hindustan Aeronautics Limited',
    short_name: 'HAL',
    sector: 'Aerospace & Defence',
    org_type: 'Navratna CPSE',
    careers_url: 'https://hal-india.co.in/Career_Active.aspx',
    notification_url: 'https://hal-india.co.in/Career_Active.aspx',
    website: 'https://hal-india.co.in',
    quality_score: 93,
    notes: 'Management Trainee (Technical) / Design Trainee. Pay Scale: ₹40,000 - ₹1,40,000 / E-2. Typical CTC: ₹15 - ₹18 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'National Aluminium Company Limited',
    short_name: 'NALCO',
    sector: 'Metals & Mining',
    org_type: 'Navratna CPSE',
    careers_url: 'https://nalcoindia.com/career/',
    notification_url: 'https://nalcoindia.com/career/current-openings/',
    website: 'https://nalcoindia.com',
    quality_score: 90,
    notes: 'Graduate Engineer Trainee (GET) in Mech, Elec, Mining, Systems. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹15.5 - ₹18.5 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'NMDC Limited',
    short_name: 'NMDC',
    sector: 'Mining & Exploration',
    org_type: 'Navratna CPSE',
    careers_url: 'https://www.nmdc.co.in/careers',
    notification_url: 'https://www.nmdc.co.in/careers',
    website: 'https://www.nmdc.co.in',
    quality_score: 92,
    notes: 'Executive Trainee (Technical). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16 - ₹19.5 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Engineers India Limited',
    short_name: 'EIL',
    sector: 'Consultancy & Petrochemical Engg',
    org_type: 'Navratna CPSE',
    careers_url: 'https://recruitment.eil.co.in/',
    notification_url: 'https://recruitment.eil.co.in/',
    website: 'https://engineersindia.com',
    quality_score: 92,
    notes: 'Management Trainee (Construction/Design/IT). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16.5 - ₹19.5 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'NBCC (India) Limited',
    short_name: 'NBCC',
    sector: 'Infrastructure & Construction',
    org_type: 'Navratna CPSE',
    careers_url: 'https://www.nbccindia.in/webEnglish/jobs',
    notification_url: 'https://www.nbccindia.in/webEnglish/jobs',
    website: 'https://www.nbccindia.in',
    quality_score: 89,
    notes: 'Management Trainee (Civil, Electrical, IT). Pay Scale: ₹40,000 - ₹1,40,000 / E-2. Typical CTC: ₹14 - ₹16.5 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Container Corporation of India',
    short_name: 'CONCOR',
    sector: 'Logistics & Transportation',
    org_type: 'Navratna CPSE',
    careers_url: 'https://concor.co.in/currentopening.asp',
    notification_url: 'https://concor.co.in/currentopening.asp',
    website: 'https://concor.co.in',
    quality_score: 90,
    notes: 'Management Trainee (IT, Operations, Civil, Tech). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16 - ₹19 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Rashtriya Ispat Nigam Limited',
    short_name: 'RINL',
    sector: 'Steel & Heavy Industry',
    org_type: 'Navratna CPSE',
    careers_url: 'https://www.vizagsteel.com/myindex.asp?cccode=careers',
    notification_url: 'https://www.vizagsteel.com/myindex.asp?cccode=careers',
    website: 'https://www.vizagsteel.com',
    quality_score: 89,
    notes: 'Management Trainee (Technical - MTT). Pay Scale: ₹50,000 - ₹1,60,000 (E-1/E-2). Typical CTC: ₹14.5 - ₹17 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'NLC India Limited',
    short_name: 'NLCIL',
    sector: 'Power & Lignite Mining',
    org_type: 'Navratna CPSE',
    careers_url: 'https://www.nlcindia.in/new_website/careers/careers.php',
    notification_url: 'https://web.nlcindia.in/career/',
    website: 'https://www.nlcindia.in',
    quality_score: 91,
    notes: 'Graduate Executive Trainee (GET) in Mech, Elec, Civil, Mining, CSE. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16 - ₹19 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Rail Vikas Nigam Limited',
    short_name: 'RVNL',
    sector: 'Railways Infrastructure',
    org_type: 'Navratna CPSE',
    careers_url: 'https://rvnl.org/career',
    notification_url: 'https://rvnl.org/career',
    website: 'https://rvnl.org',
    quality_score: 91,
    notes: 'Assistant Manager (Civil, Electrical, S&T, IT). Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹15 - ₹18 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'IRCON International Limited',
    short_name: 'IRCON',
    sector: 'Railways & Infrastructure',
    org_type: 'Navratna CPSE',
    careers_url: 'https://www.ircon.org/index.php?option=com_content&view=article&id=16&Itemid=121&lang=en',
    notification_url: 'https://www.ircon.org/index.php?option=com_content&view=article&id=16&Itemid=121&lang=en',
    website: 'https://www.ircon.org',
    quality_score: 90,
    notes: 'Executive Trainee / Assistant Manager (Civil, S&T, Electrical). Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹15 - ₹18 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'RITES Limited',
    short_name: 'RITES',
    sector: 'Transport Infrastructure Consultancy',
    org_type: 'Navratna CPSE',
    careers_url: 'https://rites.com/career',
    notification_url: 'https://rites.com/career',
    website: 'https://rites.com',
    quality_score: 91,
    notes: 'Graduate Executive Trainee / Engineer. Pay Scale: ₹50,000 - ₹1,60,000 (E-2). Typical CTC: ₹15.5 - ₹18 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Indian Renewable Energy Development Agency',
    short_name: 'IREDA',
    sector: 'Renewable Energy Finance',
    org_type: 'Navratna CPSE',
    careers_url: 'https://www.ireda.in/career',
    notification_url: 'https://www.ireda.in/career',
    website: 'https://www.ireda.in',
    quality_score: 93,
    notes: 'Assistant Manager in Technical / IT / Green Finance. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹18 - ₹22 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Housing and Urban Development Corporation',
    short_name: 'HUDCO',
    sector: 'Housing & Urban Finance',
    org_type: 'Navratna CPSE',
    careers_url: 'https://hudco.org.in/career',
    notification_url: 'https://hudco.org.in/career',
    website: 'https://hudco.org.in',
    quality_score: 90,
    notes: 'Trainee Officers / Assistant Manager. Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹15 - ₹18 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'NHPC Limited',
    short_name: 'NHPC',
    sector: 'Hydroelectric Power',
    org_type: 'Navratna CPSE',
    careers_url: 'https://www.nhpcindia.com/welcome/career',
    notification_url: 'https://www.nhpcindia.com/welcome/career',
    website: 'https://www.nhpcindia.com',
    quality_score: 92,
    notes: 'Trainee Engineer / Trainee Officer (E-2). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16 - ₹19 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'SJVN Limited',
    short_name: 'SJVN',
    sector: 'Hydro & Renewable Energy',
    org_type: 'Navratna CPSE',
    careers_url: 'https://sjvn.nic.in/current-jobs',
    notification_url: 'https://sjvn.nic.in/current-jobs',
    website: 'https://sjvn.nic.in',
    quality_score: 91,
    notes: 'Executive Trainee in Civil, Electrical, Mechanical, IT. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹15.5 - ₹18.5 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Solar Energy Corporation of India',
    short_name: 'SECI',
    sector: 'Solar Energy & Green Hydrogen',
    org_type: 'Navratna CPSE',
    careers_url: 'https://www.seci.co.in/careers',
    notification_url: 'https://www.seci.co.in/careers',
    website: 'https://www.seci.co.in',
    quality_score: 92,
    notes: 'Senior Engineer / Deputy Manager in Solar Power & Grid Integration. Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹16 - ₹19 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'RailTel Corporation of India',
    short_name: 'RailTel',
    sector: 'Telecom & Cloud Infrastructure',
    org_type: 'Navratna CPSE',
    careers_url: 'https://www.railtel.in/careers.html',
    notification_url: 'https://www.railtel.in/careers.html',
    website: 'https://www.railtel.in',
    quality_score: 91,
    notes: 'Assistant Manager (Technical / Telecom / IT / Cloud). Pay Scale: ₹40,000 - ₹1,40,000 (E-1). Typical CTC: ₹14.5 - ₹17 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Mazagon Dock Shipbuilders Limited',
    short_name: 'MDL',
    sector: 'Defence Shipbuilding & Submarines',
    org_type: 'Navratna CPSE',
    careers_url: 'https://mazagondock.in/careers.aspx',
    notification_url: 'https://mazagondock.in/careers.aspx',
    website: 'https://mazagondock.in',
    quality_score: 92,
    notes: 'Executive Trainee (Naval Architecture, Mechanical, Electrical). Pay Scale: ₹40,000 - ₹1,40,000 / E-2. Typical CTC: ₹15 - ₹18 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Rashtriya Chemicals and Fertilizers',
    short_name: 'RCF',
    sector: 'Fertilizers & Chemicals',
    org_type: 'Navratna CPSE',
    careers_url: 'https://www.rcfltd.com/recruitment',
    notification_url: 'https://www.rcfltd.com/recruitment',
    website: 'https://www.rcfltd.com',
    quality_score: 90,
    notes: 'Management Trainee in Chemical, Mechanical, Electrical, IT. Pay Scale: ₹40,000 - ₹1,40,000 / E-2. Typical CTC: ₹15 - ₹17.5 LPA.',
    poll_frequency_days: 7
  },

  // ==========================================
  // 3. MINIRATNA & PREMIER ENGINEERING CPSEs
  // ==========================================
  {
    name: 'Nuclear Power Corporation of India Limited',
    short_name: 'NPCIL',
    sector: 'Nuclear Power & Energy',
    org_type: 'Miniratna CPSE',
    careers_url: 'https://www.npcilcareers.co.in/MainSite/default.aspx',
    notification_url: 'https://www.npcilcareers.co.in/',
    website: 'https://www.npcil.nic.in',
    quality_score: 95,
    notes: 'Executive Trainee (ET) in Mech, Chem, Elec, Electronics, Instrumentation, Civil. Pay Level 10. Typical CTC: ₹18 - ₹22 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'THDC India Limited',
    short_name: 'THDC',
    sector: 'Hydro & Thermal Power',
    org_type: 'Miniratna CPSE',
    careers_url: 'https://thdc.co.in/recruitment',
    notification_url: 'https://thdc.co.in/recruitment',
    website: 'https://thdc.co.in',
    quality_score: 90,
    notes: 'Executive Trainee (Civil, Electrical, Mechanical, IT). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16 - ₹19 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Garden Reach Shipbuilders & Engineers',
    short_name: 'GRSE',
    sector: 'Defence Shipbuilding',
    org_type: 'Miniratna CPSE',
    careers_url: 'https://grse.in/current-jobs/',
    notification_url: 'https://jobapply.in/grse/',
    website: 'https://grse.in',
    quality_score: 90,
    notes: 'Management Trainee (Technical). Pay Scale: ₹40,000 - ₹1,40,000 (E-1/E-2). Typical CTC: ₹14.5 - ₹17 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Bharat Dynamics Limited',
    short_name: 'BDL',
    sector: 'Missiles & Defence Systems',
    org_type: 'Miniratna CPSE',
    careers_url: 'https://bdl-india.in/careers',
    notification_url: 'https://bdl-india.in/careers',
    website: 'https://bdl-india.in',
    quality_score: 92,
    notes: 'Management Trainee (Mech, ECE, EEE, Civil, CSE). Pay Scale: ₹40,000 - ₹1,40,000 / E-2. Typical CTC: ₹15 - ₹18 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Mishra Dhatu Nigam Limited',
    short_name: 'MIDHANI',
    sector: 'Special Alloys & Strategic Metals',
    org_type: 'Miniratna CPSE',
    careers_url: 'https://midhani-india.in/careers/',
    notification_url: 'https://midhani-india.in/careers/',
    website: 'https://midhani-india.in',
    quality_score: 90,
    notes: 'Management Trainee (Metallurgy, Mech, EEE, ECE). Pay Scale: ₹40,000 - ₹1,40,000. Typical CTC: ₹14.5 - ₹17 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Cochin Shipyard Limited',
    short_name: 'CSL',
    sector: 'Shipbuilding & Marine Engineering',
    org_type: 'Miniratna CPSE',
    careers_url: 'https://cochinshipyard.in/career',
    notification_url: 'https://cochinshipyard.in/career',
    website: 'https://cochinshipyard.in',
    quality_score: 91,
    notes: 'Executive Trainee in Mechanical, Electrical, Electronics, Naval Architecture. Pay Scale: ₹40,000 - ₹1,40,000. Typical CTC: ₹15 - ₹18 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Goa Shipyard Limited',
    short_name: 'GSL',
    sector: 'Defence Shipbuilding',
    org_type: 'Miniratna CPSE',
    careers_url: 'https://goashipyard.in/careers/vacancies/',
    notification_url: 'https://goashipyard.in/careers/vacancies/',
    website: 'https://goashipyard.in',
    quality_score: 89,
    notes: 'Management Trainee (Naval Architecture, Mech, Electrical, IT). Pay Scale: ₹40,000 - ₹1,40,000. Typical CTC: ₹14.5 - ₹16.5 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'BEML Limited',
    short_name: 'BEML',
    sector: 'Heavy Earthmoving, Rail & Metro',
    org_type: 'Miniratna CPSE',
    careers_url: 'https://www.bemlindia.in/current-openings/',
    notification_url: 'https://www.bemlindia.in/current-openings/',
    website: 'https://www.bemlindia.in',
    quality_score: 90,
    notes: 'Management Trainee (Mech, EEE, ECE, Production). Pay Scale: ₹40,000 - ₹1,40,000. Typical CTC: ₹14.5 - ₹17 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Mangalore Refinery and Petrochemicals Limited',
    short_name: 'MRPL',
    sector: 'Refining & Petrochemicals',
    org_type: 'Miniratna CPSE',
    careers_url: 'https://www.mrpl.co.in/careers',
    notification_url: 'https://www.mrpl.co.in/careers',
    website: 'https://www.mrpl.co.in',
    quality_score: 92,
    notes: 'Executive Trainee (Chemical, Mechanical, Electrical, Instrumentation, IT). Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹17 - ₹20 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Chennai Petroleum Corporation Limited',
    short_name: 'CPCL',
    sector: 'Refining & Energy',
    org_type: 'Miniratna CPSE',
    careers_url: 'https://cpcl.co.in/people-careers/recruitment-drive/',
    notification_url: 'https://cpcl.co.in/people-careers/recruitment-drive/',
    website: 'https://cpcl.co.in',
    quality_score: 91,
    notes: 'Engineer / Officer in Chemical, Mechanical, Electrical, IT. Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹16 - ₹19 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Brahmaputra Cracker and Polymer Limited',
    short_name: 'BCPL',
    sector: 'Petrochemicals',
    org_type: 'Miniratna CPSE',
    careers_url: 'https://bcplonline.co.in/Careers',
    notification_url: 'https://bcplonline.co.in/Careers',
    website: 'https://bcplonline.co.in',
    quality_score: 89,
    notes: 'Executive Trainee in Chemical, Mechanical, Electrical, IT. Pay Scale: ₹60,000 - ₹1,80,000. Typical CTC: ₹16 - ₹19 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Airports Authority of India',
    short_name: 'AAI',
    sector: 'Civil Aviation & Air Traffic Control',
    org_type: 'Miniratna CPSE',
    careers_url: 'https://www.aai.aero/en/careers/recruitment',
    notification_url: 'https://www.aai.aero/en/careers/recruitment',
    website: 'https://www.aai.aero',
    quality_score: 93,
    notes: 'Junior Executive (Air Traffic Control, Electronics, IT, Civil, Electrical). Pay Scale: ₹40,000 - ₹1,40,000 (E-1). Typical CTC: ₹15 - ₹18.5 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Dedicated Freight Corridor Corporation of India',
    short_name: 'DFCCIL',
    sector: 'Railways Infrastructure',
    org_type: 'Miniratna CPSE',
    careers_url: 'https://dfccil.com/Home/ActiveCareer',
    notification_url: 'https://dfccil.com/Home/ActiveCareer',
    website: 'https://dfccil.com',
    quality_score: 91,
    notes: 'Junior Manager (Civil, Electrical, S&T, IT, Operations). Pay Scale: ₹50,000 - ₹1,60,000 (E-2). Typical CTC: ₹15 - ₹18 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Delhi Metro Rail Corporation',
    short_name: 'DMRC',
    sector: 'Urban Mass Transit',
    org_type: 'Joint Venture PSU',
    careers_url: 'https://www.delhimetrorail.com/career',
    notification_url: 'https://www.delhimetrorail.com/career',
    website: 'https://www.delhimetrorail.com',
    quality_score: 91,
    notes: 'Assistant Manager (Electrical, S&T, Civil, Operations, IT). Pay Scale: ₹50,000 - ₹1,60,000. Typical CTC: ₹15 - ₹18 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'National Highways Authority of India',
    short_name: 'NHAI',
    sector: 'Road Infrastructure',
    org_type: 'Statutory Authority',
    careers_url: 'https://nhai.gov.in/#/vacancies/current',
    notification_url: 'https://nhai.gov.in/#/vacancies/current',
    website: 'https://nhai.gov.in',
    quality_score: 92,
    notes: 'Deputy Manager (Technical / Civil / IT). Pay Level 10 (₹56,100 - ₹1,77,500). Typical CTC: ₹15.5 - ₹18.5 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'National Fertilizers Limited',
    short_name: 'NFL',
    sector: 'Fertilizers & Chemicals',
    org_type: 'Miniratna CPSE',
    careers_url: 'https://www.nationalfertilizers.com/careers',
    notification_url: 'https://www.nationalfertilizers.com/careers',
    website: 'https://www.nationalfertilizers.com',
    quality_score: 89,
    notes: 'Management Trainee in Chemical, Mechanical, Electrical, Instrumentation, IT. Pay Scale: ₹40,000 - ₹1,40,000. Typical CTC: ₹14.5 - ₹16.5 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'IREL (India) Limited',
    short_name: 'IREL',
    sector: 'Strategic Minerals & Rare Earths',
    org_type: 'Miniratna CPSE (DAE)',
    careers_url: 'https://www.irel.co.in/careers',
    notification_url: 'https://www.irel.co.in/careers',
    website: 'https://www.irel.co.in',
    quality_score: 90,
    notes: 'Management Trainee in Mining, Chemical, Mechanical, Electrical. Pay Scale: ₹40,000 - ₹1,40,000. Typical CTC: ₹14.5 - ₹17 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Security Printing and Minting Corporation of India',
    short_name: 'SPMCIL',
    sector: 'Currency, Minting & Security Paper',
    org_type: 'Miniratna CPSE',
    careers_url: 'https://www.spmcil.com/en/careers/',
    notification_url: 'https://www.spmcil.com/en/careers/',
    website: 'https://www.spmcil.com',
    quality_score: 91,
    notes: 'Assistant Manager (Tech Ops, IT, Materials, Electrical). Pay Scale: ₹40,000 - ₹1,40,000 (E-1). Typical CTC: ₹15 - ₹18 LPA.',
    poll_frequency_days: 7
  },

  // ==========================================
  // 4. CENTRAL BANKING & FINANCIAL REGULATORS
  // ==========================================
  {
    name: 'Reserve Bank of India',
    short_name: 'RBI',
    sector: 'Central Banking & Financial Regulation',
    org_type: 'Regulatory / Statutory Body',
    careers_url: 'https://opportunities.rbi.org.in/scripts/vacancies.aspx',
    notification_url: 'https://opportunities.rbi.org.in/',
    website: 'https://www.rbi.org.in',
    quality_score: 99,
    notes: 'Grade B Officer (General / DEPR / DSIM / Information Technology). Starting CTC exceeds ₹28 - ₹32 LPA with Mumbai lease, allowances, and perks.',
    poll_frequency_days: 7
  },
  {
    name: 'Securities and Exchange Board of India',
    short_name: 'SEBI',
    sector: 'Capital Markets Regulation',
    org_type: 'Regulatory / Statutory Body',
    careers_url: 'https://www.sebi.gov.in/sebiweb/other/career.jsp',
    notification_url: 'https://www.sebi.gov.in/sebiweb/other/career.jsp',
    website: 'https://www.sebi.gov.in',
    quality_score: 98,
    notes: 'Officer Grade A (Assistant Manager) in IT, General, Legal, Research. Starting CTC ₹24 - ₹28 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'National Bank for Agriculture and Rural Development',
    short_name: 'NABARD',
    sector: 'Development Finance & Agriculture',
    org_type: 'Statutory Body',
    careers_url: 'https://www.nabard.org/careers-notices.aspx',
    notification_url: 'https://www.nabard.org/careers-notices.aspx',
    website: 'https://www.nabard.org',
    quality_score: 96,
    notes: 'Assistant Manager (Grade A) in Information Technology, General, Finance. Starting CTC ₹18 - ₹22 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Small Industries Development Bank of India',
    short_name: 'SIDBI',
    sector: 'MSME Development Finance',
    org_type: 'Statutory Body',
    careers_url: 'https://www.sidbi.in/en/careers',
    notification_url: 'https://www.sidbi.in/en/careers',
    website: 'https://www.sidbi.in',
    quality_score: 95,
    notes: 'Assistant Manager (Grade A) in General & IT streams. Starting CTC ₹18 - ₹22 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Export-Import Bank of India',
    short_name: 'EXIM Bank',
    sector: 'International Trade & Finance',
    org_type: 'Statutory Body',
    careers_url: 'https://www.eximbankindia.in/careers',
    notification_url: 'https://www.eximbankindia.in/careers',
    website: 'https://www.eximbankindia.in',
    quality_score: 95,
    notes: 'Management Trainee / Deputy Manager (IT, International Trade, Credit). Starting CTC ₹18 - ₹21 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Insurance Regulatory and Development Authority of India',
    short_name: 'IRDAI',
    sector: 'Insurance Regulation',
    org_type: 'Regulatory / Statutory Body',
    careers_url: 'https://irdai.gov.in/careers',
    notification_url: 'https://irdai.gov.in/careers',
    website: 'https://irdai.gov.in',
    quality_score: 96,
    notes: 'Assistant Manager in IT, Actuarial, General. Starting CTC ₹20 - ₹25 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Pension Fund Regulatory and Development Authority',
    short_name: 'PFRDA',
    sector: 'Pension Regulation',
    org_type: 'Regulatory / Statutory Body',
    careers_url: 'https://www.pfrda.org.in/index1.cshtml?lsid=78',
    notification_url: 'https://www.pfrda.org.in/index1.cshtml?lsid=78',
    website: 'https://www.pfrda.org.in',
    quality_score: 95,
    notes: 'Officer Grade A (Assistant Manager) in IT, Finance, General. Starting CTC ₹20 - ₹24 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'ECGC Limited',
    short_name: 'ECGC',
    sector: 'Export Insurance & Trade',
    org_type: 'CPSE',
    careers_url: 'https://www.ecgc.in/career/',
    notification_url: 'https://www.ecgc.in/career/',
    website: 'https://www.ecgc.in',
    quality_score: 93,
    notes: 'Probationary Officer (Executive Officer). Pay Scale: ₹53,600 - ₹1,02,900. Typical CTC: ₹16 - ₹19.5 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'State Bank of India',
    short_name: 'SBI',
    sector: 'Public Sector Banking',
    org_type: 'Statutory Banking Corporation',
    careers_url: 'https://sbi.co.in/web/careers/current-openings',
    notification_url: 'https://sbi.co.in/web/careers/current-openings',
    website: 'https://sbi.co.in',
    quality_score: 95,
    notes: 'Probationary Officer (PO) & Specialist Cadre Officer (SCO - Cloud Architect, DevOps, Security). CTC: ₹16 - ₹24 LPA.',
    poll_frequency_days: 7
  },

  // ==========================================
  // 5. STRATEGIC R&D, SPACE, DEFENCE & SCIENTIFIC
  // ==========================================
  {
    name: 'Indian Space Research Organisation',
    short_name: 'ISRO',
    sector: 'Space & Satellite Technology',
    org_type: 'Department of Space (Govt of India)',
    careers_url: 'https://www.isro.gov.in/Careers.html',
    notification_url: 'https://www.isro.gov.in/CurrentOpportunities.html',
    website: 'https://www.isro.gov.in',
    quality_score: 98,
    notes: "Scientist/Engineer 'SC' (ICRB / Direct). 7th CPC Pay Matrix Level 10 (₹56,100 - ₹1,77,500). Gross CTC ₹15 - ₹18 LPA with HRA & PRIS incentives.",
    poll_frequency_days: 7
  },
  {
    name: 'Vikram Sarabhai Space Centre',
    short_name: 'VSSC',
    sector: 'Space Launch Vehicles',
    org_type: 'ISRO Lead Centre',
    careers_url: 'https://www.vssc.gov.in/recruitment.html',
    notification_url: 'https://www.vssc.gov.in/recruitment.html',
    website: 'https://www.vssc.gov.in',
    quality_score: 97,
    notes: "Scientist/Engineer 'SC' (Level 10: ₹56,100 - ₹1,77,500). Launch vehicle avionics, propulsion, guidance & flight software. CTC ~₹15 - ₹18 LPA.",
    poll_frequency_days: 7
  },
  {
    name: 'U R Rao Satellite Centre',
    short_name: 'URSC',
    sector: 'Satellite Systems & Payload',
    org_type: 'ISRO Lead Centre',
    careers_url: 'https://www.ursc.gov.in/careers/',
    notification_url: 'https://www.ursc.gov.in/careers/',
    website: 'https://www.ursc.gov.in',
    quality_score: 97,
    notes: "Scientist/Engineer 'SC' (Level 10). Spacecraft electronics, satellite bus, computing systems. CTC ~₹15 - ₹18 LPA.",
    poll_frequency_days: 7
  },
  {
    name: 'Space Applications Centre',
    short_name: 'SAC',
    sector: 'Remote Sensing & Satcom Payloads',
    org_type: 'ISRO Lead Centre',
    careers_url: 'https://www.sac.gov.in/Vyom/recruitment.jsp',
    notification_url: 'https://www.sac.gov.in/Vyom/recruitment.jsp',
    website: 'https://www.sac.gov.in',
    quality_score: 96,
    notes: "Scientist/Engineer 'SC' (Level 10). AI/ML, computer vision, satellite communications. CTC ~₹15 - ₹18 LPA.",
    poll_frequency_days: 7
  },
  {
    name: 'IN-SPACe (Indian National Space Promotion and Authorization Centre)',
    short_name: 'IN-SPACe',
    sector: 'Space Technology & Commercial Space',
    org_type: 'Autonomous Agency (Dept of Space)',
    careers_url: 'https://www.inspace.gov.in/inspace?id=inspace_careers',
    notification_url: 'https://www.inspace.gov.in/inspace?id=inspace_careers',
    website: 'https://www.inspace.gov.in',
    quality_score: 95,
    notes: 'Deputy Director, Lead Systems Architect, Space Systems Engineer. CTC ₹16 - ₹24 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Defence Research and Development Organisation',
    short_name: 'DRDO',
    sector: 'Defence R&D & Strategic Systems',
    org_type: 'Ministry of Defence (Govt of India)',
    careers_url: 'https://rac.gov.in/',
    notification_url: 'https://rac.gov.in/index.php?lang=en&id=0',
    website: 'https://www.drdo.gov.in',
    quality_score: 97,
    notes: "Scientist 'B' recruited via Recruitment and Assessment Centre (RAC). 7th CPC Level 10 (₹56,100 - ₹1,77,500). Gross CTC ₹15 - ₹18.5 LPA + PRIS.",
    poll_frequency_days: 7
  },
  {
    name: 'National Informatics Centre',
    short_name: 'NIC',
    sector: 'Govt IT & Cloud Infrastructure',
    org_type: 'Ministry of Electronics & IT (MeitY)',
    careers_url: 'https://recruitment.nic.in/',
    notification_url: 'https://www.calicut.nielit.in/nic21/',
    website: 'https://www.nic.in',
    quality_score: 95,
    notes: "Scientist 'B' & Scientific/Technical Assistant 'A' (MeitY). 7th CPC Level 10 (₹56,100 - ₹1,77,500). Gross CTC ₹15 - ₹18 LPA.",
    poll_frequency_days: 7
  },
  {
    name: 'Bhabha Atomic Research Centre',
    short_name: 'BARC',
    sector: 'Atomic Energy & Nuclear R&D',
    org_type: 'Department of Atomic Energy (DAE)',
    careers_url: 'https://www.barcocenter.gov.in/',
    notification_url: 'https://barcrecruit.gov.in/',
    website: 'https://www.barc.gov.in',
    quality_score: 97,
    notes: "Scientific Officer 'C' via OCES / DGFS / Direct. Level 10 (₹56,100 - ₹1,77,500). Gross CTC ₹16 - ₹19.5 LPA.",
    poll_frequency_days: 7
  },
  {
    name: 'Indira Gandhi Centre for Atomic Research',
    short_name: 'IGCAR',
    sector: 'Fast Reactor & Nuclear R&D',
    org_type: 'Department of Atomic Energy (DAE)',
    careers_url: 'https://www.igcar.gov.in/recruitment/',
    notification_url: 'https://www.igcar.gov.in/recruitment/',
    website: 'https://www.igcar.gov.in',
    quality_score: 94,
    notes: "Scientific Officer 'C' (Level 10: ₹56,100 - ₹1,77,500). Typical CTC: ₹15.5 - ₹18.5 LPA.",
    poll_frequency_days: 7
  },
  {
    name: 'Centre for Development of Telematics',
    short_name: 'C-DOT',
    sector: 'Telecom, 5G & Cyber Systems',
    org_type: 'Autonomous Telecom R&D (DoT)',
    careers_url: 'https://www.cdot.in/cdotweb/web/careers.php',
    notification_url: 'https://www.cdot.in/cdotweb/web/careers.php',
    website: 'https://www.cdot.in',
    quality_score: 94,
    notes: 'Research Engineers in 5G, Optical, Cloud & Telecom Software. CTC: ₹16 - ₹22 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Council of Scientific and Industrial Research',
    short_name: 'CSIR',
    sector: 'Scientific & Industrial Research',
    org_type: 'Autonomous R&D (DSIR)',
    careers_url: 'https://www.csir.res.in/career-opportunities',
    notification_url: 'https://www.csir.res.in/notifications',
    website: 'https://www.csir.res.in',
    quality_score: 93,
    notes: 'Scientist (Level 11: ₹67,700 - ₹2,08,700) / Senior Scientist across 37 CSIR national laboratories. Gross CTC ₹16 - ₹20 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'National Technical Research Organisation',
    short_name: 'NTRO',
    sector: 'Geospatial & Cyber Intelligence',
    org_type: "Cabinet Secretariat / PMO",
    careers_url: 'https://ntro.gov.in/ntroWeb/loadRecruitmentsHome.do',
    notification_url: 'https://ntro.gov.in/',
    website: 'https://ntro.gov.in',
    quality_score: 97,
    notes: "Scientist 'B' & Technical Officer in Cyber, Satcom, Cryptology. 7th CPC Level 10 (₹56,100 - ₹1,77,500) + 20% Special Security Allowance. CTC ₹17 - ₹21 LPA.",
    poll_frequency_days: 7
  },
  {
    name: 'Bureau of Indian Standards',
    short_name: 'BIS',
    sector: 'Standards & Quality Certification',
    org_type: 'Statutory Body (Consumer Affairs)',
    careers_url: 'https://www.services.bis.gov.in/php/BIS_2.0/bis_core/careers/',
    notification_url: 'https://www.bis.gov.in/career-opportunity/',
    website: 'https://www.bis.gov.in',
    quality_score: 93,
    notes: 'Scientist-B in Computer, Mechanical, Electrical, Civil, Chemical. 7th CPC Level 10 (₹56,100 - ₹1,77,500). Gross CTC ₹15.5 - ₹18.5 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'Society for Applied Microwave Electronics Engineering & Research',
    short_name: 'SAMEER',
    sector: 'RF, Microwave & Radar R&D',
    org_type: 'Autonomous R&D (MeitY)',
    careers_url: 'https://www.sameer.gov.in/recruitment',
    notification_url: 'https://www.sameer.gov.in/recruitment',
    website: 'https://www.sameer.gov.in',
    quality_score: 92,
    notes: "Scientist 'B' in RF, Microwave, Cloud, DSP. 7th CPC Level 10. Typical CTC: ₹15 - ₹18 LPA.",
    poll_frequency_days: 7
  },
  {
    name: 'Centre for Railway Information Systems',
    short_name: 'CRIS',
    sector: 'Railways IT & Enterprise Cloud',
    org_type: 'Autonomous Society (Ministry of Railways)',
    careers_url: 'https://cris.org.in/crisweb/design1/index.jsp',
    notification_url: 'https://cris.org.in/',
    website: 'https://cris.org.in',
    quality_score: 94,
    notes: 'Assistant Software Engineer (ASE) / Assistant Data Analyst (ADA). Pay Scale: ₹60,000 - ₹1,80,000 (7th CPC Level 7 / E-2). Typical CTC: ₹16 - ₹19 LPA.',
    poll_frequency_days: 7
  },
  {
    name: 'ERNET India',
    short_name: 'ERNET',
    sector: 'Education & Research Networking',
    org_type: 'Autonomous Society (MeitY)',
    careers_url: 'https://ernet.in/careers',
    notification_url: 'https://ernet.in/careers',
    website: 'https://ernet.in',
    quality_score: 90,
    notes: 'Scientific Officer & Senior Systems Engineer. Level 10 (CTC ~₹15 - ₹17.5 LPA).',
    poll_frequency_days: 7
  },
  {
    name: 'Centre for Development of Advanced Computing',
    short_name: 'C-DAC',
    sector: 'IT & High Performance Computing',
    org_type: 'Autonomous Society (MeitY)',
    careers_url: 'https://www.cdac.in/index.aspx?id=current_jobs',
    notification_url: 'https://www.cdac.in/index.aspx?id=current_jobs',
    website: 'https://www.cdac.in',
    quality_score: 93,
    notes: 'Project Engineer, Senior Project Engineer, Principal Engineer. Pay: ₹12,00,000 - ₹18,00,000 consolidated.',
    poll_frequency_days: 7
  }
];

async function seedOrganizations(targetPool) {
  const pool = targetPool || defaultPool;

  console.log(`Starting PSU & Premier Org Registry population (${ORG_REGISTRY.length} organizations)...`);

  let insertedCount = 0;
  let updatedCount = 0;

  for (const org of ORG_REGISTRY) {
    // Check if exists by name or short_name
    const [existing] = await pool.query(
      'SELECT id, name FROM jobhunt_organizations WHERE name = ? OR short_name = ? LIMIT 1',
      [org.name, org.short_name]
    );

    if (existing.length > 0) {
      const existingId = existing[0].id;
      await pool.query(
        `UPDATE jobhunt_organizations SET
          name = ?,
          short_name = ?,
          sector = ?,
          org_type = ?,
          careers_url = ?,
          notification_url = ?,
          website = ?,
          quality_score = ?,
          notes = ?,
          poll_frequency_days = ?,
          is_active = 1
         WHERE id = ?`,
        [
          org.name,
          org.short_name,
          org.sector,
          org.org_type,
          org.careers_url,
          org.notification_url || org.careers_url,
          org.website,
          org.quality_score,
          org.notes,
          org.poll_frequency_days || 7,
          existingId
        ]
      );
      updatedCount++;
    } else {
      await pool.query(
        `INSERT INTO jobhunt_organizations
          (name, short_name, sector, org_type, careers_url, notification_url, website, quality_score, notes, poll_frequency_days, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          org.name,
          org.short_name,
          org.sector,
          org.org_type,
          org.careers_url,
          org.notification_url || org.careers_url,
          org.website,
          org.quality_score,
          org.notes,
          org.poll_frequency_days || 7
        ]
      );
      insertedCount++;
    }
  }

  // Deactivate dummy "Not Specified" record if present
  await pool.query('UPDATE jobhunt_organizations SET is_active = 0 WHERE name = "Not Specified"');

  const [[{ activeCount }]] = await pool.query('SELECT COUNT(*) AS activeCount FROM jobhunt_organizations WHERE is_active = 1');
  const [sectors] = await pool.query('SELECT sector, COUNT(*) AS count FROM jobhunt_organizations WHERE is_active = 1 GROUP BY sector ORDER BY count DESC');

  console.log(`\n✓ Seeding complete!`);
  console.log(`- Inserted: ${insertedCount}`);
  console.log(`- Updated: ${updatedCount}`);
  console.log(`- Total Active Organizations: ${activeCount}`);
  console.log(`\nSectors Breakdown:`);
  if (!targetPool && require.main === module) {
    await pool.end();
  }
}

if (require.main === module) {
  seedOrganizations().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}

module.exports = { seedOrganizations, ORG_REGISTRY };
