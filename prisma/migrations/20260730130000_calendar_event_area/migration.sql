ALTER TABLE "calendar_events"
ADD COLUMN "area_id" TEXT;

CREATE INDEX "calendar_events_area_id_idx"
ON "calendar_events"("area_id");

ALTER TABLE "calendar_events"
ADD CONSTRAINT "calendar_events_area_id_fkey"
FOREIGN KEY ("area_id") REFERENCES "team_areas"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
