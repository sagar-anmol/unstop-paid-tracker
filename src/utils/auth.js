// src/utils/auth.js
// TechFEST '26 Role-Based Access Control (RBAC), 13 Domains Directory & Official Logins
import { 
  fetchCustomPasswordsFromNeon, 
  writeCustomPasswordHashToNeon, 
  deleteCustomPasswordFromNeon,
  fetchPanelUsersFromNeon,
  writePanelUserToNeon,
  setPanelUserActiveInNeon,
  deletePanelUserFromNeon
} from './neonDb.js';
import { recordLoginSession } from './device.js';

export const DOMAINS_DIRECTORY = {
  robozar: {
    id: 'robozar',
    name: 'RoboZar',
    bay: 'BAY-RZ01',
    category: 'Robotics & Combat',
    department: 'Robotics & Automation',
    tagline: 'Full-Contact Mecha Battles, Drones & Autonomous Navigation',
    accentColor: '#38BDF8',
    events: [
      'RoboSoccer',
      'RC Car',
      'Sky Maneuver',
      'Robowar',
      'Hovermania',
      'RC Boat',
      'Rapid Line',
      'Micromouse Challenge'
    ],
    aliases: [
      'RC Car Race',
      'Robowars',
      'Hover-Mania',
      'Remote Control Surface Boat Race',
      'Rapid Line (LFR)',
      'Robo Soccer'
    ]
  },
  plexus: {
    id: 'plexus',
    name: 'Plexus',
    bay: 'BAY-PX02',
    category: 'Computer Science & AI',
    department: 'Computer Science & Engineering',
    tagline: 'Competitive Coding, AI Systems, Reverse Engineering & Web Sprints',
    accentColor: '#818CF8',
    events: [
      'The Neural Nexus',
      'Debug and Deploy',
      'Pixel Wizard',
      'Heuristic Havoc',
      'The Aqua-Epoch',
      'Ghost Code'
    ],
    aliases: [
      'Debug & Deploy',
      'Aqua-Epoch'
    ]
  },
  karyarachna: {
    id: 'karyarachna',
    name: 'Karyarachna',
    bay: 'BAY-KR03',
    category: 'Innovation & Prototyping',
    department: 'Innovation & Incubation Hub',
    tagline: 'Circular Prototyping, 36h Hackathon & Sustainable Jugaad',
    accentColor: '#C084FC',
    events: [
      'Kritrim - Model Exhibition',
      'Hackathon',
      'Jugaad'
    ],
    aliases: [
      'Kritrim- Model Exhibition',
      'Kritrim'
    ]
  },
  kermis: {
    id: 'kermis',
    name: 'Kermis',
    bay: 'BAY-KM04',
    category: 'Esports & Strategy',
    department: 'Digital Gaming & Mind Sports',
    tagline: 'Battle Royale Esports (BGMI, Free Fire) & Rapid Chess League',
    accentColor: '#F472B6',
    events: [
      'BGMI',
      'Free Fire',
      'Chess'
    ],
    aliases: []
  },
  genesis: {
    id: 'genesis',
    name: 'Genesis',
    bay: 'BAY-GN05',
    category: 'Business & Startups',
    department: 'Management & Entrepreneurship',
    tagline: 'Venture Pitches, Case Cracks, Brand Marketing & ESG Strategy',
    accentColor: '#FBBF24',
    events: [
      'Pitchverse - Virtual Strategy',
      'Case Crack',
      'Brand Blitz',
      'Case Ethical Crosstalk'
    ],
    aliases: [
      'Pitchverse',
      'Ethical Crosstalk'
    ]
  },
  electronica: {
    id: 'electronica',
    name: 'Electronica',
    bay: 'BAY-EC06',
    category: 'Electronics & IoT',
    department: 'Electronics & Communication Engineering',
    tagline: 'Micro-Power Silicon, IoT Sensors & Hardware Prototyping',
    accentColor: '#34D399',
    events: [
      'Circuit Craft',
      'Innovation-X',
      'Arduino Imagino',
      'Digital Design Challenge'
    ],
    aliases: []
  },
  electrica: {
    id: 'electrica',
    name: 'Electrica',
    bay: 'BAY-EL07',
    category: 'Electrical & Energy',
    department: 'Electrical & Instrumentation Engineering',
    tagline: 'Net-Zero Power Grids, Soldering Speedruns & Wireless Power Transfer',
    accentColor: '#F59E0B',
    events: [
      'Soldering Speedrun',
      'Breadboard Battle',
      'Grid Masters-SLD Challenge',
      'WPTC - Wireless Power Transfer'
    ],
    aliases: [
      'Grid Masters - SLD Challenge'
    ]
  },
  mechanica: {
    id: 'mechanica',
    name: 'Mechanica',
    bay: 'BAY-MC08',
    category: 'Mechanical Engineering',
    department: 'Mechanical Engineering & Fabrication',
    tagline: 'Precision 3D CAD Modeling, High-Load Hydraulics & Mechnovate',
    accentColor: '#FB923C',
    events: [
      'Designare',
      'Hydraload',
      'Fabriquer',
      'Mechnovate'
    ],
    aliases: []
  },
  chemica: {
    id: 'chemica',
    name: 'Chemica',
    bay: 'BAY-CH09',
    category: 'Chemical Technology',
    department: 'Chemical Engineering & Bio-Polymers',
    tagline: 'Green Bio-Polymers, Chemi-Thon, Soap Formulations & Analytical Mystery',
    accentColor: '#A78BFA',
    events: [
      'Chemi-Thone',
      'Soap Making',
      'Jam Session',
      'Chemi-Mystery',
      'Chemi Craft',
      'Poster and Paper Presentation'
    ],
    aliases: [
      'Chemi-Craft',
      'Paper and Poster Presentation'
    ]
  },
  civicon: {
    id: 'civicon',
    name: 'Civicon',
    bay: 'BAY-CV10',
    category: 'Civil & Smart Cities',
    department: 'Civil Engineering & Infrastructure',
    tagline: 'Net-Zero Architecture, Truss Analysis, City Modeling & Seismic Design',
    accentColor: '#2DD4BF',
    events: [
      'Truss Load',
      'City Model Exhibition',
      'Seismic Challenge',
      'CAD Design Challenge',
      'Technical Quiz Competition',
      'Poster Presentation'
    ],
    aliases: [
      'City Model Exibition',
      'Technical Quiz Competation'
    ]
  },
  inventia: {
    id: 'inventia',
    name: 'Inventia',
    bay: 'BAY-IN11',
    category: 'Interdisciplinary Innovation',
    department: 'Sciences & Interdisciplinary Technologies',
    tagline: 'Cross-Disciplinary Earth Solutions, Smart Agriculture & Techno-Vation',
    accentColor: '#4ADE80',
    events: [
      'Smart Agriculture (SM-Agri)',
      'Techno-Vation',
      'Cognitive Challenges'
    ],
    aliases: [
      'Ideathon',
      'SM-Agri',
      'Smart Agriculture'
    ]
  },
  foodocrats: {
    id: 'foodocrats',
    name: 'Food-O-Crats',
    bay: 'BAY-FC12',
    category: 'Food Tech & Agriculture',
    department: 'Food Engineering & Precision Nutrition',
    tagline: 'Precision Food Preservation, Nutritional Forensics & Foodprint',
    accentColor: '#E879F9',
    events: [
      'Food Forge',
      'Food Forensics',
      'Clue Craze',
      'Foodprint',
      'Tech4Earth'
    ],
    aliases: []
  },
  atomheimer: {
    id: 'atomheimer',
    name: 'Atomheimer',
    bay: 'BAY-AT13',
    category: 'Applied Sciences & Physics',
    department: 'Physics, Chemistry & Applied Sciences',
    tagline: 'Financial Modeling (The Big Bull), Aqua Aerodynamics & Science Quizzes',
    accentColor: '#60A5FA',
    events: [
      'Quiz Nova',
      'Aqua Clean',
      'Splash Rocket',
      'Aerostrike',
      'The Big Bull'
    ],
    aliases: [
      'The Big Bull (Diploma Students Only)'
    ]
  }
};

