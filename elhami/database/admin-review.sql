-- REVIEW ONLY. Not applied. Do not deploy before operator review + transactional tests.
-- Requires existing elhami_private.is_full_admin() and admin_roles bootstrap.
-- Does not alter/read profiles, workspaces, journals, storage, or private user content.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE elhami_private.editorial_content (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 180),
 summary text NOT NULL DEFAULT '' CHECK(length(summary)<=1000), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 100000),
 sources jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(sources)='array' AND length(sources::text)<=22000),
 revision integer NOT NULL DEFAULT 1, reviewed_revision integer, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','published','archived')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE elhami_private.editorial_versions (
 content_id uuid NOT NULL REFERENCES elhami_private.editorial_content(id), revision integer NOT NULL,
 title text NOT NULL, summary text NOT NULL, body text NOT NULL, sources jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), actor uuid NOT NULL, PRIMARY KEY(content_id,revision)
);
CREATE TABLE elhami_private.admin_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor uuid NOT NULL, action text NOT NULL,
 resource_id text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE elhami_private.editorial_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), value jsonb NOT NULL DEFAULT '{"site_title":"إلهامي","editorial_note":""}'
);
INSERT INTO elhami_private.editorial_settings DEFAULT VALUES;
-- Operator-issued, one-use explicit authorization. No client writes/grants.
CREATE TABLE elhami_private.role_change_approvals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), target_id uuid NOT NULL REFERENCES auth.users(id),
 desired_role text NOT NULL CHECK(desired_role IN ('full_admin','none')), authorization_ref text NOT NULL CHECK(length(authorization_ref) BETWEEN 1 AND 200),
 expires_at timestamptz NOT NULL, consumed_at timestamptz
);
CREATE TABLE public.elhami_published_content (
 id uuid PRIMARY KEY, title text NOT NULL, summary text NOT NULL, body text NOT NULL,
 sources jsonb NOT NULL, revision integer NOT NULL, published_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.elhami_published_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.elhami_published_content FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.elhami_published_content TO anon,authenticated;
CREATE POLICY published_read ON public.elhami_published_content FOR SELECT TO anon,authenticated USING(true);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['editorial_content','editorial_versions','admin_audit','editorial_settings','role_change_approvals'] LOOP
 EXECUTE format('ALTER TABLE elhami_private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE elhami_private.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON TABLE elhami_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $$;
-- A single private implementation reduces duplicated authorization checks.
CREATE FUNCTION elhami_private.admin_dispatch(op text,args jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE c elhami_private.editorial_content; v_id uuid; v_revision integer; result jsonb; section text;
 approval elhami_private.role_change_approvals; target uuid; clean_sources jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT elhami_private.is_full_admin() THEN RAISE SQLSTATE '42501' USING MESSAGE='Admin authorization required'; END IF;
 IF jsonb_typeof(args) IS DISTINCT FROM 'object' OR octet_length(args::text)>500000 THEN RAISE SQLSTATE '22023' USING MESSAGE='Invalid admin payload'; END IF;
 IF op='read' THEN
  section:=args->>'section';
  IF section IN ('content','sources','overview') THEN
   SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC),'[]') INTO result FROM
    (SELECT * FROM elhami_private.editorial_content WHERE section<>'sources' OR status<>'archived' ORDER BY updated_at DESC LIMIT 100) x;
   RETURN jsonb_build_object('items',result,'counts',jsonb_build_object(
    'published',(SELECT count(*) FROM public.elhami_published_content),
    'review',(SELECT count(*) FROM elhami_private.editorial_content WHERE status<>'archived' AND reviewed_revision IS DISTINCT FROM revision),
    'draft',(SELECT count(*) FROM elhami_private.editorial_content WHERE status='draft'),
    'team',(SELECT count(*) FROM elhami_private.admin_roles)));
  ELSIF section='team' THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'handle','إدارة · '||left(user_id::text,8),'role',role)),'[]') INTO result FROM elhami_private.admin_roles;
   RETURN jsonb_build_object('items',result);
  ELSIF section='audit' THEN
   SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]') INTO result FROM
    (SELECT action,resource_id,created_at,'إدارة · '||left(actor::text,8) AS actor_handle FROM elhami_private.admin_audit ORDER BY created_at DESC LIMIT 100) x;
   RETURN jsonb_build_object('items',result);
  ELSIF section='settings' THEN
   RETURN jsonb_build_object('settings',(SELECT value FROM elhami_private.editorial_settings WHERE singleton));
  ELSE
   -- No fabricated meetings/support/agent data. Separate reviewed services required.
   RAISE SQLSTATE 'PT404' USING MESSAGE='Service not provisioned';
  END IF;
 ELSIF op='versions' THEN
  v_id:=(args->>'id')::uuid;
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.revision DESC),'[]') INTO result FROM
   (SELECT revision,title,summary,body,sources,created_at FROM elhami_private.editorial_versions WHERE content_id=v_id ORDER BY revision DESC LIMIT 100) x;
  RETURN result;
 ELSIF op='save' THEN
  IF jsonb_typeof(args->'sources') IS DISTINCT FROM 'array' THEN RAISE SQLSTATE '22023' USING MESSAGE='Sources must be an array'; END IF;
  IF args->>'title' IS NULL OR length(btrim(args->>'title')) NOT BETWEEN 1 AND 180 OR args->>'body' IS NULL OR length(args->>'body') NOT BETWEEN 1 AND 100000 OR length(coalesce(args->>'summary',''))>1000
   OR jsonb_typeof(args->'sources') IS DISTINCT FROM 'array' OR length((args->'sources')::text)>22000
   OR jsonb_array_length(args->'sources')>20 OR (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(args->'sources') e)<>jsonb_array_length(args->'sources') OR EXISTS(SELECT 1 FROM jsonb_array_elements(args->'sources') AS e WHERE jsonb_typeof(e)<>'object' OR length(coalesce(e->>'id','')) NOT BETWEEN 1 AND 100 OR length(btrim(coalesce(e->>'title',''))) NOT BETWEEN 1 AND 300 OR length(btrim(coalesce(e->>'text',''))) NOT BETWEEN 1 AND 5000 OR length(coalesce(e->>'locator',''))>1000 OR (e->>'page' IS NOT NULL AND (e->>'page' !~ '^[1-9][0-9]{0,6}$'))) THEN RAISE SQLSTATE '22023' USING MESSAGE='Invalid editorial content'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',e->>'id','title',e->>'title','text',e->>'text','page',(e->>'page')::integer,'locator',coalesce(e->>'locator',''),'verified',false)),'[]') INTO clean_sources FROM jsonb_array_elements(args->'sources') e;
  v_id:=nullif(args->>'id','')::uuid;
  IF v_id IS NULL THEN
   INSERT INTO elhami_private.editorial_content(title,summary,body,sources) VALUES(btrim(args->>'title'),coalesce(args->>'summary',''),args->>'body',clean_sources) RETURNING * INTO c;
  ELSE
   SELECT * INTO c FROM elhami_private.editorial_content WHERE id=v_id FOR UPDATE;
   IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Content not found'; END IF;
   IF c.revision IS DISTINCT FROM (args->>'revision')::integer THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Newer version exists'; END IF;
   UPDATE elhami_private.editorial_content SET title=btrim(args->>'title'),summary=coalesce(args->>'summary',''),body=args->>'body',sources=clean_sources,revision=revision+1,reviewed_revision=NULL,status='draft',updated_at=now() WHERE id=v_id RETURNING * INTO c;
  END IF;
  INSERT INTO elhami_private.editorial_versions(content_id,revision,title,summary,body,sources,actor) VALUES(c.id,c.revision,c.title,c.summary,c.body,c.sources,auth.uid());
  INSERT INTO elhami_private.admin_audit(actor,action,resource_id) VALUES(auth.uid(),'حفظ نسخة تحريرية',c.id::text);
  RETURN jsonb_build_object('id',c.id,'revision',c.revision);
 ELSIF op='action' THEN
  SELECT * INTO c FROM elhami_private.editorial_content WHERE id=(args->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Content not found'; END IF;
  IF c.revision IS DISTINCT FROM (args->>'revision')::integer THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Newer version exists'; END IF;
  IF args->>'action'='review' THEN
   IF jsonb_array_length(c.sources)=0 OR c.status='archived' THEN RAISE SQLSTATE '22023' USING MESSAGE='Sources required for review'; END IF;
   UPDATE elhami_private.editorial_content SET reviewed_revision=revision,status='review',updated_at=now() WHERE id=c.id;
  ELSIF args->>'action'='publish' THEN
   IF c.reviewed_revision IS DISTINCT FROM c.revision OR c.status='archived' THEN RAISE SQLSTATE '22023' USING MESSAGE='Review current revision before publish'; END IF;
   INSERT INTO public.elhami_published_content(id,title,summary,body,sources,revision) VALUES(c.id,c.title,c.summary,c.body,(SELECT jsonb_agg(e||jsonb_build_object('verified',true)) FROM jsonb_array_elements(c.sources) e),c.revision)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,summary=excluded.summary,body=excluded.body,sources=excluded.sources,revision=excluded.revision,published_at=now();
   UPDATE elhami_private.editorial_content SET status='published',updated_at=now() WHERE id=c.id;
  ELSIF args->>'action'='archive' THEN
   DELETE FROM public.elhami_published_content WHERE id=c.id;
   UPDATE elhami_private.editorial_content SET status='archived',updated_at=now() WHERE id=c.id;
  ELSE RAISE SQLSTATE '22023' USING MESSAGE='Unsupported action'; END IF;
  INSERT INTO elhami_private.admin_audit(actor,action,resource_id) VALUES(auth.uid(),args->>'action',c.id::text);
  RETURN jsonb_build_object('ok',true);
 ELSIF op='settings' THEN
  IF length(btrim(coalesce(args->'settings'->>'site_title',''))) NOT BETWEEN 1 AND 100 OR length(coalesce(args->'settings'->>'editorial_note',''))>1000 THEN RAISE SQLSTATE '22023' USING MESSAGE='Invalid settings'; END IF;
  UPDATE elhami_private.editorial_settings SET value=jsonb_build_object('site_title',btrim(args->'settings'->>'site_title'),'editorial_note',coalesce(args->'settings'->>'editorial_note','')) WHERE singleton;
  INSERT INTO elhami_private.admin_audit(actor,action,resource_id) VALUES(auth.uid(),'تحديث إعدادات النشر','editorial_settings');
  RETURN jsonb_build_object('ok',true);
 ELSIF op='role' THEN
  PERFORM pg_advisory_xact_lock(hashtext('elhami-admin-role-change-v1'));
  SELECT * INTO approval FROM elhami_private.role_change_approvals WHERE id=(args->>'approval')::uuid AND consumed_at IS NULL AND expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE '42501' USING MESSAGE='Explicit operator authorization required'; END IF;
  -- Recheck after acquiring lock; concurrent revocation cannot grant onward.
  IF NOT elhami_private.is_full_admin() THEN RAISE SQLSTATE '42501' USING MESSAGE='Admin authorization required'; END IF;
  target:=approval.target_id;
  IF target=auth.uid() THEN RAISE SQLSTATE '42501' USING MESSAGE='Self role changes forbidden'; END IF;
  IF approval.desired_role='none' THEN
   IF (SELECT count(*) FROM elhami_private.admin_roles WHERE role='full_admin')<=1 THEN RAISE SQLSTATE '42501' USING MESSAGE='Last admin protected'; END IF;
   DELETE FROM elhami_private.admin_roles WHERE user_id=target;
  ELSE
   IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=target AND email_confirmed_at IS NOT NULL AND is_anonymous IS FALSE AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now())) THEN RAISE SQLSTATE '42501' USING MESSAGE='Verified account required'; END IF;
   INSERT INTO elhami_private.admin_roles(user_id,role,assignment_ref) VALUES(target,'full_admin',left(approval.authorization_ref,120)) ON CONFLICT(user_id) DO NOTHING;
  END IF;
  UPDATE elhami_private.role_change_approvals SET consumed_at=now() WHERE id=approval.id;
  INSERT INTO elhami_private.admin_audit(actor,action,resource_id) VALUES(auth.uid(),'role:'||approval.desired_role,target::text);
  RETURN jsonb_build_object('ok',true);
 END IF;
 RAISE SQLSTATE '22023' USING MESSAGE='Unsupported operation';
