-- GrindMetric Database Schema
-- Run this in your Supabase SQL Editor (https://app.supabase.com → your project → SQL Editor)

-- Users / Profiles
create table if not exists gm_users (
  id text primary key,
  name text not null,
  email text not null,
  goal text,
  days_per_week integer,
  session_duration integer,
  preferred_time text,
  intensity integer,
  age integer,
  weight_kg numeric,
  height_cm numeric,
  sex text,
  additional_notes text,
  workout_plan text,
  onboarded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Workouts
create table if not exists gm_workouts (
  id text primary key,
  user_id text not null references gm_users(id) on delete cascade,
  exercise text not null,
  weight numeric,
  reps integer,
  sets integer,
  created_at timestamptz not null
);

-- Foods / Nutrition logs
create table if not exists gm_foods (
  id text primary key,
  user_id text not null references gm_users(id) on delete cascade,
  food_name text not null,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  created_at timestamptz not null
);

-- Weight logs
create table if not exists gm_weight_logs (
  id text primary key,
  user_id text not null references gm_users(id) on delete cascade,
  weight_kg numeric not null,
  log_date date,
  created_at timestamptz not null
);

-- Invite Codes
create table if not exists gm_invite_codes (
  id text primary key,
  code text not null unique,
  created_at timestamptz default now(),
  used boolean default false,
  used_by text,
  used_at timestamptz
);

-- Enable Row Level Security
alter table gm_users enable row level security;
alter table gm_workouts enable row level security;
alter table gm_foods enable row level security;
alter table gm_weight_logs enable row level security;
alter table gm_invite_codes enable row level security;

-- Allow all operations via anon key (app filters by user_id)
create policy "anon_all" on gm_users for all using (true) with check (true);
create policy "anon_all" on gm_workouts for all using (true) with check (true);
create policy "anon_all" on gm_foods for all using (true) with check (true);
create policy "anon_all" on gm_weight_logs for all using (true) with check (true);
create policy "anon_all" on gm_invite_codes for all using (true) with check (true);