// Shared initial password for the hardcoded accounts. Every account is forced to
// replace it at first sign-in. Runtime accounts created from the Team tab use
// NEW_ACCOUNT_INITIAL_PASSWORD and get the same forced change.
export const DEFAULT_INITIAL_PASSWORD = 'Techfest@2026';
export const NEW_ACCOUNT_INITIAL_PASSWORD = 'techfest@123';

// OFFICIAL ACCOUNTS (2 Admins + 1 WebDev + 1 Outreach Desk + 13 Domain Leads)
export const OFFICIAL_ACCOUNTS = [
  // 1 & 2: Central Super Admins (Full master access to all domains, settings & database)
  {
    username: 'sagaranmol@gmail.com',
    aliasUsername: 'sagar',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Sagar Anmol',
    email: 'sagaranmol@gmail.com',
    phone: '7366879486',
    role: 'super_admin',
    accountType: 'admin',
    team: 'central',
    teamName: 'Central Desk',
    title: 'Lead Organizer & Central Desk Head',
    domainId: null,
    avatar: 'SA',
    description: 'Master organizer access across all 13 domains, registrations, calling teams, and gateway verifications.'
  },
  {
    username: 'raj.aryan@gmail.com',
    aliasUsername: 'raj.aryan9242@gmail.com',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Raj Aryan',
    email: 'raj.aryan9242@gmail.com',
    phone: '9288522520',
    role: 'super_admin',
    accountType: 'admin',
    team: 'central',
    teamName: 'Central Desk & Web Dev',
    title: 'Central Tech & Web Dev Member',
    domainId: null,
    avatar: 'RA',
    description: 'Master access across all 13 domains, 62 events, calling logs & audit trails.'
  },

  // 3: Web Developer / Operations Editor (Can view & edit candidate payment statuses & records)
  {
    username: 'webdev@gmail.com',
    aliasUsername: 'webdev',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Web Dev & Operations Editor',
    email: 'webdev@gmail.com',
    role: 'webdev',
    accountType: 'webdev',
    team: 'webdev',
    teamName: 'Web & Tech Team',
    title: 'Operations Editor (Payment & Candidate Records)',
    domainId: null,
    avatar: 'WD',
    description: 'Editor access to view and update attendee records, payment statuses, and notes across all competitions.'
  },

  // 4: Combined Reception & Outreach Desk 1
  {
    username: 'outreach@gmail.com',
    aliasUsername: 'outreach@sliet',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Reception & Outreach Calling Desk 1',
    email: 'outreach@gmail.com',
    role: 'operations_calling',
    accountType: 'operations',
    team: 'outreach',
    teamName: 'Reception & Outreach Team',
    title: 'Participant Calling & Spot Registration Desk 1',
    domainId: null,
    avatar: 'O1',
    description: 'Unified front-desk reception and outbound calling operations across all events.'
  },

  // 5: Reception & Outreach Desk 2
  {
    username: 'outreach1@gmail.com',
    aliasUsername: 'outreach1@sliet',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Reception & Outreach Calling Desk 2',
    email: 'outreach1@gmail.com',
    role: 'operations_calling',
    accountType: 'operations',
    team: 'outreach',
    teamName: 'Reception & Outreach Team',
    title: 'Participant Calling & Spot Registration Desk 2',
    domainId: null,
    avatar: 'O2',
    description: 'Outbound participant calling and spot registration desk across all events.'
  },

  // 5-17: 13 Domain Leads (Live official email credentials)
  {
    username: 'nayan98351@gmail.com',
    aliasUsername: 'robozar',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Nayan Kumar',
    email: 'nayan98351@gmail.com',
    role: 'domain_head',
    accountType: 'domain',
    domainId: 'robozar',
    domainName: 'RoboZar',
    bay: 'BAY-RZ01',
    team: 'robozar',
    teamName: 'RoboZar Domain',
    title: 'Head of Robotics & Combat Domain',
    avatar: 'RZ'
  },
  {
    username: 'sumitbansal1290@gmail.com',
    aliasUsername: 'plexus',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Sumit Bansal',
    email: 'sumitbansal1290@gmail.com',
    role: 'domain_head',
    accountType: 'domain',
    domainId: 'plexus',
    domainName: 'Plexus',
    bay: 'BAY-PX02',
    team: 'plexus',
    teamName: 'Plexus Domain',
    title: 'Head of Computer Science & AI Domain',
    avatar: 'PX'
  },
  {
    username: 'anilkumawat01612@gmail.com',
    aliasUsername: 'civicon',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'ANIL KUMAWAT',
    email: 'anilkumawat01612@gmail.com',
    role: 'domain_head',
    accountType: 'domain',
    domainId: 'civicon',
    domainName: 'Civicon',
    bay: 'BAY-CV10',
    team: 'civicon',
    teamName: 'Civicon Domain',
    title: 'Head of Civil & Smart Architecture Domain',
    avatar: 'CV'
  },
  {
    username: 'let.mail.amit@gmail.com',
    aliasUsername: 'chemica',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Amit Kumar',
    email: 'let.mail.amit@gmail.com',
    role: 'domain_head',
    accountType: 'domain',
    domainId: 'chemica',
    domainName: 'Chemica',
    bay: 'BAY-CH09',
    team: 'chemica',
    teamName: 'Chemica Domain',
    title: 'Head of Chemical & Bio-Polymer Domain',
    avatar: 'CH'
  },
  {
    username: 'granthicksarkar@gmail.com',
    aliasUsername: 'foodocrats',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Granthick Sarkar',
    email: 'granthicksarkar@gmail.com',
    role: 'domain_head',
    accountType: 'domain',
    domainId: 'foodocrats',
    domainName: 'Food-O-Crats',
    bay: 'BAY-FC12',
    team: 'foodocrats',
    teamName: 'Food-O-Crats Domain',
    title: 'Head of Food Engineering & Agri Domain',
    avatar: 'FC'
  },
  {
    username: 'aishakumariabm@gmail.com',
    aliasUsername: 'atomheimer',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Aisha Kumari',
    email: 'aishakumariabm@gmail.com',
    role: 'domain_head',
    accountType: 'domain',
    domainId: 'atomheimer',
    domainName: 'Atomheimer',
    bay: 'BAY-AT13',
    team: 'atomheimer',
    teamName: 'Atomheimer Domain',
    title: 'Head of Applied Sciences & Physics Domain',
    avatar: 'AT'
  },
  {
    username: 'pawantanay01@gmail.com',
    aliasUsername: 'electrica',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Pawan Tanay',
    email: 'pawantanay01@gmail.com',
    role: 'domain_head',
    accountType: 'domain',
    domainId: 'electrica',
    domainName: 'Electrica',
    bay: 'BAY-EL07',
    team: 'electrica',
    teamName: 'Electrica Domain',
    title: 'Head of Electrical & Clean Energy Domain',
    avatar: 'EL'
  },
  {
    username: 'adityaz754934@gmail.com',
    aliasUsername: 'mechanica',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Aditya Raj',
    email: 'adityaz754934@gmail.com',
    role: 'domain_head',
    accountType: 'domain',
    domainId: 'mechanica',
    domainName: 'Mechanica',
    bay: 'BAY-MC08',
    team: 'mechanica',
    teamName: 'Mechanica Domain',
    title: 'Head of Mechanical & Fabrication Domain',
    avatar: 'MC'
  },
  {
    username: 'anupamlashkari852220@gmail.com',
    aliasUsername: 'electronica',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Anupam Kumar',
    email: 'anupamlashkari852220@gmail.com',
    role: 'domain_head',
    accountType: 'domain',
    domainId: 'electronica',
    domainName: 'Electronica',
    bay: 'BAY-EC06',
    team: 'electronica',
    teamName: 'Electronica Domain',
    title: 'Head of Electronics & IoT Arena',
    avatar: 'EC'
  },
  {
    username: 'pritambarman642@gmail.com',
    aliasUsername: 'karyarachna',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'PRITAM BARMAN',
    email: 'pritambarman642@gmail.com',
    role: 'domain_head',
    accountType: 'domain',
    domainId: 'karyarachna',
    domainName: 'Karyarachna',
    bay: 'BAY-KR03',
    team: 'karyarachna',
    teamName: 'Karyarachna Domain',
    title: 'Head of Innovation & Hackathon Domain',
    avatar: 'KR'
  },
  {
    username: 'apurv6736@gmail.com',
    aliasUsername: 'kermis',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Apurv Raj',
    email: 'apurv6736@gmail.com',
    role: 'domain_head',
    accountType: 'domain',
    domainId: 'kermis',
    domainName: 'Kermis',
    bay: 'BAY-KM04',
    team: 'kermis',
    teamName: 'Kermis Domain',
    title: 'Head of Esports & Gaming League',
    avatar: 'KM'
  },
  {
    username: 'tarunishere0@gmail.com',
    aliasUsername: 'inventia',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Tarun Lalwani',
    email: 'tarunishere0@gmail.com',
    role: 'domain_head',
    accountType: 'domain',
    domainId: 'inventia',
    domainName: 'Inventia',
    bay: 'BAY-IN11',
    team: 'inventia',
    teamName: 'Inventia Domain',
    title: 'Head of Interdisciplinary Solutions Domain',
    avatar: 'IN'
  },
  {
    username: 'adityafb7399@gmail.com',
    aliasUsername: 'genesis',
    defaultPassword: DEFAULT_INITIAL_PASSWORD,
    name: 'Aditya Kumar Gupta',
    email: 'adityafb7399@gmail.com',
    role: 'domain_head',
    accountType: 'domain',
    domainId: 'genesis',
    domainName: 'Genesis',
    bay: 'BAY-GN05',
    team: 'genesis',
    teamName: 'Genesis Domain',
    title: 'Head of Business & Startup Incubator',
    avatar: 'GN'
  }
];

