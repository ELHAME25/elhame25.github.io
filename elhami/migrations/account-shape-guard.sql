-- Root review/execution only. No content reads, scans, updates, deletes, or validation of old rows.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.workspaces'::regclass AND conname='elhami_workspace_shape_v2') THEN
  ALTER TABLE public.workspaces ADD CONSTRAINT elhami_workspace_shape_v2 CHECK ((
   jsonb_typeof(data)='object'
   AND data ?& ARRAY['sessions','summaries','references']::text[]
   AND jsonb_typeof(data->'sessions')='array'
   AND jsonb_typeof(data->'summaries')='array'
   AND jsonb_typeof(data->'references')='array'
  ) IS TRUE) NOT VALID;
 END IF;
END $$;
COMMIT;
-- NOT VALID avoids scanning old rows; PostgreSQL still enforces this for new/updated rows.
-- Existing size and NOT NULL constraints remain. RPC writes receive the same enforced check.
