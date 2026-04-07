-- Add optional title column for shifts
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS title TEXT;