const SESSION_STORAGE_KEY = 'tf_auth_session_v5';
const CUSTOM_PASSWORDS_KEY = 'tf_custom_passwords_v4_hashed';
const DYNAMIC_USERS_KEY = 'tf_panel_users_cache';
const HASH_ALGO = 'SHA-256';

// Legacy plaintext store from before hashing was introduced. Read-only, used to
// migrate old entries to hashes and then discarded.
const LEGACY_CUSTOM_PASSWORDS_KEY = 'tf_custom_passwords_v3';

/**
 * SHA-256 helper. Uses WebCrypto when available and falls back to a pure-JS
 * implementation so hashing still works over plain HTTP (GitHub Pages).
 */
async function sha256Hex(message) {
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const data = new TextEncoder().encode(message);
    const digest = await crypto.subtle.digest(HASH_ALGO, data);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return sha256HexFallback(message);
}

// Minimal synchronous SHA-256, only used when crypto.subtle is unavailable.
function sha256HexFallback(message) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const utf8 = unescape(encodeURIComponent(message));
  const bytes = [];
  for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i) & 0xff);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push((bitLen / Math.pow(2, i * 8)) & 0xff);

  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array(64);

  for (let i = 0; i < bytes.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = (bytes[i + t * 4] << 24) | (bytes[i + t * 4 + 1] << 16) | (bytes[i + t * 4 + 2] << 8) | bytes[i + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = (((w[t - 15] >>> 7) | (w[t - 15] << 25)) ^ ((w[t - 15] >>> 18) | (w[t - 15] << 14)) ^ (w[t - 15] >>> 3)) >>> 0;
      const s1 = (((w[t - 2] >>> 17) | (w[t - 2] << 15)) ^ ((w[t - 2] >>> 19) | (w[t - 2] << 13)) ^ (w[t - 2] >>> 10)) >>> 0;
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map(x => x.toString(16).padStart(8, '0')).join('');
}

export function generateSalt() {
  const arr = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt) {
  return sha256Hex(`${salt}:${password}`);
}

/**
 * Returns the stored credential record for a username.
 * Shape: { hash, salt, mustChange } for hashed entries, or a bare string for
 * legacy plaintext entries that have not been migrated yet.
 */
export function getCustomPasswords() {
  try {
    const raw = localStorage.getItem(CUSTOM_PASSWORDS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading custom passwords:', e);
  }
  return {};
}

export function saveCustomPasswords(passwords) {
  try {
    localStorage.setItem(CUSTOM_PASSWORDS_KEY, JSON.stringify(passwords));
  } catch (e) {
    console.error('Error saving custom passwords:', e);
  }
}

/**
 * Reads legacy plaintext passwords and re-hashes them. Runs once per device;
 * afterwards the legacy key is removed so plaintext is not retained.
 */
export async function migrateLegacyPasswords() {
  let legacy = null;
  try {
    const raw = localStorage.getItem(LEGACY_CUSTOM_PASSWORDS_KEY);
    if (raw) legacy = JSON.parse(raw);
  } catch (e) {
    return { migrated: 0 };
  }
  if (!legacy || typeof legacy !== 'object') return { migrated: 0 };

  const current = getCustomPasswords();
  let migrated = 0;

  for (const [username, value] of Object.entries(legacy)) {
    const clean = String(username).toLowerCase().trim();
    if (!clean) continue;
    // Never clobber an existing hash with the older plaintext value
    if (current[clean]) continue;
    if (typeof value !== 'string') continue;
    const salt = generateSalt();
    current[clean] = { hash: await hashPassword(value, salt), salt, mustChange: false };
    migrated++;
  }

  if (migrated > 0) saveCustomPasswords(current);
  try {
    localStorage.removeItem(LEGACY_CUSTOM_PASSWORDS_KEY);
  } catch (e) {
    // non-fatal
  }
  return { migrated };
}

export function getDynamicUsers() {
  try {
    const raw = localStorage.getItem(DYNAMIC_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error loading dynamic users:', e);
  }
  return [];
}

export function saveDynamicUsers(users) {
  try {
    localStorage.setItem(DYNAMIC_USERS_KEY, JSON.stringify(Array.isArray(users) ? users : []));
  } catch (e) {
    console.error('Error saving dynamic users:', e);
  }
}

/**
 * Official accounts always take precedence over dynamically added users, so a
 * runtime-created account can never shadow Raj, Sagar, or the 13 domain heads.
 */
export function getAllAccounts() {
  const official = OFFICIAL_ACCOUNTS;
  const officialKeys = new Set(official.map(a => a.username.toLowerCase()));
  const dynamic = getDynamicUsers().filter(u => !officialKeys.has(String(u.username).toLowerCase()));
  return [...official, ...dynamic];
}

export function findAnyAccount(predicate) {
  return getAllAccounts().find(predicate) || null;
}

export function findAccount(username) {
  const clean = String(username || '').toLowerCase().trim();
  if (!clean) return null;
  return findAnyAccount(a =>
    a.username.toLowerCase() === clean ||
    (a.aliasUsername && a.aliasUsername.toLowerCase() === clean) ||
    (a.email && a.email.toLowerCase() === clean) ||
    a.username.split('@')[0].toLowerCase() === clean
  );
}

export function getPasswordForAccount(username) {
  const custom = getCustomPasswords();
  const clean = username.toLowerCase().trim();
  const entry = custom[clean];
  if (typeof entry === 'string') return entry;

  const acc = findAccount(username);
  return acc?.defaultPassword || DEFAULT_INITIAL_PASSWORD;
}

/**
 * Verifies a plaintext password against the stored credential for an account.
 * Handles hashed entries, legacy plaintext entries, and default passwords.
 */
export async function verifyAccountPassword(account, plaintext) {
  const clean = account.username.toLowerCase().trim();
  const entry = getCustomPasswords()[clean];

  if (entry && typeof entry === 'object' && entry.hash) {
    const candidate = await hashPassword(plaintext, entry.salt);
    return candidate === entry.hash;
  }

  if (typeof entry === 'string') {
    return plaintext === entry;
  }

  const expected = account.defaultPassword || DEFAULT_INITIAL_PASSWORD;
  return plaintext === expected ||
    plaintext === DEFAULT_INITIAL_PASSWORD ||
    plaintext === 'sliet@2026' ||
    plaintext === `${account.username}@sliet` ||
    Boolean(account.aliasUsername && plaintext === `${account.aliasUsername}@sliet`);
}

/**
 * Loads runtime-managed panel users from Neon and caches them locally.
 * Called on app boot; failures leave the hardcoded directory intact.
 */
export async function loadDynamicUsers() {
  try {
    const users = await fetchPanelUsersFromNeon();
    if (Array.isArray(users)) {
      saveDynamicUsers(users);
      return users;
    }
  } catch (e) {
    console.error('Error loading panel users from Neon:', e);
  }
  return getDynamicUsers();
}

/**
 * Creates or updates a runtime-managed user. Super-admin only.
 * The initial password is hashed and flagged mustChange so the account is
 * forced to set its own password on first login.
 */
export async function upsertPanelUser(adminUser, userInput) {
  if (!adminUser || adminUser.role !== 'super_admin') {
    throw new Error('Unauthorized: only Super Admins can manage team accounts.');
  }
  const {
    username,
    displayName,
    role = 'operations_calling',
    domainId = 'ALL',
    teamName = 'Central Operations',
    email = '',
    phone = '',
    canVerifyPayments = false,
    initialPassword,
    notes = ''
  } = userInput || {};

  const clean = String(username || '').toLowerCase().trim();
  if (!clean || !clean.includes('@') && !/^[a-z0-9._-]{3,}$/i.test(clean)) {
    throw new Error('Username must be an email address or a 3+ character handle.');
  }
  if (!displayName || !String(displayName).trim()) {
    throw new Error('Display name is required.');
  }
  if (!['super_admin', 'webdev', 'operations_calling', 'domain_head'].includes(role)) {
    throw new Error('Unknown role.');
  }

  // Hardcoded accounts are managed in code and must not be shadowed
  const official = OFFICIAL_ACCOUNTS.find(a => a.username.toLowerCase() === clean);
  if (official) {
    throw new Error(`"${official.username}" is an official account and cannot be added here.`);
  }

  const record = {
    username: clean,
    displayName: String(displayName).trim(),
    role,
    domainId: role === 'domain_head' ? (domainId || 'ALL') : 'ALL',
    teamName,
    email: String(email || '').trim(),
    phone: String(phone || '').trim(),
    canVerifyPayments: Boolean(canVerifyPayments),
    isActive: true,
    notes: String(notes || '').trim()
  };

  const existing = getDynamicUsers().find(u => String(u.username).toLowerCase() === clean);
  const next = {
    ...record,
    createdBy: existing?.createdBy || adminUser.username,
    createdAt: existing?.createdAt || new Date().toISOString()
  };

  // Initial password: store a hash, force a change on first login
  if (initialPassword && String(initialPassword).trim().length >= 4) {
    const salt = generateSalt();
    const hash = await hashPassword(String(initialPassword).trim(), salt);
    const custom = getCustomPasswords();
    custom[clean] = { hash, salt, mustChange: true };
    saveCustomPasswords(custom);
    await writeCustomPasswordHashToNeon(clean, hash, salt, true, adminUser.username);
  }

  const saved = await writePanelUserToNeon(next);
  const users = getDynamicUsers().filter(u => String(u.username).toLowerCase() !== clean);
  users.push(next);
  saveDynamicUsers(users);

  return saved || next;
}

export async function deactivatePanelUser(adminUser, username) {
  if (!adminUser || adminUser.role !== 'super_admin') {
    throw new Error('Unauthorized: only Super Admins can manage team accounts.');
  }
  const clean = String(username || '').toLowerCase().trim();
  const users = getDynamicUsers().map(u =>
    String(u.username).toLowerCase() === clean ? { ...u, isActive: false } : u
  );
  saveDynamicUsers(users);
  await setPanelUserActiveInNeon(clean, false);
  return true;
}

export async function reactivatePanelUser(adminUser, username) {
  if (!adminUser || adminUser.role !== 'super_admin') {
    throw new Error('Unauthorized: only Super Admins can manage team accounts.');
  }
  const clean = String(username || '').toLowerCase().trim();
  const users = getDynamicUsers().map(u =>
    String(u.username).toLowerCase() === clean ? { ...u, isActive: true } : u
  );
  saveDynamicUsers(users);
  await setPanelUserActiveInNeon(clean, true);
  return true;
}

export async function removePanelUser(adminUser, username) {
  if (!adminUser || adminUser.role !== 'super_admin') {
    throw new Error('Unauthorized: only Super Admins can manage team accounts.');
  }
  const clean = String(username || '').toLowerCase().trim();
  saveDynamicUsers(getDynamicUsers().filter(u => String(u.username).toLowerCase() !== clean));

  const custom = getCustomPasswords();
  delete custom[clean];
  saveCustomPasswords(custom);

  await deletePanelUserFromNeon(clean);
  await deleteCustomPasswordFromNeon(clean);
  return true;
}

/**
 * Checks if an account is still on the initial default password
 */
export function isUserUsingDefaultPassword(username) {
  if (!username) return false;
  const custom = getCustomPasswords();
  const clean = username.toLowerCase().trim();
  const entry = custom[clean];

  if (entry && typeof entry === 'object') {
    return Boolean(entry.mustChange);
  }
  if (typeof entry === 'string') {
    return entry === DEFAULT_INITIAL_PASSWORD || entry === 'sliet@2026';
  }
  return true;
}

/**
 * Allows the active user to set their personal new password.
 * Stores a salted SHA-256 hash and clears the forced-change flag.
 */
export async function updateUserOwnPassword(username, newPassword) {
  if (!username || !newPassword || newPassword.trim().length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const clean = username.toLowerCase().trim();
  const salt = generateSalt();
  const hash = await hashPassword(newPassword.trim(), salt);

  const custom = getCustomPasswords();
  custom[clean] = { hash, salt, mustChange: false };
  saveCustomPasswords(custom);

  writeCustomPasswordHashToNeon(clean, hash, salt, false, clean)
    .catch(e => console.error('Neon writeCustomPasswordHash note:', e));

  return true;
}

/**
 * RBAC Helper: Checks if the user has permission to edit attendee records
 */
export function canEditParticipants(user) {
  if (!user) return false;
  return user.role === 'super_admin' || user.role === 'webdev';
}

/**
 * RBAC Helper: Checks if the user has full Super Admin powers
 */
export function isSuperAdmin(user) {
  if (!user) return false;
  return user.role === 'super_admin';
}

/**
 * Sync credential hashes from Neon PostgreSQL.
 * Plaintext legacy rows are converted to hashes on arrival so plaintext is
 * never persisted locally.
 */
export async function syncPasswordsWithNeon() {
  try {
    await migrateLegacyPasswords();

    const cloudPasswords = await fetchCustomPasswordsFromNeon();
    if (cloudPasswords && Object.keys(cloudPasswords).length > 0) {
      const local = getCustomPasswords();
      let converted = 0;

      const incoming = {};
      for (const [username, value] of Object.entries(cloudPasswords)) {
        const clean = String(username).toLowerCase().trim();
        if (!clean) continue;

        if (value && typeof value === 'object' && value.hash) {
          incoming[clean] = value;
          continue;
        }

        if (typeof value === 'string' && value) {
          const salt = generateSalt();
          incoming[clean] = { hash: await hashPassword(value, salt), salt, mustChange: false };
          converted++;
        }
      }

      saveCustomPasswords({ ...local, ...incoming });
      if (converted > 0) {
        console.info(`Migrated ${converted} plaintext password(s) from Neon to hashed form.`);
      }
    }
  } catch (err) {
    console.error('Error syncing passwords with Neon:', err);
  }
}

/**
 * Checks if an account has an active custom password set
 */
export function hasAccountCustomPassword(username) {
  if (!username) return false;
  const custom = getCustomPasswords();
  const clean = username.toLowerCase().trim();
  return Boolean(custom[clean]);
}

/**
 * Super Admin Password Reset Tool
 * Allows Raj and Sagar to change/reset passwords for any account
 */
export async function setAccountPassword(adminUser, targetUsername, newPassword, mustChange = true) {
  if (!adminUser || adminUser.role !== 'super_admin') {
    throw new Error('Unauthorized: Only Super Admins (Raj & Sagar) can reset passwords.');
  }
  if (!targetUsername || !newPassword || newPassword.trim().length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const clean = targetUsername.toLowerCase().trim();
  const salt = generateSalt();
  const hash = await hashPassword(newPassword.trim(), salt);

  const custom = getCustomPasswords();
  custom[clean] = { hash, salt, mustChange };
  saveCustomPasswords(custom);

  // Background Cloud Sync to Neon PostgreSQL
  writeCustomPasswordHashToNeon(clean, hash, salt, mustChange, adminUser.username)
    .catch(e => console.error('Neon writeCustomPasswordHash error:', e));

  return true;
}

export function resetAccountPasswordToDefault(adminUser, targetUsername) {
  if (!adminUser || adminUser.role !== 'super_admin') {
    throw new Error('Unauthorized: Only Super Admins can reset passwords.');
  }
  const clean = targetUsername.toLowerCase().trim();
  const custom = getCustomPasswords();
  delete custom[clean];
  saveCustomPasswords(custom);

  // Background Cloud Delete in Neon PostgreSQL
  deleteCustomPasswordFromNeon(clean)
    .catch(e => console.error('Neon deleteCustomPassword error:', e));

  return true;
}

/**
 * Master Admin On-Spot Reset Tool
 * Verifies admin credentials (sagaranmol@gmail.com or raj.aryan@gmail.com)
 * and resets or changes any domain coordinator's password.
 * Can be called from Login Screen or Admin Settings.
 */
export async function adminAuthorizeAndResetPassword(adminIdentifier, adminPassword, targetUsername, newPassword = null) {
  const cleanAdmin = (adminIdentifier || '').toLowerCase().trim();
  const cleanAdminPass = (adminPassword || '').trim();

  // Find admin account (official accounts plus any dynamically added admins)
  const adminAcc = findAnyAccount(a =>
    a.role === 'super_admin' &&
    (a.username.toLowerCase() === cleanAdmin || (a.email || '').toLowerCase() === cleanAdmin)
  );

  if (!adminAcc) {
    throw new Error('Access Denied: Only Super Admins can authorize resets.');
  }

  // Verify Admin password against stored hash / default
  const isAdminMatch = await verifyAccountPassword(adminAcc, cleanAdminPass);
  if (!isAdminMatch) {
    throw new Error('Invalid Admin Password. Please verify your credentials.');
  }

  // Find target account (official plus dynamic users)
  const cleanTarget = (targetUsername || '').toLowerCase().trim();
  const targetAcc = findAnyAccount(a =>
    a.username.toLowerCase() === cleanTarget ||
    (a.aliasUsername && a.aliasUsername.toLowerCase() === cleanTarget) ||
    ((a.email || '').toLowerCase() === cleanTarget)
  );

  if (!targetAcc) {
    throw new Error(`Target account "${targetUsername}" not found in TechFEST directory.`);
  }

  let finalPassword = '';
  const isSettingCustom = Boolean(newPassword && newPassword.trim().length >= 4);
  const customPasswords = getCustomPasswords();

  if (isSettingCustom) {
    finalPassword = newPassword.trim();
    const salt = generateSalt();
    const hash = await hashPassword(finalPassword, salt);
    customPasswords[targetAcc.username.toLowerCase()] = { hash, salt, mustChange: true };
    saveCustomPasswords(customPasswords);

    // Background Cloud Sync to Neon PostgreSQL
    writeCustomPasswordHashToNeon(targetAcc.username.toLowerCase(), hash, salt, true, adminAcc.username)
      .catch(e => console.error('Neon writeCustomPasswordHash error:', e));
  } else {
    // Reset to initial default
    delete customPasswords[targetAcc.username.toLowerCase()];
    saveCustomPasswords(customPasswords);

    // Background Cloud Delete in Neon PostgreSQL
    deleteCustomPasswordFromNeon(targetAcc.username.toLowerCase())
      .catch(e => console.error('Neon deleteCustomPassword error:', e));

    finalPassword = targetAcc.defaultPassword || DEFAULT_INITIAL_PASSWORD;
  }

  return {
    success: true,
    targetAccount: targetAcc,
    adminAccount: adminAcc,
    password: finalPassword,
    isDefault: !isSettingCustom
  };
}

export function getActiveUser() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.username) return parsed;
    }
  } catch (e) {
    console.error('Error reading auth session:', e);
  }
  return null;
}

export function setActiveUser(user) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    if (user) {
      recordLoginSession(user);
    }
  } catch (e) {
    console.error('Error saving auth session:', e);
  }
}

