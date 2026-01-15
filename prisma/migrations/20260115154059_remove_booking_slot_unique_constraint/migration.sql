-- DropIndex
DROP INDEX "Booking_slotId_key";

-- CreateIndex
CREATE INDEX "Booking_slotId_idx" ON "Booking"("slotId");
