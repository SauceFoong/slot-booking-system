-- Add partial unique index to ensure only one CONFIRMED booking per slot
-- This allows multiple CANCELLED bookings (for history) but enforces single CONFIRMED booking

CREATE UNIQUE INDEX "unique_confirmed_booking_per_slot" 
ON "Booking" ("slotId") 
WHERE status = 'CONFIRMED';
