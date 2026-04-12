-- Add team_mode column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_mode TEXT NOT NULL DEFAULT 'solo' CHECK (team_mode IN ('solo', 'team'));
