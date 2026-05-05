ALTER TABLE "passkeys" ALTER COLUMN "transports" TYPE text USING array_to_string("transports", ',');
