// src/utils/auth.js
// TechFEST '26 Role-Based Access Control (RBAC), 13 Domains Directory & Official Logins
import { 
  fetchCustomPasswordsFromNeon, 
  writeCustomPasswordToNeon, 
  deleteCustomPasswordFromNeon 
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

export const DEFAULT_INITIAL_PASSWORD = 'Techfest@2026';

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
const CUSTOM_PASSWORDS_KEY = 'tf_custom_passwords_v3';

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

export function getPasswordForAccount(username) {
  const custom = getCustomPasswords();
  const clean = username.toLowerCase().trim();
  if (custom[clean]) return custom[clean];

  const acc = OFFICIAL_ACCOUNTS.find(a => 
    a.username.toLowerCase() === clean || 
    (a.aliasUsername && a.aliasUsername.toLowerCase() === clean) ||
    (a.email && a.email.toLowerCase() === clean) ||
    a.username.split('@')[0].toLowerCase() === clean
  );

  return acc?.defaultPassword || DEFAULT_INITIAL_PASSWORD;
}

/**
 * Checks if an account is still on the initial default password
 */
export function isUserUsingDefaultPassword(username) {
  if (!username) return false;
  const custom = getCustomPasswords();
  const clean = username.toLowerCase().trim();
  const currentPass = custom[clean];
  return !currentPass || currentPass === DEFAULT_INITIAL_PASSWORD || currentPass === 'sliet@2026';
}

/**
 * Allows the active user to set their personal new password
 */
export function updateUserOwnPassword(username, newPassword) {
  if (!username || !newPassword || newPassword.trim().length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const clean = username.toLowerCase().trim();
  const custom = getCustomPasswords();
  custom[clean] = newPassword.trim();
  saveCustomPasswords(custom);

  // Background cloud sync to Neon
  writeCustomPasswordToNeon(clean, newPassword.trim(), clean)
    .catch(e => console.error('Neon writeCustomPassword note:', e));

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
 * Sync custom passwords from Neon PostgreSQL
 */
export async function syncPasswordsWithNeon() {
  try {
    const cloudPasswords = await fetchCustomPasswordsFromNeon();
    if (cloudPasswords && Object.keys(cloudPasswords).length > 0) {
      const local = getCustomPasswords();
      const merged = { ...local, ...cloudPasswords };
      saveCustomPasswords(merged);
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
export function setAccountPassword(adminUser, targetUsername, newPassword) {
  if (!adminUser || adminUser.role !== 'super_admin') {
    throw new Error('Unauthorized: Only Super Admins (Raj & Sagar) can reset passwords.');
  }
  if (!targetUsername || !newPassword || newPassword.trim().length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const clean = targetUsername.toLowerCase().trim();
  const custom = getCustomPasswords();
  custom[clean] = newPassword.trim();
  saveCustomPasswords(custom);

  // Background Cloud Sync to Neon PostgreSQL
  writeCustomPasswordToNeon(clean, newPassword.trim(), adminUser.username)
    .catch(e => console.error('Neon writeCustomPassword error:', e));

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
export function adminAuthorizeAndResetPassword(adminIdentifier, adminPassword, targetUsername, newPassword = null) {
  const cleanAdmin = (adminIdentifier || '').toLowerCase().trim();
  const cleanAdminPass = (adminPassword || '').trim();

  // Find admin account
  const adminAcc = OFFICIAL_ACCOUNTS.find(a => 
    a.role === 'super_admin' && 
    (a.username.toLowerCase() === cleanAdmin || a.email.toLowerCase() === cleanAdmin)
  );

  if (!adminAcc) {
    throw new Error('Access Denied: Only Super Admins (sagaranmol@gmail.com, raj.aryan@gmail.com) can authorize resets.');
  }

  // Verify Admin password
  const expectedAdminPass = getPasswordForAccount(adminAcc.username);
  const customPasswords = getCustomPasswords();
  const adminHasCustom = Boolean(customPasswords[adminAcc.username.toLowerCase()]);
  
  const isAdminMatch = adminHasCustom 
    ? (cleanAdminPass === expectedAdminPass)
    : (cleanAdminPass === expectedAdminPass || cleanAdminPass === DEFAULT_INITIAL_PASSWORD || cleanAdminPass === 'sliet@2026');

  if (!isAdminMatch) {
    throw new Error('Invalid Admin Password. Please verify your credentials.');
  }

  // Find target account
  const cleanTarget = (targetUsername || '').toLowerCase().trim();
  const targetAcc = OFFICIAL_ACCOUNTS.find(a => 
    a.username.toLowerCase() === cleanTarget || 
    (a.aliasUsername && a.aliasUsername.toLowerCase() === cleanTarget) ||
    (a.email && a.email.toLowerCase() === cleanTarget)
  );

  if (!targetAcc) {
    throw new Error(`Target account "${targetUsername}" not found in TechFEST directory.`);
  }

  let finalPassword = '';
  const isSettingCustom = Boolean(newPassword && newPassword.trim().length >= 4);

  if (isSettingCustom) {
    finalPassword = newPassword.trim();
    customPasswords[targetAcc.username.toLowerCase()] = finalPassword;
    saveCustomPasswords(customPasswords);

    // Background Cloud Sync to Neon PostgreSQL
    writeCustomPasswordToNeon(targetAcc.username.toLowerCase(), finalPassword, adminAcc.username)
      .catch(e => console.error('Neon writeCustomPassword error:', e));
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
 * Authenticates user credentials against official accounts and custom passwords.
 * If user has set a custom password, only that custom password is valid.
 * If user is still on default, accepts default initial password.
 */
export function authenticateUser(usernameInput, passwordInput) {
  if (!usernameInput || !passwordInput) {
    return { success: false, error: 'Please enter both email/username and password.' };
  }

  const cleanUser = usernameInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();

  const account = OFFICIAL_ACCOUNTS.find(acc => 
    acc.username.toLowerCase() === cleanUser || 
    (acc.aliasUsername && acc.aliasUsername.toLowerCase() === cleanUser) ||
    (acc.email && acc.email.toLowerCase() === cleanUser) ||
    acc.username.split('@')[0].toLowerCase() === cleanUser
  );

  if (!account) {
    return { 
      success: false, 
      error: `Account "${cleanUser}" not found. Enter your official coordinator email (e.g. sumitbansal1290@gmail.com, sagaranmol@gmail.com).` 
    };
  }

  const expectedPassword = getPasswordForAccount(account.username);
  const isCustomSet = hasAccountCustomPassword(account.username);

  // If a custom password has been set, only accept the custom password.
  // If no custom password has been set (still default), accept DEFAULT_INITIAL_PASSWORD or legacy sliet@2026.
  let isMatch = false;
  if (isCustomSet) {
    isMatch = (cleanPass === expectedPassword);
  } else {
    isMatch = (cleanPass === expectedPassword) || 
              (cleanPass === DEFAULT_INITIAL_PASSWORD) ||
              (cleanPass === 'sliet@2026') ||
              (cleanPass === `${account.username}@sliet`) ||
              (account.aliasUsername && cleanPass === `${account.aliasUsername}@sliet`);
  }

  if (!isMatch) {
    return { 
      success: false, 
      error: isCustomSet 
        ? `Incorrect password for ${account.name}. If you forgot your password, contact Central Desk Admins (Sagar/Raj) to reset it.`
        : `Incorrect password for ${account.name}. Default initial password is "${DEFAULT_INITIAL_PASSWORD}".` 
    };
  }

  return { success: true, user: account };
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
  for (const [dId, dInfo] of Object.entries(DOMAINS_DIRECTORY)) {
    const match = dInfo.events.some(ev => target === ev.toLowerCase().trim());
    if (match) return dInfo;
  }

  // 2. Direct exact match on aliases across all domains
  for (const [dId, dInfo] of Object.entries(DOMAINS_DIRECTORY)) {
    if (dInfo.aliases && Array.isArray(dInfo.aliases)) {
      const match = dInfo.aliases.some(ev => target === ev.toLowerCase().trim());
      if (match) return dInfo;
    }
  }

  // 3. Fallback substring match across all events and aliases
  for (const [dId, dInfo] of Object.entries(DOMAINS_DIRECTORY)) {
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
