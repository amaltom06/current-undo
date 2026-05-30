
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  kseb_section TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Outages: a cluster representing a current/past outage event
CREATE TABLE public.outages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_name TEXT,
  kseb_section TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  report_count INT NOT NULL DEFAULT 1,
  restored_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unverified', -- unverified | likely | verified | restored
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  restored_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX outages_active_idx ON public.outages (status) WHERE restored_at IS NULL;
CREATE INDEX outages_started_idx ON public.outages (started_at DESC);
GRANT SELECT ON public.outages TO anon, authenticated;
GRANT INSERT, UPDATE ON public.outages TO authenticated;
GRANT ALL ON public.outages TO service_role;
ALTER TABLE public.outages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outages_select_all" ON public.outages FOR SELECT USING (true);
CREATE POLICY "outages_insert_auth" ON public.outages FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "outages_update_auth" ON public.outages FOR UPDATE TO authenticated USING (true);

-- Individual user reports tied to an outage
CREATE TABLE public.outage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outage_id UUID NOT NULL REFERENCES public.outages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('outage','restored')),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (outage_id, user_id, report_type)
);
CREATE INDEX outage_reports_outage_idx ON public.outage_reports (outage_id);
GRANT SELECT ON public.outage_reports TO anon, authenticated;
GRANT INSERT ON public.outage_reports TO authenticated;
GRANT ALL ON public.outage_reports TO service_role;
ALTER TABLE public.outage_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_select_all" ON public.outage_reports FOR SELECT USING (true);
CREATE POLICY "reports_insert_own" ON public.outage_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.outages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outage_reports;
