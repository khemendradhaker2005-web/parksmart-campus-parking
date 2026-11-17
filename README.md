# 🅿️ ParkSmart - Intelligent Smart Parking Management System
### Full-Stack Web Application with Staff and Customer Portals

ParkSmart is a production-grade, enterprise-ready Smart Parking Management System designed to modernize urban vehicle parking operations. It features two completely decoupled, role-enforced portals: **Staff Portal** (for gate operators, supervisors, and facility managers) and **Customer Portal** (for drivers, commuters, and fleet owners), backed by PostgreSQL, Node.js/Express, Socket.IO real-time event broadcasting, Leaflet interactive maps, dynamic UPI QR billing, and Recharts analytics.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18 (Vite), Tailwind CSS, Lucide React, Recharts, Leaflet, React-Leaflet, QRCode.react |
| **Backend** | Node.js, Express.js, Socket.IO, JWT (JSON Web Tokens), bcryptjs, QRCode |
| **Database** | PostgreSQL (with parameterized queries, atomic transactions, row locking) + embedded SQL adapter fallback |
| **Real-time** | Socket.IO bi-directional pub/sub channels (`user_{id}`, `staff_room`, `location_{id}`) |
| **Billing** | Standard ₹20/hour rate engine: `MAX(1, CEILING(Duration in Hours)) × ₹20` |

---

## 🌟 Key Features

### 1. Separate Role-Enforced Portals & Landing Page
- **Landing Page**: Modern hero overview, feature breakdown, live interactive map preview, transparent ₹20/hr pricing rule card, and two distinct action cards for Staff and Customer portals.
- **Customer Registration**: One-time registration with Full Name, Vehicle RC number, Mobile Number (10 digits), Email, Password, and Confirmation.
- **Staff Authentication**: Authorized credentials only (no public registration).
- **Backend Role Guard**: Server-side JWT role enforcement (`authenticateToken` + `requireRole('staff')` / `requireRole('customer')`).

### 2. Customer Portal
- **Live Parking Status**: When staff marks a vehicle as entered, the customer dashboard dynamically displays:
  - "Welcome to [Parking Name]"
  - Vehicle Registration Number
  - Assigned Slot Number
  - Live Ticking Duration counter (`H:M:S`)
  - Status indicator ("Currently Parked & Active" or "Payment Due")
  - Real-time Socket.IO notification: *"Welcome to [Parking Name]! Your vehicle [Vehicle Number] has entered successfully. Your assigned parking slot is [Slot Number]."*
- **Parking Discovery & Map**:
  - Interactive Leaflet map with custom status badges (`🅿️ Available Slots`).
  - Search by name or location.
  - Filter by availability and real GPS distance (via browser Geolocation API or city center).
  - Sort by highest rating, nearest distance, or price.
- **Atomic Slot Reservation**:
  - Duration-based reservation with instant slot allocation.
  - Generates unique Booking Code (`BK-XXXXXX`) and contactless check-in QR pass.
  - Database row-locking transaction to prevent double booking and race conditions.
  - Cancellation allowed anytime prior to vehicle gate entry.
- **Vehicle Exit & Dynamic UPI QR Billing**:
  - Calculates payable amount using `MAX(1, CEILING(hours)) * ₹20`. Minimum charge: ₹20.
  - Generates standard UPI QR code string (`upi://pay?pa=...&am=...`).
  - Simulated payment mode with webhook verification.
  - Official digital tax invoice and printable receipt with receipt number and timestamps.
- **Personal Customer Analytics**:
  - Total Visits, Lifetime Spend, Cumulative Hours, Most Frequent Parking Location.
  - Recharts monthly expense trend area chart.
  - Strict data isolation (`WHERE user_id = req.user.id`).
- **Vehicle Management**: Register additional vehicles, set primary vehicle, or delete vehicles.

### 3. Staff Operations Portal
- **8 KPI Metric Cards**:
  1. Total Parking Slots
  2. Available Slots
  3. Occupied Slots
  4. Active Vehicles
  5. Today's Entries
  6. Today's Exits
  7. Pending Payments
  8. Today's Revenue
