-- Add guest_phone column to scheduling_bookings
ALTER TABLE scheduling_bookings ADD COLUMN IF NOT EXISTS guest_phone TEXT;
