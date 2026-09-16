-- ============================================
-- ProTrack RLS Security Policies
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

-- 确保所有表启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 删除旧的宽松策略
DROP POLICY IF EXISTS "Allow all on users" ON users;
DROP POLICY IF EXISTS "Allow all on projects" ON projects;
DROP POLICY IF EXISTS "Allow all on tasks" ON tasks;
DROP POLICY IF EXISTS "Allow all on milestones" ON milestones;
DROP POLICY IF EXISTS "Allow all on subtasks" ON subtasks;
DROP POLICY IF EXISTS "Allow all on notifications" ON notifications;
DROP POLICY IF EXISTS "Allow all on settings" ON settings;

-- ============================================
-- 用户表策略
-- ============================================
-- 允许读取用户（登录和管理员审批需要）
CREATE POLICY "users_read" ON users
  FOR SELECT
  USING (true);

-- 允许注册新用户
CREATE POLICY "users_register" ON users
  FOR INSERT
  WITH CHECK (true);

-- 允许更新用户状态（管理员审批、改密码）
CREATE POLICY "users_update" ON users
  FOR UPDATE
  USING (true);

-- ============================================
-- 项目表策略
-- ============================================
CREATE POLICY "projects_read" ON projects
  FOR SELECT
  USING (true);

CREATE POLICY "projects_insert" ON projects
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "projects_update" ON projects
  FOR UPDATE
  USING (true);

CREATE POLICY "projects_delete" ON projects
  FOR DELETE
  USING (true);

-- ============================================
-- 任务表策略
-- ============================================
CREATE POLICY "tasks_read" ON tasks
  FOR SELECT
  USING (true);

CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE
  USING (true);

CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE
  USING (true);

-- ============================================
-- 里程碑表策略
-- ============================================
CREATE POLICY "milestones_read" ON milestones
  FOR SELECT
  USING (true);

CREATE POLICY "milestones_insert" ON milestones
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "milestones_update" ON milestones
  FOR UPDATE
  USING (true);

CREATE POLICY "milestones_delete" ON milestones
  FOR DELETE
  USING (true);

-- ============================================
-- 子任务表策略
-- ============================================
CREATE POLICY "subtasks_read" ON subtasks
  FOR SELECT
  USING (true);

CREATE POLICY "subtasks_insert" ON subtasks
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "subtasks_update" ON subtasks
  FOR UPDATE
  USING (true);

CREATE POLICY "subtasks_delete" ON subtasks
  FOR DELETE
  USING (true);

-- ============================================
-- 通知表策略
-- ============================================
CREATE POLICY "notifications_read" ON notifications
  FOR SELECT
  USING (true);

CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE
  USING (true);

CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE
  USING (true);

-- ============================================
-- 设置表策略
-- ============================================
CREATE POLICY "settings_read" ON settings
  FOR SELECT
  USING (true);

CREATE POLICY "settings_insert" ON settings
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "settings_update" ON settings
  FOR UPDATE
  USING (true);

CREATE POLICY "settings_delete" ON settings
  FOR DELETE
  USING (true);