END $$;
REVOKE ALL ON FUNCTION elhami_private.admin_dispatch(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION elhami_private.admin_dispatch(text,jsonb) TO authenticated;
CREATE FUNCTION public.elhami_admin_read(p_section text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT elhami_private.admin_dispatch('read',jsonb_build_object('section',p_section)); $$;
REVOKE ALL ON FUNCTION public.elhami_admin_read(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.elhami_admin_read(text) TO authenticated;
CREATE FUNCTION public.elhami_admin_versions(p_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT elhami_private.admin_dispatch('versions',jsonb_build_object('id',p_id)); $$;
REVOKE ALL ON FUNCTION public.elhami_admin_versions(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.elhami_admin_versions(uuid) TO authenticated;
CREATE FUNCTION public.elhami_admin_content_save(p_id uuid,p_revision integer,p_title text,p_summary text,p_body text,p_sources jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT elhami_private.admin_dispatch('save',jsonb_build_object('id',p_id,'revision',p_revision,'title',p_title,'summary',p_summary,'body',p_body,'sources',p_sources)); $$;
REVOKE ALL ON FUNCTION public.elhami_admin_content_save(uuid,integer,text,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.elhami_admin_content_save(uuid,integer,text,text,text,jsonb) TO authenticated;
CREATE FUNCTION public.elhami_admin_content_action(p_id uuid,p_revision integer,p_action text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT elhami_private.admin_dispatch('action',jsonb_build_object('id',p_id,'revision',p_revision,'action',p_action)); $$;
REVOKE ALL ON FUNCTION public.elhami_admin_content_action(uuid,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.elhami_admin_content_action(uuid,integer,text) TO authenticated;
CREATE FUNCTION public.elhami_admin_settings_save(p_settings jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT elhami_private.admin_dispatch('settings',jsonb_build_object('settings',p_settings)); $$;
REVOKE ALL ON FUNCTION public.elhami_admin_settings_save(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.elhami_admin_settings_save(jsonb) TO authenticated;
CREATE FUNCTION public.elhami_admin_role_apply(p_approval uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT elhami_private.admin_dispatch('role',jsonb_build_object('approval',p_approval)); $$;
REVOKE ALL ON FUNCTION public.elhami_admin_role_apply(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.elhami_admin_role_apply(uuid) TO authenticated;
COMMIT;
-- Review requirements: verify both approved admins; deny anon + normal user on every RPC;
-- verify direct private-table access denied; draft edits preserve published snapshot;
-- test stale-revision conflict, source review before publish, archive removes public copy;
-- test immutable versions, operator approval consumption, self/last-admin protection.
