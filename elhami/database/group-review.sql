-- REVIEW ONLY: not applied/deployed. Separate private, membership-bound meeting data.
-- No admin exceptions, journal/profile/workspace reads, external invitations, or AI calls.
BEGIN;
CREATE SCHEMA elhami_groups_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA elhami_groups_private FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA elhami_groups_private TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA elhami_groups_private REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA elhami_groups_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE elhami_groups_private.meetings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id), request_id uuid NOT NULL,
 owner_name text NOT NULL, title text NOT NULL CHECK(length(title) BETWEEN 1 AND 180), scope text NOT NULL CHECK(length(scope)<=2000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')), revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz, UNIQUE(owner_id,request_id)
);
CREATE TABLE elhami_groups_private.members (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id uuid NOT NULL REFERENCES elhami_groups_private.meetings(id),
 user_id uuid NOT NULL REFERENCES auth.users(id), name text NOT NULL, role text NOT NULL CHECK(role IN ('owner','member')),
 joined_at timestamptz NOT NULL DEFAULT now(), UNIQUE(meeting_id,user_id)
);
CREATE TABLE elhami_groups_private.invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id uuid NOT NULL REFERENCES elhami_groups_private.meetings(id),
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','requested','approved','rejected','revoked')),
 requested_by uuid REFERENCES auth.users(id), requester_name text, requested_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE elhami_groups_private.token_attempts (
 actor uuid NOT NULL REFERENCES auth.users(id), attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX token_attempts_actor_time ON elhami_groups_private.token_attempts(actor,attempted_at);
CREATE TABLE elhami_groups_private.contributions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id uuid NOT NULL REFERENCES elhami_groups_private.meetings(id),
 author_id uuid NOT NULL REFERENCES elhami_groups_private.members(id), request_id uuid NOT NULL,
 author_name text NOT NULL, type text NOT NULL CHECK(type IN ('idea','question','reflection','source','disagreement')),
 text text NOT NULL CHECK(length(text) BETWEEN 1 AND 6000), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(author_id,request_id)
);
CREATE TABLE elhami_groups_private.harvests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), meeting_id uuid NOT NULL REFERENCES elhami_groups_private.meetings(id),
 summary text NOT NULL CHECK(length(summary) BETWEEN 1 AND 20000), disagreements text NOT NULL DEFAULT '' CHECK(length(disagreements)<=10000),
 contribution_ids uuid[] NOT NULL, created_by uuid NOT NULL REFERENCES elhami_groups_private.members(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION elhami_groups_private.can_read(p_meeting uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL AND is_anonymous IS FALSE AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now())) AND EXISTS(SELECT 1 FROM elhami_groups_private.members WHERE meeting_id=p_meeting AND user_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION elhami_groups_private.can_read(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION elhami_groups_private.can_read(uuid) TO authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['meetings','members','invitations','token_attempts','contributions','harvests'] LOOP
 EXECUTE format('ALTER TABLE elhami_groups_private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE elhami_groups_private.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON TABLE elhami_groups_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $$;
CREATE POLICY meeting_member_read ON elhami_groups_private.meetings FOR SELECT TO authenticated USING(elhami_groups_private.can_read(id));
CREATE POLICY members_member_read ON elhami_groups_private.members FOR SELECT TO authenticated USING(elhami_groups_private.can_read(meeting_id));
CREATE POLICY contribution_member_read ON elhami_groups_private.contributions FOR SELECT TO authenticated USING(elhami_groups_private.can_read(meeting_id));
CREATE POLICY harvest_member_read ON elhami_groups_private.harvests FOR SELECT TO authenticated USING(elhami_groups_private.can_read(meeting_id));
-- No table grants and no client mutation policies. Only RPC implementation can mutate.
-- Invitation hashes and token attempts deliberately have no read policies.
CREATE FUNCTION elhami_groups_private.snapshot(p_meeting uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m elhami_groups_private.meetings; result jsonb;
BEGIN
 IF NOT elhami_groups_private.can_read(p_meeting) THEN RAISE SQLSTATE '42501' USING MESSAGE='Meeting membership required'; END IF;
 SELECT * INTO m FROM elhami_groups_private.meetings WHERE id=p_meeting;
 result:=jsonb_build_object('id',m.id,'title',m.title,'scope',m.scope,'status',m.status,'revision',m.revision,'isOwner',m.owner_id=auth.uid(),'ownerName',m.owner_name,'createdAt',m.created_at,
 'members',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'role',role) ORDER BY joined_at) FROM elhami_groups_private.members WHERE meeting_id=m.id),'[]'),
 'contributions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'authorId',author_id,'authorName',author_name,'type',type,'text',text,'createdAt',created_at) ORDER BY created_at,id) FROM elhami_groups_private.contributions WHERE meeting_id=m.id),'[]'),
 'harvest',(SELECT jsonb_build_object('id',id,'summary',summary,'disagreements',disagreements,'contributionIds',contribution_ids,'createdAt',created_at) FROM elhami_groups_private.harvests WHERE meeting_id=m.id ORDER BY created_at DESC,id DESC LIMIT 1));
 IF m.owner_id=auth.uid() THEN
  result:=result||jsonb_build_object('requests',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',requester_name,'createdAt',requested_at)) FROM elhami_groups_private.invitations WHERE meeting_id=m.id AND status='requested'),'[]'),
  'invites',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'expiresAt',expires_at,'status',CASE WHEN status='open' AND expires_at<=now() THEN 'expired' ELSE status END)) FROM elhami_groups_private.invitations WHERE meeting_id=m.id),'[]'));
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION elhami_groups_private.snapshot(uuid) FROM PUBLIC,anon,authenticated,service_role;
-- Only private dispatcher calls snapshot (not directly granted to clients).
CREATE FUNCTION elhami_groups_private.dispatch(p_operation text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid(); actor_name text; m elhami_groups_private.meetings; member elhami_groups_private.members; invitation elhami_groups_private.invitations;
 v_meeting_id uuid; raw_token text; action text; result jsonb; n integer;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_actor AND email_confirmed_at IS NOT NULL AND is_anonymous IS FALSE AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now())) THEN RAISE SQLSTATE '42501' USING MESSAGE='Verified account required'; END IF;
 IF p_operation IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>120000 THEN RAISE SQLSTATE '22023' USING MESSAGE='Invalid group payload'; END IF;
 SELECT left(coalesce(nullif(btrim(raw_user_meta_data->>'name'),''),'مشارك'),80) INTO actor_name FROM auth.users WHERE id=v_actor;
 IF p_operation='status' THEN RETURN jsonb_build_object('available',true,'reason',''); END IF;
 IF p_operation='list' THEN
  RETURN jsonb_build_object('meetings',coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'scope',x.scope,'status',x.status,'revision',x.revision,'isOwner',x.owner_id=v_actor,'ownerName',x.owner_name,'createdAt',x.created_at) ORDER BY x.created_at DESC) FROM
   (SELECT mm.* FROM elhami_groups_private.meetings mm JOIN elhami_groups_private.members mb ON mb.meeting_id=mm.id WHERE mb.user_id=v_actor ORDER BY mm.created_at DESC LIMIT 100) x),'[]'),
   'invitations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'title',mm.title,'scope',mm.scope,'status',i.status,'createdAt',i.requested_at)) FROM elhami_groups_private.invitations i JOIN elhami_groups_private.meetings mm ON mm.id=i.meeting_id WHERE i.requested_by=v_actor AND i.status IN ('requested','rejected')),'[]'));
 END IF;
 IF p_operation='create' THEN
  IF length(btrim(coalesce(p_payload->>'title',''))) NOT BETWEEN 1 AND 180 OR length(coalesce(p_payload->>'scope',''))>2000 OR p_payload->>'requestId' IS NULL THEN RAISE SQLSTATE '22023' USING MESSAGE='Invalid meeting'; END IF;
  -- Serialize a caller's create retries and bound abuse before any insert.
  PERFORM pg_advisory_xact_lock(hashtext('elhami-group-create:'||v_actor::text));
  SELECT * INTO m FROM elhami_groups_private.meetings WHERE owner_id=v_actor AND request_id=(p_payload->>'requestId')::uuid;
  IF FOUND THEN RETURN elhami_groups_private.snapshot(m.id); END IF;
  IF (SELECT count(*) FROM elhami_groups_private.meetings WHERE owner_id=v_actor AND created_at>now()-interval '1 day')>=20 THEN RAISE SQLSTATE 'PT429' USING MESSAGE='Meeting daily limit'; END IF;
  INSERT INTO elhami_groups_private.meetings(owner_id,request_id,owner_name,title,scope) VALUES(v_actor,(p_payload->>'requestId')::uuid,actor_name,btrim(p_payload->>'title'),coalesce(p_payload->>'scope','')) RETURNING * INTO m;
  INSERT INTO elhami_groups_private.members(meeting_id,user_id,name,role) VALUES(m.id,v_actor,actor_name,'owner');
  RETURN elhami_groups_private.snapshot(m.id);
 END IF;
 IF p_operation='respond' AND p_payload->>'action'='request' THEN
  -- Per-account rate-limit is committed even for an invalid invitation: return error, don't raise.
  PERFORM pg_advisory_xact_lock(hashtext('elhami-group-token:'||v_actor::text));
  DELETE FROM elhami_groups_private.token_attempts WHERE token_attempts.actor=v_actor AND attempted_at<now()-interval '1 day';
  SELECT count(*) INTO n FROM elhami_groups_private.token_attempts WHERE token_attempts.actor=v_actor AND attempted_at>now()-interval '10 minutes';
  IF n>=5 THEN RETURN jsonb_build_object('error','rate_limited'); END IF;
  INSERT INTO elhami_groups_private.token_attempts(actor) VALUES(v_actor);
  raw_token:=p_payload->>'token';
  IF raw_token IS NULL OR raw_token !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('error','invalid_invitation'); END IF;
  SELECT i.meeting_id INTO v_meeting_id FROM elhami_groups_private.invitations i WHERE token_hash=encode(sha256(convert_to(raw_token,'UTF8')),'hex');
  IF NOT FOUND THEN RETURN jsonb_build_object('error','invalid_invitation'); END IF;
  SELECT * INTO m FROM elhami_groups_private.meetings WHERE id=v_meeting_id FOR UPDATE;
  SELECT * INTO invitation FROM elhami_groups_private.invitations WHERE token_hash=encode(sha256(convert_to(raw_token,'UTF8')),'hex') FOR UPDATE;
  IF invitation.status='requested' AND invitation.requested_by=v_actor THEN RETURN jsonb_build_object('pending',true,'title',m.title,'scope',m.scope); END IF;
  IF invitation.status<>'open' OR invitation.expires_at<=now() OR m.status<>'open' THEN RETURN jsonb_build_object('error','invalid_invitation'); END IF;
  IF EXISTS(SELECT 1 FROM elhami_groups_private.members mb WHERE mb.meeting_id=m.id AND mb.user_id=v_actor) THEN RETURN jsonb_build_object('error','already_member'); END IF;
  UPDATE elhami_groups_private.invitations SET status='requested',requested_by=v_actor,requester_name=actor_name,requested_at=now() WHERE id=invitation.id;
  UPDATE elhami_groups_private.meetings SET revision=revision+1 WHERE id=m.id;
  RETURN jsonb_build_object('pending',true,'title',m.title,'scope',m.scope);
 END IF;
 v_meeting_id:=(p_payload->>'id')::uuid;
 IF NOT elhami_groups_private.can_read(v_meeting_id) THEN RAISE SQLSTATE '42501' USING MESSAGE='Meeting membership required'; END IF;
 IF p_operation='get' THEN RETURN elhami_groups_private.snapshot(v_meeting_id); END IF;
 SELECT * INTO m FROM elhami_groups_private.meetings WHERE id=v_meeting_id FOR UPDATE;
 SELECT * INTO member FROM elhami_groups_private.members mb WHERE mb.meeting_id=m.id AND user_id=v_actor;
 -- Idempotent contribution retries return existing data even when the meeting revision moved.
 IF p_operation='add' AND EXISTS(SELECT 1 FROM elhami_groups_private.contributions WHERE author_id=member.id AND request_id=(p_payload->>'requestId')::uuid) THEN RETURN elhami_groups_private.snapshot(m.id); END IF;
 IF m.revision IS DISTINCT FROM (p_payload->>'revision')::integer THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Meeting changed; refresh before editing'; END IF;
 IF p_operation IN ('invite','revoke','respond','close','harvest') AND m.owner_id<>v_actor THEN RAISE SQLSTATE '42501' USING MESSAGE='Meeting owner required'; END IF;
 IF p_operation<>'harvest' AND m.status<>'open' THEN RAISE SQLSTATE '22023' USING MESSAGE='Meeting closed'; END IF;
 IF p_operation='invite' THEN
  IF (SELECT count(*) FROM elhami_groups_private.invitations i WHERE i.meeting_id=m.id AND i.created_at>now()-interval '1 day')>=50 THEN RAISE SQLSTATE 'PT429' USING MESSAGE='Invitation daily limit'; END IF;
  raw_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  INSERT INTO elhami_groups_private.invitations(meeting_id,token_hash,expires_at) VALUES(m.id,encode(sha256(convert_to(raw_token,'UTF8')),'hex'),now()+interval '2 days') RETURNING * INTO invitation;
  UPDATE elhami_groups_private.meetings SET revision=revision+1 WHERE id=m.id;
  RETURN jsonb_build_object('token',raw_token,'inviteId',invitation.id,'expiresAt',invitation.expires_at,'meeting',elhami_groups_private.snapshot(m.id));
 ELSIF p_operation='revoke' THEN
  UPDATE elhami_groups_private.invitations SET status='revoked' WHERE id=(p_payload->>'inviteId')::uuid AND invitations.meeting_id=m.id AND status IN ('open','requested');
  IF NOT FOUND THEN RAISE SQLSTATE '22023' USING MESSAGE='Invitation unavailable'; END IF;
 ELSIF p_operation='respond' THEN
  action:=p_payload->>'action';
  IF action IS NULL OR action NOT IN ('approve','reject') THEN RAISE SQLSTATE '22023' USING MESSAGE='Invalid response'; END IF;
  SELECT * INTO invitation FROM elhami_groups_private.invitations i WHERE id=(p_payload->>'requestId')::uuid AND i.meeting_id=m.id AND status='requested' FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE '22023' USING MESSAGE='Request unavailable'; END IF;
  IF action='approve' THEN
   IF (SELECT count(*) FROM elhami_groups_private.members mb WHERE mb.meeting_id=m.id)>=100 THEN RAISE SQLSTATE '22023' USING MESSAGE='Meeting membership limit'; END IF;
   IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=invitation.requested_by AND email_confirmed_at IS NOT NULL AND is_anonymous IS FALSE AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now())) THEN RAISE SQLSTATE '42501' USING MESSAGE='Requested account unavailable'; END IF;
   INSERT INTO elhami_groups_private.members(meeting_id,user_id,name,role) VALUES(m.id,invitation.requested_by,invitation.requester_name,'member') ON CONFLICT(meeting_id,user_id) DO NOTHING;
  END IF;
  UPDATE elhami_groups_private.invitations SET status=CASE WHEN action='approve' THEN 'approved' ELSE 'rejected' END WHERE id=invitation.id;
 ELSIF p_operation='add' THEN
  IF p_payload->>'type' IS NULL OR p_payload->>'type' NOT IN ('idea','question','reflection','source','disagreement') OR length(btrim(coalesce(p_payload->>'text',''))) NOT BETWEEN 1 AND 6000 OR p_payload->>'requestId' IS NULL THEN RAISE SQLSTATE '22023' USING MESSAGE='Invalid contribution'; END IF;
  IF (SELECT count(*) FROM elhami_groups_private.contributions c WHERE c.meeting_id=m.id)>=1000 OR (SELECT count(*) FROM elhami_groups_private.contributions WHERE author_id=member.id AND created_at>now()-interval '1 minute')>=10 THEN RAISE SQLSTATE 'PT429' USING MESSAGE='Contribution limit'; END IF;
  INSERT INTO elhami_groups_private.contributions(meeting_id,author_id,request_id,author_name,type,text) VALUES(m.id,member.id,(p_payload->>'requestId')::uuid,member.name,p_payload->>'type',btrim(p_payload->>'text'));
 ELSIF p_operation='close' THEN
  UPDATE elhami_groups_private.meetings SET status='closed',closed_at=now() WHERE id=m.id;
  UPDATE elhami_groups_private.invitations SET status='revoked' WHERE invitations.meeting_id=m.id AND status IN ('open','requested');
 ELSIF p_operation='harvest' THEN
  IF m.status<>'closed' THEN RAISE SQLSTATE '22023' USING MESSAGE='Close meeting before harvest'; END IF;
  IF length(btrim(coalesce(p_payload->>'summary',''))) NOT BETWEEN 1 AND 20000 OR length(coalesce(p_payload->>'disagreements',''))>10000 THEN RAISE SQLSTATE '22023' USING MESSAGE='Invalid harvest'; END IF;
  INSERT INTO elhami_groups_private.harvests(meeting_id,summary,disagreements,contribution_ids,created_by) VALUES(m.id,btrim(p_payload->>'summary'),coalesce(p_payload->>'disagreements',''),coalesce((SELECT array_agg(id ORDER BY created_at,id) FROM elhami_groups_private.contributions c WHERE c.meeting_id=m.id),'{}'::uuid[]),member.id);
 ELSE RAISE SQLSTATE '22023' USING MESSAGE='Unsupported group operation'; END IF;
 UPDATE elhami_groups_private.meetings SET revision=revision+1 WHERE id=m.id;
 RETURN elhami_groups_private.snapshot(m.id);
END $$;
REVOKE ALL ON FUNCTION elhami_groups_private.dispatch(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION elhami_groups_private.dispatch(text,jsonb) TO authenticated;
CREATE FUNCTION public.elhami_group(p_operation text,p_payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT elhami_groups_private.dispatch(p_operation,p_payload); $$;
REVOKE ALL ON FUNCTION public.elhami_group(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.elhami_group(text,jsonb) TO authenticated;
COMMIT;
-- Required tests before deployment: anon denied; nonmember cannot get/add/harvest;
-- pending requester sees no contributions; owner approval binds actual signed-in UID;
-- replay/revoked/expired token denied; only token hash stored; no token in logs;
-- CAS conflicts and idempotent contribution retries; closed blocks additions;
-- unrelated user and platform-admin accounts have no membership bypass.
