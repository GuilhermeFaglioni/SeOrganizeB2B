-- Rodar no Supabase -> SQL Editor do projeto de PRODUÇÃO
-- Query read-only de diagnostico RBAC (uma linha de resultado)
SELECT
  current_database() AS db,
  to_regclass('public.roles') IS NOT NULL AS roles_table_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='roles' AND column_name='is_admin') AS has_is_admin,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role_id') AS profiles_has_role_id,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='workspace_settings' AND column_name='default_role_id') AS ws_has_default_role,
  EXISTS (SELECT 1 FROM roles WHERE id='00000000-0000-0000-0000-000000000001') AS admin_role_exists,
  (SELECT count(*) FROM profiles) AS total_profiles,
  (SELECT count(role_id) FROM profiles) AS profiles_with_role;
