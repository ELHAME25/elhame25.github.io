-- REVIEW REQUIRED. Run as one transaction only after approval. No data deletion/migration.
BEGIN;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.elhami_workspace_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 NEW.revision := OLD.revision + 1;
 NEW.updated_at := clock_timestamp();
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS elhami_workspace_revision ON public.workspaces;
CREATE TRIGGER elhami_workspace_revision BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.elhami_workspace_revision();
CREATE OR REPLACE FUNCTION public.elhami_save_workspace(p_expected bigint, p_data jsonb)
RETURNS TABLE(saved_revision bigint) LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_expected IS NULL THEN
   RETURN QUERY INSERT INTO public.workspaces(owner_id,data) VALUES(auth.uid(),p_data)
   ON CONFLICT(owner_id) DO NOTHING RETURNING revision;
 ELSE
   RETURN QUERY UPDATE public.workspaces SET data=p_data
   WHERE owner_id=auth.uid() AND revision=p_expected RETURNING revision;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.elhami_save_workspace(bigint,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.elhami_save_workspace(bigint,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.elhami_workspace_revision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workspaces,public.profiles FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.workspaces,public.profiles FROM authenticated;
-- Existing owner RLS and CRUD remain; no administrator exception.
COMMIT;
