CREATE TABLE IF NOT EXISTS teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  invite_code text UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  menu_name text NOT NULL,
  action text CHECK (action IN ('ok','pass')),
  voter_name text NOT NULL,
  voted_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  menu_name text NOT NULL,
  eaten_at date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS votes REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS members REPLICA IDENTITY FULL;
