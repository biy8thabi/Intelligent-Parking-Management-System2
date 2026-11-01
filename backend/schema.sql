-- ============================================================
-- Intelligent Parking Management System (IPMS)
-- Database Schema — Developer 1: Backend & Database Lead
-- Run this in Supabase: Project > SQL Editor > New Query
-- ============================================================

-- Enables gen_random_uuid() for UUID primary keys
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. users  (drivers using the mobile app)
-- ------------------------------------------------------------
create table users (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  email         text not null unique,
  password_hash text not null,
  phone_number  text,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. admins  (mall / facility management staff using the web portal)
-- ------------------------------------------------------------
create table admins (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  email         text not null unique,
  password_hash text not null,
  role          text not null default 'admin',
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. parking_spaces  (individual bays)
-- ------------------------------------------------------------
create table parking_spaces (
  id           uuid primary key default gen_random_uuid(),
  zone         text not null,
  bay_number   text not null,
  status       text not null default 'available'
               check (status in ('available', 'occupied', 'disabled')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (zone, bay_number)
);

-- ------------------------------------------------------------
-- 4. parking_sessions  (one row per vehicle's stay)
-- ------------------------------------------------------------
create table parking_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  parking_space_id  uuid not null references parking_spaces(id) on delete restrict,
  entry_time        timestamptz not null default now(),
  vehicle_registration_number  text not null,
  exit_time         timestamptz,
  fee_amount        numeric(10, 2),
  payment_status    text not null default 'unpaid'
                    check (payment_status in ('unpaid', 'paid')),
  session_status    text not null default 'active'
                    check (session_status in ('active', 'completed')),
  created_at        timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. tickets  (QR-code digital ticket tied to a session)
-- ------------------------------------------------------------
create table tickets (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references parking_sessions(id) on delete cascade,
  ticket_code   text not null unique,   -- the string encoded into the QR code
  qr_code_url   text,                   -- optional: link to generated QR image
  issued_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. notifications  (e.g. "lot full" alerts to drivers)
-- ------------------------------------------------------------
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  message     text not null,
  type        text not null default 'general',
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Helpful indexes for common lookups
-- ------------------------------------------------------------
create index idx_sessions_user_id on parking_sessions(user_id);
create index idx_sessions_space_id on parking_sessions(parking_space_id);
create index idx_sessions_status on parking_sessions(session_status);
create index idx_tickets_session_id on tickets(session_id);
create index idx_notifications_user_id on notifications(user_id);