export function clearActiveUser() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing auth session:', e);
  }
}

/**
 * Authenticates a user against the hardcoded directory plus any
 * runtime-managed panel users. Compares salted SHA-256 hashes where present
 * and falls back to default-password matching for untouched accounts.
 */
export async function authenticateUser(usernameInput, passwordInput) {
  if (!usernameInput || !passwordInput) {
    return { success: false, error: 'Please enter both email/username and password.' };
  }

  const cleanUser = usernameInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();

  await migrateLegacyPasswords();

  const account = findAccount(cleanUser);

  if (!account) {
    return {
      success: false,
      error: `Account "${cleanUser}" not found. Enter your official coordinator email or your assigned username.`
    };
  }

  const isMatch = await verifyAccountPassword(account, cleanPass);

  if (!isMatch) {
    const who = account.name || account.displayName || account.username;
    return {
      success: false,
      error: `Incorrect password for ${who}. If you forgot your password, contact Central Desk Admins to reset it.`
    };
  }

  return { success: true, user: normalizeUserShape(account) };
}

/**
 * Runtime-managed users store display_name / can_verify_payments, while the
 * hardcoded accounts use name / role conventions. Present a single shape.
 */
export function normalizeUserShape(account) {
  if (!account) return null;
  const isDynamic = account.displayName !== undefined;
  const label = account.name || account.displayName || account.username;
  return {
    username: account.username,
    name: label,
    displayName: label,
    role: account.role,
    domainId: account.domainId || 'ALL',
    domainName: account.domainName || null,
    teamName: account.teamName || 'Central Operations',
    email: account.email || '',
    title: account.title || null,
    avatar: account.avatar || label.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase(),
    canVerifyPayments: Boolean(account.canVerifyPayments),
    mustChangePassword: isUserUsingDefaultPassword(account.username),
    isDynamic
  };
}

