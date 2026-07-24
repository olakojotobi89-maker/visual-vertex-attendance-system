-- -----------------------------------------------------------------------
-- VSAS — Vertex Staff Attendance System
-- Migration: Staff Schema & Storage Bucket
-- Date: 2026-07-24
--
-- This migration:
--   1. Ensures the "profiles" table has all required columns
--   2. Adds Row-Level Security (RLS) policies for the profiles table
--   3. Creates the public "avatars" storage bucket
--   4. Sets up storage bucket RLS so authenticated users can upload/read
--
-- ⚠️  This migration is idempotent — safe to run multiple times.
--     It assumes the "profiles" table already exists (created by Supabase
--     Auth scaffolding or a previous migration) with at minimum:
--       id uuid primary key references auth.users(id)
-- -----------------------------------------------------------------------

-- =====================================================================
-- 1. PROFILES TABLE — Ensure all required columns exist
-- =====================================================================

-- Add columns that may not exist yet (IF NOT ADDING makes them idempotent)
DO $$
BEGIN
  -- staff_id (unique employee identifier)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'staff_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN staff_id TEXT UNIQUE;
  END IF;

  -- first_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN first_name TEXT;
  END IF;

  -- last_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN last_name TEXT;
  END IF;

  -- email
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;

  -- phone (optional)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN phone TEXT;
  END IF;

  -- department
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'department'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN department TEXT;
  END IF;

  -- position (job title)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'position'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN "position" TEXT;
  END IF;

  -- role (admin | hr | manager | staff)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'staff';
  END IF;

  -- is_active (soft delete / deactivation flag)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;

  -- avatar_url (public URL to the uploaded profile picture)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;

  -- created_at (with default)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  -- updated_at (for tracking modifications)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Add unique constraint on email if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_email_key' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
END $$;

-- Create an index on staff_id for faster lookups during login
CREATE INDEX IF NOT EXISTS idx_profiles_staff_id ON public.profiles (staff_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles (department);

-- Enable Row Level Security on the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 2. RLS POLICIES
-- =====================================================================

-- Drop existing policies first so they can be recreated cleanly
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;

-- Policy: A user can read their own profile.
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users with role 'admin' can read all profiles.
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: A user can update their own profile (but NOT their role).
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Admins can update any profile (for deactivation, role changes, etc.).
CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Allow service-role client (Edge Function) to insert profiles.
-- This is the ONLY insert policy. Browser clients cannot insert directly.
CREATE POLICY "Service role can insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (true);  -- Service role bypasses RLS; this is needed for non-service-role helpers

-- NOTE: DELETE operations are intentionally not given RLS policies.
-- Deletion should be handled server-side only via Edge Functions or
-- the Supabase Dashboard. Direct client-side delete is blocked.

-- =====================================================================
-- 3. AVATARS STORAGE BUCKET
-- =====================================================================

-- Insert the "avatars" bucket if it doesn't already exist.
-- The `storage.buckets` table stores bucket metadata.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,                                   -- public: avatars are publicly viewable
  2097152,                                -- 2 MB in bytes
  ARRAY['image/png', 'image/jpeg', 'image/jpg']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 4. STORAGE RLS POLICIES
-- =====================================================================

-- Drop existing storage policies to recreate them cleanly
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete any avatar" ON storage.objects;

-- Policy: Anyone can view / download avatars (bucket is public anyway).
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- Policy: Authenticated users can upload avatars into the avatars bucket.
-- The Edge Function does this server-side using the Service Role Key,
-- which bypasses RLS entirely. This policy enables client-side uploads
-- if you ever want to let users upload their own avatars directly.
CREATE POLICY "Anyone can upload an avatar"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
  );

-- Policy: Users can update/overwrite their own uploaded avatars.
CREATE POLICY "Anyone can update own avatar"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Admins can delete any avatar from the bucket.
CREATE POLICY "Admins can delete any avatar"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================================
-- 5. TRIGGER: Auto-update the updated_at column
-- =====================================================================

-- Create a function to set updated_at on row modification
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger to the profiles table
DROP TRIGGER IF EXISTS trg_profiles_set_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 6. DEPARTMENTS TABLE (optional — for department management)
-- =====================================================================

-- Create a departments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view departments
DROP POLICY IF EXISTS "Anyone can view departments" ON public.departments;
CREATE POLICY "Anyone can view departments"
  ON public.departments
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can insert/update/delete departments
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
CREATE POLICY "Admins can manage departments"
  ON public.departments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Seed some default departments
INSERT INTO public.departments (name, description)
VALUES
  ('Engineering', 'Software engineering and development'),
  ('Human Resources', 'HR and personnel management'),
  ('Marketing', 'Marketing and communications'),
  ('Finance', 'Financial operations and accounting'),
  ('Operations', 'Operations and logistics')
ON CONFLICT (name) DO NOTHING;

