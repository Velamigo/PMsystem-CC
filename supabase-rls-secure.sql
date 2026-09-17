-- ============================================
-- ProTrack RLS hardening script
-- 用途：把数据库收敛到 default deny（无任何 policy）
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================
-- 说明：本项目不使用 Supabase Auth，所有读写都经过 api-proxy Edge Function
-- （持有 service_role key，自动绕过 RLS）。因此 public schema 下不建任何 policy：
-- anon / publishable key 什么都读不到。
-- 绝对不要添加 USING (true) 的 policy（见 PLAYBOOK.md 第 2、7 节）。

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 验收：下面这句应返回 0 行
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