/**
 * Checks if a specific event belongs to a domain
 */
export function isEventInDomain(domainId, eventName) {
  if (!domainId || !eventName) return false;
  const resolved = getDomainForEvent(eventName);
  return resolved ? resolved.id === domainId : false;
}

/**
 * Resolves which domain an event belongs to (or null)
 */
export function getDomainForEvent(eventName) {
  if (!eventName) return null;
  const target = eventName.toLowerCase().trim();

  // 1. Direct exact match on canonical official events across all domains
  for (const dInfo of Object.values(DOMAINS_DIRECTORY)) {
    const match = dInfo.events.some(ev => target === ev.toLowerCase().trim());
    if (match) return dInfo;
  }

  // 2. Direct exact match on aliases across all domains
  for (const dInfo of Object.values(DOMAINS_DIRECTORY)) {
    if (dInfo.aliases && Array.isArray(dInfo.aliases)) {
      const match = dInfo.aliases.some(ev => target === ev.toLowerCase().trim());
      if (match) return dInfo;
    }
  }

  // 3. Fallback substring match across all events and aliases
  for (const dInfo of Object.values(DOMAINS_DIRECTORY)) {
    const allEvents = [...dInfo.events, ...(dInfo.aliases || [])];
    const match = allEvents.some(ev => {
      const evLower = ev.toLowerCase().trim();
      return target.includes(evLower) || evLower.includes(target);
    });
    if (match) return dInfo;
  }

  return null;
}

