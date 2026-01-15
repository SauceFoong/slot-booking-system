-- Enable required extension
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Ensure endTime is after startTime
ALTER TABLE "Slot"
ADD CONSTRAINT "slot_valid_time_range"
CHECK ("endTime" > "startTime");

-- Prevent ANY overlapping slots for the same host
ALTER TABLE "Slot"
ADD CONSTRAINT "slot_no_overlap"
EXCLUDE USING gist (
    "hostId" WITH =,
    tsrange("startTime", "endTime", '[)') WITH &&
);

