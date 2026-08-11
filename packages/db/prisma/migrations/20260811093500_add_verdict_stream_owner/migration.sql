CREATE TABLE "verdict_stream_owner" (
    "run_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verdict_stream_owner_pkey" PRIMARY KEY ("run_id")
);

CREATE INDEX "verdict_stream_owner_device_app_idx"
    ON "verdict_stream_owner"("device_id", "app_id");