/**
 * Filters participants for the active user session.
 */
export function getParticipantsForUser(user, participants = [], domainOverride = null) {
  if (!Array.isArray(participants)) return [];
  if (!user) return [];

  const targetDomainId = user.role === 'domain_head' ? user.domainId : domainOverride;

  if (targetDomainId && targetDomainId !== 'ALL') {
    return participants.filter(p => isEventInDomain(targetDomainId, p.event_name));
  }

  return participants;
}

/**
 * Computes domain-specific statistical metrics.
 * Guarantees that totalParticipants is the exact mathematical sum of its constituent event counts.
 */
export function getDomainStats(domainId, participants = []) {
  const domain = DOMAINS_DIRECTORY[domainId];
  if (!domain) return null;

  // Track exact count for each canonical official event
  const eventCounts = {};
  domain.events.forEach(ev => {
    eventCounts[ev] = 0;
  });

  const domainParticipants = participants.filter(p => isEventInDomain(domainId, p.event_name));

  domainParticipants.forEach(p => {
    const pName = (p.event_name || '').toLowerCase().trim();
    let matchedCanonical = domain.events.find(ev => ev.toLowerCase().trim() === pName);
    if (!matchedCanonical && domain.aliases) {
      matchedCanonical = domain.events.find(ev => {
        const evLow = ev.toLowerCase().trim();
        return pName.includes(evLow) || evLow.includes(pName);
      });
    }
    const key = matchedCanonical || domain.events[0];
    if (key) {
      eventCounts[key] = (eventCounts[key] || 0) + 1;
    }
  });

  const totalParticipants = domainParticipants.length;
  const paidCount = domainParticipants.filter(p => Number(p.amount) > 0).length;
  const totalRevenue = domainParticipants.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const colleges = new Set(domainParticipants.map(p => p.college).filter(Boolean));

  return {
    domain,
    totalParticipants,
    paidCount,
    freeCount: totalParticipants - paidCount,
    totalRevenue,
    uniqueColleges: colleges.size,
    eventsCount: domain.events.length,
    eventsList: domain.events,
    eventCounts
  };
}
