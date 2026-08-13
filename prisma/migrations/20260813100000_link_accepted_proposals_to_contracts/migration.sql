ALTER TABLE "proposals" ADD COLUMN "contract_id" TEXT;

CREATE UNIQUE INDEX "proposals_contract_id_key" ON "proposals"("contract_id");

ALTER TABLE "proposals" ADD CONSTRAINT "proposals_contract_id_fkey"
  FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
