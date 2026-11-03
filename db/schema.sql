CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL CHECK (length(first_name) BETWEEN 1 AND 100),
  last_name text NOT NULL CHECK (length(last_name) BETWEEN 1 AND 100),
  birth_year int CHECK (birth_year BETWEEN 1900 AND 2100),
  sex text CHECK (sex IN ('F', 'M')),
  height_cm numeric(5, 1) CHECK (height_cm BETWEEN 50 AND 250),
  weight_kg numeric(5, 1) CHECK (weight_kg BETWEEN 10 AND 400),
  occupation text NOT NULL DEFAULT '',
  work_type text CHECK (work_type IN ('sedava', 'stojaca', 'manualna_lahka', 'manualna_tazka', 'zmiesana')),
  activity_level text CHECK (activity_level IN ('nizka', 'stredna', 'vysoka')),
  diagnoses text NOT NULL DEFAULT '',
  limitations text NOT NULL DEFAULT '',
  goals text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patients_name_idx ON patients (last_name, first_name);

CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '',
  target text NOT NULL DEFAULT '',
  video_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS exercises_name_uq ON exercises (lower(name));

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 100000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plans_patient_idx ON plans (patient_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_patient_idx ON conversations (patient_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'model')),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 100000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, created_at)
