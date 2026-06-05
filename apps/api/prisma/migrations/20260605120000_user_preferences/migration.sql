-- E1 email opt-in + E5 quiet hours stored on User.preferences JSON
ALTER TABLE "users" ADD COLUMN "preferences" JSONB NOT NULL DEFAULT '{}';
