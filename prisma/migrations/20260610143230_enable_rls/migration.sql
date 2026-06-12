-- Enable Row-Level Security on all tables.
-- No policies are defined, so this is default-deny for any role subject to RLS
-- (e.g. Supabase's "anon"/"authenticated" roles via PostgREST).
-- The app connects via DATABASE_URL/DIRECT_URL with a role that has BYPASSRLS,
-- so Prisma access is unaffected.

ALTER TABLE "Shop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShopCredential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceSnapshot" ENABLE ROW LEVEL SECURITY;
