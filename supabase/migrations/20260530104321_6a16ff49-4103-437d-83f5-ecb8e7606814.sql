
DROP POLICY IF EXISTS "outages_insert_auth" ON public.outages;
DROP POLICY IF EXISTS "outages_update_auth" ON public.outages;
DROP POLICY IF EXISTS "reports_insert_own" ON public.outage_reports;
REVOKE INSERT, UPDATE ON public.outages FROM authenticated;
REVOKE INSERT ON public.outage_reports FROM authenticated;
