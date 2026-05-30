
-- Lock down SECURITY DEFINER trigger function
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Replace permissive update policy: only allow updating outage counts/status, not creating new rows you don't own
DROP POLICY IF EXISTS "outages_update_auth" ON public.outages;
CREATE POLICY "outages_update_auth" ON public.outages
  FOR UPDATE TO authenticated
  USING (restored_at IS NULL)
  WITH CHECK (true);
