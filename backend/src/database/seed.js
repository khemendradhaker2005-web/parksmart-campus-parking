const bcrypt = require('bcryptjs');
const { query, initDatabase, getActiveEngine } = require('./db');

async function seed() {
  console.log('[Seed] Starting database migration & seeding...');
  await initDatabase();

  const isPg = getActiveEngine() === 'pg';

  // Build schema DDL tailored to active engine
  const ddlStatements = isPg
    ? [
        `CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          full_name VARCHAR(100) NOT NULL,
          mobile VARCHAR(15) UNIQUE NOT NULL,
          email VARCHAR(150) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'admin')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,

        `CREATE TABLE IF NOT EXISTS vehicles (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          vehicle_number VARCHAR(20) NOT NULL,
          vehicle_type VARCHAR(50) DEFAULT 'Four Wheeler / Car',
          make_model VARCHAR(100),
          is_primary BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,

        `CREATE TABLE IF NOT EXISTS parking_locations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          address TEXT NOT NULL,
          city VARCHAR(100) DEFAULT 'Bangalore',
          latitude DECIMAL(10, 8) NOT NULL,
          longitude DECIMAL(11, 8) NOT NULL,
          total_slots INT NOT NULL DEFAULT 40,
          price_per_hour DECIMAL(10, 2) NOT NULL DEFAULT 20.00,
          rating DECIMAL(3, 2) DEFAULT 4.80,
          operating_hours VARCHAR(100) DEFAULT '24/7 Open',
          contact_number VARCHAR(20) DEFAULT '+91 98765 43210',
          amenities TEXT DEFAULT '["CCTV Surveillance", "24/7 Security", "EV Fast Charging", "Covered Parking", "Valet Assistance"]',
          rules TEXT DEFAULT '["Speed limit 10 km/h", "Park strictly within slot markings", "₹20/hour rate (partial counted as full)", "Minimum mandatory charge ₹20"]',
          image_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,

        `CREATE TABLE IF NOT EXISTS parking_slots (
          id SERIAL PRIMARY KEY,
          location_id INT REFERENCES parking_locations(id) ON DELETE CASCADE,
          slot_number VARCHAR(20) NOT NULL,
          floor_level VARCHAR(50) DEFAULT 'Ground Floor',
          section VARCHAR(20) DEFAULT 'A',
          slot_type VARCHAR(30) DEFAULT 'Standard',
          status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'occupied', 'maintenance')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,

        `CREATE TABLE IF NOT EXISTS bookings (
          id SERIAL PRIMARY KEY,
          booking_code VARCHAR(30) UNIQUE NOT NULL,
          user_id INT REFERENCES users(id) ON DELETE SET NULL,
          vehicle_id INT REFERENCES vehicles(id) ON DELETE SET NULL,
          vehicle_number VARCHAR(20) NOT NULL,
          customer_name VARCHAR(100),
          customer_mobile VARCHAR(20),
          location_id INT REFERENCES parking_locations(id) ON DELETE CASCADE,
          slot_id INT REFERENCES parking_slots(id) ON DELETE SET NULL,
          expected_entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
          expected_exit_time TIMESTAMP WITH TIME ZONE NOT NULL,
          expected_duration_hours DECIMAL(5, 2) NOT NULL,
          estimated_amount DECIMAL(10, 2) NOT NULL,
          status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'active', 'completed', 'cancelled')),
          cancellation_reason TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,

        `CREATE TABLE IF NOT EXISTS parking_sessions (
          id SERIAL PRIMARY KEY,
          session_code VARCHAR(30) UNIQUE NOT NULL,
          booking_id INT REFERENCES bookings(id) ON DELETE SET NULL,
          user_id INT REFERENCES users(id) ON DELETE SET NULL,
          vehicle_number VARCHAR(20) NOT NULL,
          customer_name VARCHAR(100),
          customer_mobile VARCHAR(20),
          vehicle_type VARCHAR(50) DEFAULT 'Four Wheeler / Car',
          location_id INT REFERENCES parking_locations(id) ON DELETE CASCADE,
          slot_id INT REFERENCES parking_slots(id) ON DELETE SET NULL,
          entry_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          exit_time TIMESTAMP WITH TIME ZONE,
          duration_minutes INT DEFAULT 0,
          total_amount DECIMAL(10, 2) DEFAULT 0.00,
          status VARCHAR(25) DEFAULT 'active' CHECK (status IN ('active', 'payment_pending', 'completed', 'cancelled')),
          entry_staff_id INT REFERENCES users(id) ON DELETE SET NULL,
          exit_staff_id INT REFERENCES users(id) ON DELETE SET NULL,
          manual_override_reason TEXT,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,

        `CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          session_id INT REFERENCES parking_sessions(id) ON DELETE CASCADE,
          booking_id INT REFERENCES bookings(id) ON DELETE SET NULL,
          user_id INT REFERENCES users(id) ON DELETE SET NULL,
          amount DECIMAL(10, 2) NOT NULL,
          payment_method VARCHAR(30) DEFAULT 'UPI',
          transaction_id VARCHAR(100) UNIQUE NOT NULL,
          payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
          qr_data TEXT,
          receipt_number VARCHAR(50) UNIQUE NOT NULL,
          paid_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,

        `CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(150) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(30) DEFAULT 'info',
          is_read BOOLEAN DEFAULT false,
          metadata TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,

        `CREATE TABLE IF NOT EXISTS activity_logs (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE SET NULL,
          user_role VARCHAR(20),
          action VARCHAR(100) NOT NULL,
          target_type VARCHAR(50),
          target_id VARCHAR(50),
          details TEXT,
          ip_address VARCHAR(45),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`,

        `CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);`,
        `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
        `CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);`,
        `CREATE INDEX IF NOT EXISTS idx_sessions_vehicle ON parking_sessions(vehicle_number);`,
        `CREATE INDEX IF NOT EXISTS idx_sessions_user ON parking_sessions(user_id);`,
        `CREATE INDEX IF NOT EXISTS idx_slots_loc_status ON parking_slots(location_id, status);`
      ]
    : [
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          full_name TEXT NOT NULL,
          mobile TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'customer',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );`,

        `CREATE TABLE IF NOT EXISTS vehicles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          vehicle_number TEXT NOT NULL,
          vehicle_type TEXT DEFAULT 'Four Wheeler / Car',
          make_model TEXT,
          is_primary BOOLEAN DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );`,

        `CREATE TABLE IF NOT EXISTS parking_locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          address TEXT NOT NULL,
          city TEXT DEFAULT 'Bangalore',
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          total_slots INTEGER NOT NULL DEFAULT 40,
          price_per_hour REAL NOT NULL DEFAULT 20.00,
          rating REAL DEFAULT 4.80,
          operating_hours TEXT DEFAULT '24/7 Open',
          contact_number TEXT DEFAULT '+91 98765 43210',
          amenities TEXT DEFAULT '["CCTV Surveillance", "24/7 Security", "EV Fast Charging", "Covered Parking", "Valet Assistance"]',
          rules TEXT DEFAULT '["Speed limit 10 km/h", "Park strictly within slot markings", "₹20/hour rate (partial counted as full)", "Minimum mandatory charge ₹20"]',
          image_url TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );`,

        `CREATE TABLE IF NOT EXISTS parking_slots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          location_id INTEGER,
          slot_number TEXT NOT NULL,
          floor_level TEXT DEFAULT 'Ground Floor',
          section TEXT DEFAULT 'A',
          slot_type TEXT DEFAULT 'Standard',
          status TEXT DEFAULT 'available',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (location_id) REFERENCES parking_locations(id) ON DELETE CASCADE
        );`,

        `CREATE TABLE IF NOT EXISTS bookings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          booking_code TEXT UNIQUE NOT NULL,
          user_id INTEGER,
          vehicle_id INTEGER,
          vehicle_number TEXT NOT NULL,
          customer_name TEXT,
          customer_mobile TEXT,
          location_id INTEGER,
          slot_id INTEGER,
          expected_entry_time TEXT NOT NULL,
          expected_exit_time TEXT NOT NULL,
          expected_duration_hours REAL NOT NULL,
          estimated_amount REAL NOT NULL,
          status TEXT DEFAULT 'confirmed',
          cancellation_reason TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (location_id) REFERENCES parking_locations(id),
          FOREIGN KEY (slot_id) REFERENCES parking_slots(id)
        );`,

        `CREATE TABLE IF NOT EXISTS parking_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_code TEXT UNIQUE NOT NULL,
          booking_id INTEGER,
          user_id INTEGER,
          vehicle_number TEXT NOT NULL,
          customer_name TEXT,
          customer_mobile TEXT,
          vehicle_type TEXT DEFAULT 'Four Wheeler / Car',
          location_id INTEGER,
          slot_id INTEGER,
          entry_time TEXT DEFAULT CURRENT_TIMESTAMP,
          exit_time TEXT,
          duration_minutes INTEGER DEFAULT 0,
          total_amount REAL DEFAULT 0.00,
          status TEXT DEFAULT 'active',
          entry_staff_id INTEGER,
          exit_staff_id INTEGER,
          manual_override_reason TEXT,
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (location_id) REFERENCES parking_locations(id),
          FOREIGN KEY (slot_id) REFERENCES parking_slots(id)
        );`,

        `CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER,
          booking_id INTEGER,
          user_id INTEGER,
          amount REAL NOT NULL,
          payment_method TEXT DEFAULT 'UPI',
          transaction_id TEXT UNIQUE NOT NULL,
          payment_status TEXT DEFAULT 'pending',
          qr_data TEXT,
          receipt_number TEXT UNIQUE NOT NULL,
          paid_at TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES parking_sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );`,

        `CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT DEFAULT 'info',
          is_read BOOLEAN DEFAULT 0,
          metadata TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );`,

        `CREATE TABLE IF NOT EXISTS activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          user_role TEXT,
          action TEXT NOT NULL,
          target_type TEXT,
          target_id TEXT,
          details TEXT,
          ip_address TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );`
      ];

  for (const stmt of ddlStatements) {
    try {
      await query(stmt);
    } catch (err) {
      console.warn('[DDL Notice]', err.message);
    }
  }

  // Safe check: Only seed initial demo accounts if users table is empty
  const existingUsers = await query("SELECT COUNT(*) as count FROM users;");
  const count = parseInt(existingUsers.rows[0]?.count || 0, 10);

  if (count > 0) {
    console.log(`[Seed] Database already contains ${count} user record(s). Skipping seed.`);
    return;
  }

  console.log('[Seed] Seeding authorized staff and demo customers...');
  const salt = await bcrypt.genSalt(10);
  const commonPasswordHash = await bcrypt.hash('Password@123', salt);

  // 1. Seed Staff Users
  await query(
    `INSERT INTO users (full_name, mobile, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
    ['Rajesh Sharma (Shift Supervisor)', '9876543210', 'rajesh.staff@smartparking.io', commonPasswordHash, 'staff']
  );
  await query(
    `INSERT INTO users (full_name, mobile, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
    ['Pooja Verma (Gate Operator)', '9876543211', 'pooja.staff@smartparking.io', commonPasswordHash, 'staff']
  );

  // 2. Seed Customer Users
  await query(
    `INSERT INTO users (full_name, mobile, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
    ['Arun Kumar', '9123456780', 'arun.kumar@gmail.com', commonPasswordHash, 'customer']
  );
  await query(
    `INSERT INTO users (full_name, mobile, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
    ['Neha Patel', '9876501234', 'neha.patel@outlook.com', commonPasswordHash, 'customer']
  );

  // Retrieve dynamically created user IDs to avoid hardcoded sequence assumptions
  const arunUserRes = await query("SELECT id FROM users WHERE mobile = '9123456780'");
  const nehaUserRes = await query("SELECT id FROM users WHERE mobile = '9876501234'");
  const rajeshUserRes = await query("SELECT id FROM users WHERE mobile = '9876543210'");
  const poojaUserRes = await query("SELECT id FROM users WHERE mobile = '9876543211'");

  const arunId = arunUserRes.rows[0]?.id || 3;
  const nehaId = nehaUserRes.rows[0]?.id || 4;
  const rajeshId = rajeshUserRes.rows[0]?.id || 1;
  const poojaId = poojaUserRes.rows[0]?.id || 2;

  // 3. Seed Vehicles
  await query(
    `INSERT INTO vehicles (user_id, vehicle_number, vehicle_type, make_model, is_primary) VALUES ($1, $2, $3, $4, $5)`,
    [arunId, 'KA01AB1234', 'Four Wheeler / Car', 'Honda City (Pearl White)', true]
  );
  await query(
    `INSERT INTO vehicles (user_id, vehicle_number, vehicle_type, make_model, is_primary) VALUES ($1, $2, $3, $4, $5)`,
    [arunId, 'KA05EV4321', 'EV / Electric Vehicle', 'Tata Nexon EV (Teal Blue)', false]
  );
  await query(
    `INSERT INTO vehicles (user_id, vehicle_number, vehicle_type, make_model, is_primary) VALUES ($1, $2, $3, $4, $5)`,
    [nehaId, 'MH12CD5678', 'SUV', 'Hyundai Creta (Knight Black)', true]
  );

  // 4. Seed Parking Locations
  const locations = [
    {
      name: 'Cyber City Tech Park Parking',
      address: 'Phase 1, Electronic City, Hosur Road, Near Tech Hub Gate 3',
      city: 'Bangalore',
      latitude: 12.8452,
      longitude: 77.6602,
      total_slots: 24,
      price_per_hour: 20.00,
      rating: 4.85,
      operating_hours: '24/7 Open',
      contact_number: '+91 98765 43210',
      amenities: JSON.stringify(["CCTV Surveillance", "24/7 Security", "EV Fast Charging", "Covered Parking", "Valet Assistance"]),
      rules: JSON.stringify(["Speed limit: 10 km/h", "Park strictly within designated slot lines", "Mandatory entry scan", "Charges: ₹20/hr, minimum ₹20"]),
      image_url: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80'
    },
    {
      name: 'Central Metro Plaza Parking',
      address: 'MG Road Metro Station Interchange, Brigade Road Junction',
      city: 'Bangalore',
      latitude: 12.9756,
      longitude: 77.6067,
      total_slots: 20,
      price_per_hour: 20.00,
      rating: 4.70,
      operating_hours: '05:30 AM - 11:30 PM',
      contact_number: '+91 98765 43212',
      amenities: JSON.stringify(["Direct Metro Access", "CCTV Surveillance", "Wheelchair Friendly", "Digital UPI Payment"]),
      rules: JSON.stringify(["Strict no idling zone", "Follow entry/exit arrow markings", "Charges: ₹20/hr, minimum ₹20"]),
      image_url: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=800&q=80'
    },
    {
      name: 'Phoenix Grand Mall Multilevel Parking',
      address: 'Whitefield Main Road, Mahadevapura, Near ITPL',
      city: 'Bangalore',
      latitude: 12.9972,
      longitude: 77.6968,
      total_slots: 24,
      price_per_hour: 20.00,
      rating: 4.90,
      operating_hours: '09:00 AM - 01:00 AM',
      contact_number: '+91 98765 43214',
      amenities: JSON.stringify(["Covered Multi-level", "Automated Boom Barriers", "EV Fast Charging", "Tyre Inflation Point", "Elevator Access"]),
      rules: JSON.stringify(["Max vehicle height: 2.2m", "Overnight parking prohibited without permit", "Charges: ₹20/hr, minimum ₹20"]),
      image_url: 'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=800&q=80'
    },
    {
      name: 'Airport Express Gateway Parking',
      address: 'Hebbal Flyover Junction, Outer Ring Road, Bellary Road',
      city: 'Bangalore',
      latitude: 13.0358,
      longitude: 77.5970,
      total_slots: 18,
      price_per_hour: 20.00,
      rating: 4.80,
      operating_hours: '24/7 Open',
      contact_number: '+91 98765 43216',
      amenities: JSON.stringify(["24/7 Security", "Shuttle Service Point", "Luggage Assistance", "CCTV High Definition", "Card & UPI"]),
      rules: JSON.stringify(["Commercial vehicles require pass", "Charges: ₹20/hr, minimum ₹20"]),
      image_url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80'
    }
  ];

  const locIdMap = {};
  for (const loc of locations) {
    await query(
      `INSERT INTO parking_locations (name, address, city, latitude, longitude, total_slots, price_per_hour, rating, operating_hours, contact_number, amenities, rules, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [loc.name, loc.address, loc.city, loc.latitude, loc.longitude, loc.total_slots, loc.price_per_hour, loc.rating, loc.operating_hours, loc.contact_number, loc.amenities, loc.rules, loc.image_url]
    );
    const insertedLoc = await query('SELECT id FROM parking_locations WHERE name = $1', [loc.name]);
    locIdMap[loc.name] = insertedLoc.rows[0]?.id;
  }

  const cyberCityId = locIdMap['Cyber City Tech Park Parking'];
  const metroPlazaId = locIdMap['Central Metro Plaza Parking'];
  const phoenixMallId = locIdMap['Phoenix Grand Mall Multilevel Parking'];
  const airportGatewayId = locIdMap['Airport Express Gateway Parking'];

  // 5. Seed Parking Slots for each location
  const slotLayouts = [
    { locId: cyberCityId, prefix: 'A', count: 8, floor: 'Ground Floor', type: 'Standard' },
    { locId: cyberCityId, prefix: 'B', count: 8, floor: 'Basement 1', type: 'Standard' },
    { locId: cyberCityId, prefix: 'EV', count: 4, floor: 'Ground Floor', type: 'EV Charging' },
    { locId: cyberCityId, prefix: 'C', count: 4, floor: 'Basement 1', type: 'Accessible' },

    { locId: metroPlazaId, prefix: 'A', count: 10, floor: 'Level 1', type: 'Standard' },
    { locId: metroPlazaId, prefix: 'B', count: 8, floor: 'Level 2', type: 'Standard' },
    { locId: metroPlazaId, prefix: 'EV', count: 2, floor: 'Level 1', type: 'EV Charging' },

    { locId: phoenixMallId, prefix: 'A', count: 10, floor: 'Lower Deck', type: 'Standard' },
    { locId: phoenixMallId, prefix: 'B', count: 10, floor: 'Upper Deck', type: 'Standard' },
    { locId: phoenixMallId, prefix: 'EV', count: 4, floor: 'Lower Deck', type: 'EV Charging' },

    { locId: airportGatewayId, prefix: 'A', count: 10, floor: 'Ground Open', type: 'Standard' },
    { locId: airportGatewayId, prefix: 'B', count: 6, floor: 'Ground Covered', type: 'Standard' },
    { locId: airportGatewayId, prefix: 'EV', count: 2, floor: 'Ground Covered', type: 'EV Charging' },
  ];

  for (const layout of slotLayouts) {
    if (!layout.locId) continue;
    for (let i = 1; i <= layout.count; i++) {
      const slotNum = `${layout.prefix}-${String(i).padStart(2, '0')}`;
      await query(
        `INSERT INTO parking_slots (location_id, slot_number, floor_level, section, slot_type, status)
         VALUES ($1, $2, $3, $4, $5, 'available')`,
        [layout.locId, slotNum, layout.floor, layout.prefix, layout.type]
      );
    }
  }

  // Set one slot maintenance for realism
  if (cyberCityId) {
    await query(`UPDATE parking_slots SET status = 'maintenance' WHERE location_id = $1 AND slot_number = 'B-04'`, [cyberCityId]);
  }

  // Look up slot IDs for demo sessions
  const slotA01Res = await query('SELECT id FROM parking_slots WHERE location_id = $1 AND slot_number = $2', [cyberCityId, 'A-01']);
  const slotA01Id = slotA01Res.rows[0]?.id || 1;

  const slotMetroRes = await query('SELECT id FROM parking_slots WHERE location_id = $1 AND slot_number = $2', [metroPlazaId, 'A-01']);
  const slotMetroId = slotMetroRes.rows[0]?.id || 25;

  const slotMallRes = await query('SELECT id FROM parking_slots WHERE location_id = $1 AND slot_number = $2', [phoenixMallId, 'A-01']);
  const slotMallId = slotMallRes.rows[0]?.id || 45;

  // 6. Pre-seed a few completed past sessions for Arun & Neha
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  const yesterdayExit = new Date(yesterday.getTime() + 2 * 3600 * 1000 + 15 * 60 * 1000); // 2 hrs 15 mins -> ₹60

  await query(
    `INSERT INTO parking_sessions (session_code, user_id, vehicle_number, customer_name, customer_mobile, vehicle_type, location_id, slot_id, entry_time, exit_time, duration_minutes, total_amount, status, entry_staff_id, exit_staff_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      'PS-DEMO-001',
      arunId,
      'KA01AB1234',
      'Arun Kumar',
      '9123456780',
      'Four Wheeler / Car',
      cyberCityId,
      slotA01Id,
      yesterday.toISOString(),
      yesterdayExit.toISOString(),
      135,
      60.00,
      'completed',
      rajeshId,
      rajeshId,
      'Regular completed session'
    ]
  );

  const sess1Res = await query("SELECT id FROM parking_sessions WHERE session_code = 'PS-DEMO-001'");
  const sess1Id = sess1Res.rows[0]?.id || 1;

  await query(
    `INSERT INTO payments (session_id, user_id, amount, payment_method, transaction_id, payment_status, receipt_number, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [sess1Id, arunId, 60.00, 'UPI', 'TXN-YEST-982143', 'completed', 'RCP-202611-001', yesterdayExit.toISOString()]
  );

  // Session 2: Completed 3 days ago (70 min -> ₹40)
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
  const threeDaysAgoExit = new Date(threeDaysAgo.getTime() + 70 * 60 * 1000);
  await query(
    `INSERT INTO parking_sessions (session_code, user_id, vehicle_number, customer_name, customer_mobile, vehicle_type, location_id, slot_id, entry_time, exit_time, duration_minutes, total_amount, status, entry_staff_id, exit_staff_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    ['PS-DEMO-002', arunId, 'KA01AB1234', 'Arun Kumar', '9123456780', 'Four Wheeler / Car', metroPlazaId, slotMetroId, threeDaysAgo.toISOString(), threeDaysAgoExit.toISOString(), 70, 40.00, 'completed', poojaId, poojaId]
  );

  const sess2Res = await query("SELECT id FROM parking_sessions WHERE session_code = 'PS-DEMO-002'");
  const sess2Id = sess2Res.rows[0]?.id || 2;

  await query(
    `INSERT INTO payments (session_id, user_id, amount, payment_method, transaction_id, payment_status, receipt_number, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [sess2Id, arunId, 40.00, 'UPI', 'TXN-3DAY-481902', 'completed', 'RCP-202611-002', threeDaysAgoExit.toISOString()]
  );

  // Session 3: Other vehicle completed
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 3600 * 1000);
  const fiveDaysAgoExit = new Date(fiveDaysAgo.getTime() + 45 * 60 * 1000); // 45 min -> ₹20
  await query(
    `INSERT INTO parking_sessions (session_code, user_id, vehicle_number, customer_name, customer_mobile, vehicle_type, location_id, slot_id, entry_time, exit_time, duration_minutes, total_amount, status, entry_staff_id, exit_staff_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    ['PS-DEMO-003', nehaId, 'MH12CD5678', 'Neha Patel', '9876501234', 'SUV', phoenixMallId, slotMallId, fiveDaysAgo.toISOString(), fiveDaysAgoExit.toISOString(), 45, 20.00, 'completed', rajeshId, rajeshId]
  );

  const sess3Res = await query("SELECT id FROM parking_sessions WHERE session_code = 'PS-DEMO-003'");
  const sess3Id = sess3Res.rows[0]?.id || 3;

  await query(
    `INSERT INTO payments (session_id, user_id, amount, payment_method, transaction_id, payment_status, receipt_number, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [sess3Id, nehaId, 20.00, 'Card', 'TXN-5DAY-776123', 'completed', 'RCP-202611-003', fiveDaysAgoExit.toISOString()]
  );

  // Welcome notification for Arun
  await query(
    `INSERT INTO notifications (user_id, title, message, type)
     VALUES ($1, $2, $3, $4)`,
    [arunId, 'Welcome to ParkSmart', 'Thank you for registering with Smart Parking. You can now discover, pre-book slots, and track parking in real time.', 'info']
  );

  console.log('[Seed] Database initialization and seeding completed successfully!');
}

if (require.main === module) {
  seed().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('[Seed Error]:', err);
    process.exit(1);
  });
}

module.exports = { seed };