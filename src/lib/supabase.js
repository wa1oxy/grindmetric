import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── SQL to run in Supabase SQL editor ──────────────────────────────────────
// create table workouts (
//   id uuid primary key default gen_random_uuid(),
//   user_id uuid references auth.users not null,
//   exercise text not null,
//   weight numeric not null,
//   reps integer not null,
//   sets integer not null,
//   created_at timestamptz default now(),
//   synced boolean default true
// );
// create table foods (
//   id uuid primary key default gen_random_uuid(),
//   user_id uuid references auth.users not null,
//   food_name text not null,
//   calories integer not null,
//   protein_g integer default 0,
//   carbs_g integer default 0,
//   fat_g integer default 0,
//   created_at timestamptz default now(),
//   synced boolean default true
// );
// create table weight_logs (
//   id uuid primary key default gen_random_uuid(),
//   user_id uuid references auth.users not null,
//   weight_kg numeric not null,
//   log_date date default current_date,
//   created_at timestamptz default now(),
//   synced boolean default true
// );
// create table progress_photos (
//   id uuid primary key default gen_random_uuid(),
//   user_id uuid references auth.users not null,
//   photo_url text,
//   uploaded_at timestamptz default now(),
//   gemini_feedback text,
//   synced boolean default true
// );
// -- Enable RLS on all tables and add policies for authenticated users