- **Gate Entry / Check-In Management**:
  - Instant lookup of pre-booked vehicles or allocation of available bays for walk-in arrivals.
  - Changes slot status to `occupied` and notifies customer in real-time.
- **Gate Exit / Departure Management**:
  - Search active vehicles by vehicle number, mobile, customer name, booking ID, or slot.
  - Records exact exit time, calculates ₹20/hr fee, and generates UPI QR code.
  - Releases slot only upon verified payment.
  - Manual override for disputes or emergencies with mandatory reason note and permanent audit logging in `activity_logs`.
- **Visual Slot Grid**:
  - Color-coded grid (Green: Available, Red: Occupied, Amber: Reserved, Slate: Maintenance).
  - Filter by floor level or section.
  - Click any slot to view detailed occupant modal and toggle maintenance mode.
- **Customer Directory**: Searchable list of registered customers with lifetime spend and session count.
- **Immutable Parking History**: Complete audit trail of past sessions (never deleted).
- **Staff Slot Usage Analytics**:
  - Most and least frequently occupied slots (Recharts bar chart).
  - 7-day vehicle flow (entries vs exits line chart).
  - Daily revenue velocity.

---

## 🔑 Test Accounts

| Portal | Role | Mobile Number | Password | Notes |
|---|---|---|---|---|
| **Staff Portal** | Shift Supervisor | `9876543210` | `Password@123` | Authorized Pre-seeded Staff Account |
| **Staff Portal** | Gate Operator | `9876543211` | `Password@123` | Authorized Pre-seeded Staff Account |
| **Customer Portal** | Registered Customer | `9123456780` | `Password@123` | Vehicles: `KA01AB1234`, `KA05EV4321` |
| **Customer Portal** | Registered Customer 2 | `9876501234` | `Password@123` | Vehicle: `MH12CD5678` |

*(One-click demo autofill buttons are also embedded on both login pages for effortless testing!)*

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v26.13.1)
- **PostgreSQL** 14+ (optional: the application includes an automated embedded database adapter that activates seamlessly if external PostgreSQL credentials are not yet configured)

### 2. Backend Setup & Startup
```powershell
# Navigate to backend directory
cd smart-parking-system/backend

# Verify .env configuration (PORT=5001)
# Start the backend server
node server.js
```
The server will initialize the schema, seed the 4 locations and staff/customer test accounts, and listen on `http://localhost:5001`.

### 3. Frontend Setup & Startup
```powershell
# Open a second terminal and navigate to frontend directory
cd smart-parking-system/frontend

# Start Vite development server
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## 🗄️ PostgreSQL Setup (For External Database Deployment)

To run directly against a standalone PostgreSQL database:

1. Create the database:
```sql
CREATE DATABASE smart_parking_db;
```

2. Execute the schema migration:
```bash
psql -U postgres -d smart_parking_db -f backend/src/database/schema.sql
```

3. Update `backend/.env`:
```ini
PORT=5001
JWT_SECRET=your_super_secret_jwt_key
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_actual_postgres_password
DB_NAME=smart_parking_db
USE_EMBEDDED_DB=false
```

---

## 💳 Payment & External Service Integration Status

- **UPI QR Code Generation**: 100% Functional. Generates real standard UPI payment URLs (`upi://pay?pa=...&am=...`) and renders sharp QR codes compatible with PhonePe, Google Pay, and Paytm.
- **Payment Verification**: Includes a simulated verified gateway confirmation mode per prompt instructions. For live production banking webhooks (Razorpay / Cashfree / Stripe), replace the simulated handler in `customerController.js` (`processPayment`) with their respective webhook signatures.
- **OpenStreetMap / Leaflet**: 100% Functional with live tile layers, dynamic marker clustering, custom HTML pins, and HTML5 Geolocation API without requiring proprietary Google Maps API keys.
