-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "chat_id" TEXT NOT NULL,
    "chat_type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fakultet" TEXT,
    "kurs" TEXT NOT NULL,
    "guruh" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriptions_chat_id_idx" ON "subscriptions"("chat_id");

-- CreateIndex
CREATE INDEX "subscriptions_is_active_idx" ON "subscriptions"("is_active");

-- CreateIndex
CREATE INDEX "subscriptions_time_idx" ON "subscriptions"("time");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
