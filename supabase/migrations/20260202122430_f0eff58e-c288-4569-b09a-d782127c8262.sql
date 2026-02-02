-- Add missing heading_text_2 column to partners table
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS heading_text_2 text;