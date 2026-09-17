# 全栈小团队 Web 项目实战说明书（Playbook）

> 适用场景：内部小团队（3-10 人）使用的 Web 管理系统，需要：代码托管 GitHub + 云端数据库 Supabase + 免费网页部署 Cloudflare + 多用户登录 + 管理员审批 + 安全防护。
> 用法：新项目开工时把本文件交给 agent，按阶段执行，可跳过所有我们踩过的坑。
> 来源项目：PMsystem-CC（React + Vite + TS + Supabase Edge Functions + Cloudflare Workers Assets）

---

## 0. 目标架构（最终形态）

```
浏览器（团队用户）
   │  HTTPS（不带任何密钥）
   ▼
Cloudflare Workers Assets（静态前端，私有 GitHub 仓库自动构建）
   │  POST {operation, params, authToken}
   ▼
Supabase Edge Function（唯一后端入口，api-proxy）
   │  service_role key（只存在于 Supabase 服务端环境变量）
   ▼
Supabase PostgreSQL（RLS 全锁：无任何 policy，直接 API 访问返回空）
```

核心原则：
1. **前端代码里永远不出现任何 API key / service_role key / 默认密码。**
2. **所有数据库操作必须经过 Edge Function 中转**，由它在服务端验证身份和权限。
3. **数据库 RLS 启用且不建任何 policy**（default deny）。service_role 自动绕过 RLS，anon/publishable key 什么都读不到。
4. **密码只在服务端哈希和验证**（加盐 SHA-256，格式 `salt:hash`），前端只传明文密码走 HTTPS，响应里永远不返回 `password_hash`。

---

## 1. 阶段一：代码托管 GitHub

1. `git init`，`.gitignore` 至少包含 `node_modules/`、`dist/`。
2. 建仓库后推送。**不要在代码或 commit 里放任何密钥**（本次项目的 git 历史里遗留过 anon key，是反面教材）。
3. 内部工具建议**直接建 Private 仓库**（Cloudflare 支持私有仓库部署；GitHub Pages 免费版不支持私有仓库，这是选 Cloudflare 的原因之一）。
4. 本机推送需要凭证时用一个有 repo 权限的 PAT，用完提醒用户可吊销。

## 2. 阶段二：Supabase 数据库

### 2.1 建项目
- 新建 Supabase 项目，记录 project ref（URL 里的那串）。
- **不要轮换 JWT signing key**（本次事故根源：密钥从 HS256 轮换到 ECC 后，旧 JWT anon key 全部 401）。如果必须轮换，同步重新生成所有 key。

### 2.2 建表 SQL 模板（在 SQL Editor 运行）
注意：**SQL 里不要写 `--` 注释行**（Supabase SQL Editor 曾因此报 syntax error）。

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 业务表模板：必须有 user_id 归属列 + created_at
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  visibility TEXT NOT NULL DEFAULT 'PERSONAL',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;
```

### 2.3 RLS 铁律
- 每张表 `ENABLE ROW LEVEL SECURITY` 且**不创建任何 policy**（default deny）。
- **千万不要建 `USING (true)` 的 policy**（本次事故：早期脚本建了全放行 policy，导致拿 publishable key 就能读全表含密码哈希）。
- 如果历史遗留了 policy，用 `SELECT tablename, policyname FROM pg_policies WHERE schemaname='public';` 查出来逐条 `DROP POLICY`。
- service_role key 自动绕过 RLS，Edge Function 用它即可，不需要给 anon 开任何口子。

### 2.4 表结构纪律
- **表结构必须和 Edge Function / 前端字段一一对应**。本次事故：业务表缺列导致所有 upsert 静默失败（返回 null），功能全坏但登录正常，极难发现。
- 写操作必须检查 `error` 并抛出，**禁止吞错误返回 null**。
- 每张业务表带 `user_id` 归属列（创建者），服务端所有读写都先过归属/可见性校验（见 §6.1）。
- 云端真实结构以 `information_schema.columns` 为准，`supabase-schema.sql` 是同步过的快照；改完表结构记得回写这个文件。

## 3. 阶段三：Edge Function 后端（唯一 API 入口）

### 3.1 部署方式
- Dashboard → Edge Functions → 新建 `api-proxy` → 粘贴代码 → Deploy。
- **不需要手动配 DB_URL / SERVICE_ROLE_KEY**：Supabase 自动注入内置变量 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`（本次事故：手动配的自定义 secret 一度没生效，改用内置变量后解决）。
- Function Settings 里 **Verify JWT 设为 OFF**（我们用自定义 authToken 鉴权，不依赖 Supabase JWT）。

### 3.2 代码骨架（必备安全件，缺一不可）

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = ['https://你的域名', 'http://localhost:5173']

// 1) 加盐哈希：存 "salt:hash"
async function hashPassword(password: string, salt?: string) { /* SHA-256(salt+password) */ }
async function verifyPassword(password: string, stored: string) { /* 拆 salt 重算比对 */ }

// 2) 基于数据库的限流（内存 Map 不行！Edge 多 isolate 不共享，本次实测 25 连发全过）
async function rateLimited(supabase, ip, limit, windowMs) { /* auth_rate_limits 表计数 */ }

Deno.serve(async (req) => {
  // CORS：白名单回显 origin，禁止 '*'
  // OPTIONS 预检直接返回

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { operation, params, authToken } = await req.json()

  // 3) 公开操作白名单：只有 login / register / initAdmin
  //    其余操作必须 authToken → 查 users 表 → status==='approved' 才放行（401 否则）
  // 4) 管理员操作白名单 adminOps：额外校验 role==='admin'（403 否则）
  // 5) 归属校验 rowOwner(table, id) / canAccessProject(id, requireOwner)：
  //    行已存在且当前用户无权访问 → 403（防 upsert 抢数据：传别人的 id 就想覆盖/夺走该行）
  // 6) register 强制 role='user', status='pending'，忽略客户端传入值（防提权）
  // 7) initAdmin 密码只读环境变量 ADMIN_INIT_PASSWORD，没有就报错，禁止代码里写默认密码
  // 8) login 响应剔除 password_hash；getAllUsers 等只 select 安全字段
  // 9) 所有写操作检查 error 并 throw；catch 里只回 'Internal error'，不泄露 SQL 细节
  // 10) deleteUser：禁止删自己、禁止删最后一个管理员
})
```

### 3.3 操作清单模式
前端所有功能映射成 `{operation, params, authToken}` 的 POST：
- 认证类：login / register / initAdmin / changeOwnPassword（服务端验旧密码）
- 管理员类：getPendingUsers / getAllUsers / approveUser / rejectUser / deleteUser / resetUserPassword / changeUsername
- 业务类：get/save/delete × projects/tasks/...，save 用 upsert（先过归属校验），get 按 user_id 过滤

## 4. 阶段四：前端服务层

- `src/services/auth.ts` + `services/supabaseService.ts` 只存 `EDGE_FUNCTION_URL`，**不存任何 key**。
- 会话 = 登录后把 `{id, name, role}` 存 localStorage；每次请求带 `authToken: id`。服务端每个请求都重新查库验证，localStorage 被篡改也只能骗 UI 骗不了服务端。
- 统一封装 `callEdgeFunction(operation, params)`：未登录抛错、`result.error` 抛错。
- 修改自己密码走 `changeOwnPassword`（服务端验旧密码），**不要**复用管理员的 resetUserPassword（本次回归 bug：普通用户 403）。

## 5. 阶段五：部署

### 5.1 主线：GitHub Pages（国内可直连）

线上地址 <https://velamigo.github.io/PMsystem-CC/>（仓库 public，Pages 已启用，source = `gh-pages` 分支）。

1. 发布命令：`npm run deploy`（= `vite build` + `gh-pages -d dist`）。
2. GitHub 构建约 1 分钟，`index.html` 有 CDN 缓存（`max-age=600`），所以更新后最多 10 分钟才全量生效；带 hash 的 assets 不受影响。
3. `vite.config.ts` 的 `base` 必须是 `'./'`，否则子路径下资源 404。
4. 本项目无前端路由（纯状态切换页面），因此不需要 `404.html` 兜底。
5. 页面 origin 是 `https://velamigo.github.io`（不含 `/PMsystem-CC/` 路径），已在 Edge Function 的 `ALLOWED_ORIGINS` 内。
6. 外部依赖铁律：不要引入 `cdn.tailwindcss.com`、`fonts.googleapis.com` 等运行时外链。它们是渲染阻塞请求，国内线路慢或不通时表现为长时间空白页（2026-09 已改为构建期编译 Tailwind + 系统字体栈）。
7. 数据库连接与前端托管位置**无关**：前端不装 `@supabase/supabase-js`、不直连数据库，只 `fetch` Edge Function（`services/supabaseService.ts` 里的 `EDGE_FUNCTION_URL`）；密钥、RLS、service role 全在云端函数内。换托管平台不需要动数据库配置，只需保证新 origin 在 `ALLOWED_ORIGINS` 里。
8. 发布前确认 `.env.local` 里没有 `VITE_EDGE_FUNCTION_URL`。GitHub Pages 走的是**本地构建**（会读 `.env.local`），本地调试时若把它指向 mock（如 `http://localhost:8787`），发布就会把 mock 地址带上线；Cloudflare 那条线在云端构建、读不到 `.env.local`，所以两条线的产物可能不一致。

### 5.2 备用：Cloudflare Worker（国内需代理）

地址 <https://pmsystem-cc.velamigo.workers.dev>，push main 后自动构建，保留作备用线路。

1. `wrangler.toml`：
   ```toml
   name = "项目名"
   compatibility_date = "2026-01-01"
   [assets]
   directory = "./dist"
   not_found_handling = "single-page-application"
   ```
2. Dashboard 新版路径：左侧 **Compute**（即 Workers & Pages）→ Create → **Connect GitHub** → 选仓库（授权时选 only-select 并勾上该仓库，之后转 Private 不受影响）。
3. 构建配置：Build command `npm run build`；Deploy command `npx wrangler deploy`。
4. 部署后去 worker 的 **Settings → Domains & Routes** 启用 `workers.dev` 路由（默认可能 Disabled）。
5. 账号子域名（xxx.workers.dev 中间那段）可在账户设置改一次，改完旧地址失效——**先改域名再配 CORS**。
6. 把最终域名加进 Edge Function 的 `ALLOWED_ORIGINS` 并重新部署 Function。
7. 之后更新流程：本地改 → `git push` → Cloudflare 自动构建（1-2 分钟）。

**为什么它只能当备用（2026-09 实测）**：`*.workers.dev` 在中国大陆被 DNS 整体污染——同一域名 Google DNS 返回真实的 Cloudflare IP `104.21.73.55`，阿里 DNS 返回 `128.121.243.106`、360 DNS 返回 `118.193.240.37`（均为假 IP），国内不开代理打不开。要国内直连必须绑自定义域名（Cloudflare 自定义域名无需备案）。

同类被污染的还有 `*.pages.dev`、`*.vercel.app`、`*.netlify.app`。腾讯 EdgeOne Pages 虽是免费国内平台，但其默认域名按官方文档在中国大陆要么只有 3 小时有效的预览链接、要么直接返回 401，稳定访问需绑**已备案**域名。`*.github.io` 的 DNS 未被污染，属于"能连但看线路"，故作为主线。

后端 `*.supabase.co` 目前 DNS 干净、国内可连通，但 Supabase 官方承认过该域名在多个国家被运营商整体封锁的历史；若出现"页面能开、登录后一直转圈"，说明后端线路被断，需要把请求改为同域转发（前端只请求自有域名，由其代理到 Supabase）。

### 5.3 vite 配置铁律
- `base` 用 `'./'`（相对路径）。用 `'/仓库名/'` 会导致 Cloudflare 根域名下资源 404 白屏；用 `'./'` 两边通吃。
- GitHub Pages 免费 plan 不支持私有仓库；浏览器缓存顽固，验证用无痕模式或比对 assets 指纹（`index-XXXXXXXX.js`）是否与本地 `dist/` 一致。
- 部署地址容易记错：以 `git remote -v` 里的 owner/repo 为准拼 `https://{owner}.github.io/{repo}/`，不要凭印象写域名（本项目是 `velamigo.github.io/PMsystem-CC/`，不是别的账号）。

## 6. 阶段六：多用户 + 审批设计

- `users.status`：`pending`（注册默认）→ `approved`（管理员批准）/ `rejected`。
- 登录时服务端检查 `status === 'approved'`，pending 用户提示"等待审批"。
- 首个管理员由 `initAdmin` 创建：仅当库里没有任何 admin 时生效，密码读环境变量 `ADMIN_INIT_PASSWORD`。**部署后第一件事：登录改密码**（默认/对话里出现过的密码视为已泄露）。
- 用户名唯一（UNIQUE 约束 + 服务端查重提示）。

### 6.1 数据可见性模型（项目级 PERSONAL / TEAM）

多用户系统必须先回答"谁能看到谁的数据"。本项目的模型：

| 项目 `visibility` | 谁能看到 | 谁能改任务/子任务/里程碑 | 谁能改项目本身 |
|---|---|---|---|
| `PERSONAL`（默认） | 只有创建者 | 只有创建者 | 只有创建者 |
| `TEAM` | 所有已批准用户 | 所有已批准用户 | 只有创建者（owner） |

实现要点：
1. **后端是唯一真相**：`getVisibleProjectIds()` 用 `user_id.eq.{me} OR visibility.eq.TEAM` 取可见项目，再用这批 id 过滤 tasks/milestones。前端不做权限判断，只做 UI 提示。
2. **写操作两级校验**：`canAccessProject(id, requireOwner)`——项目级写操作（改名/状态/可见性/删除）传 `requireOwner=true`；任务级写操作传 `false`，让团队成员能协作。`rowOwner(table, id)` 用于按行反查所属项目。
3. **回收站别被可见性过滤掉**：`getProjects` 要保留 `deleted_at IS NOT NULL` 的项目，但只对其 owner 可见（`!p.deleted_at || p.user_id === me`），否则别人能恢复/彻底删除你的项目。
4. **前端不要全量保存**：把整个 `projects[]` 一次性回写会对他人项目触发 403。任务变更走 `updateTask`/`deleteTask` 单条保存；`saveProjects` 内部按 `ownerId` 跳过不可写项目并回报 skipped 数量。
5. **UI 表达**：项目卡片/详情标题旁挂徽章（锁=个人，双人=团队），团队项目额外显示创建者名字（后端 `getProjects` 批量查 `users.name` 拼成 `ownerName`，避免前端 N+1 请求）；非 owner 的项目管理按钮隐藏并提示"只有项目创建者才能执行此操作"。新建项目表单默认选"个人项目"。
6. 改可见性是 owner 专属操作，且**改完要清前端缓存**——否则被移出可见范围的项目还留在本地 state 里。

## 7. 阶段七：安全验收清单（每次大改后跑一遍）

用 curl 或浏览器 Console 逐项验证：

| # | 攻击 | 操作 | 期望 |
|---|------|------|------|
| 1 | 直读数据库 | `GET /rest/v1/users?select=*&apikey=<publishable key>` | `[]` |
| 2 | 后门 authToken | POST `{operation:'getAllUsers', authToken:'system'}` | 401 |
| 3 | 注册提权 | register 带 `role:'admin', status:'approved'` | 返回 role=user, status=pending |
| 4 | 越权改数据 | 用 A 的 token save  B 的项目 id | 403 |
| 5 | 暴力登录 | 连续 25 次错误登录 | 第 21 次起 429 |
| 6 | 密码泄露 | login 响应 / getAllUsers 响应 | 不含 password_hash |
| 7 | 非管理员改他人密码 | resetUserPassword 用普通 token | 403 |
| 8 | 改自己密码 | changeOwnPassword 错旧密码 / 对旧密码 | 400 / 成功 |
| 9 | 删最后一个管理员 / 删自己 | deleteUser | 400 |
| 10 | 跨站调用 | 从非白名单 Origin 请求 | CORS 拒绝 |
| 11 | 前端翻源码 | F12 Sources 搜密码/key | 搜不到 |
| 12 | 读他人个人项目 | 用 B 的 token `getProjects` | 结果里没有 A 的 PERSONAL 项目 |
| 13 | 改他人项目本体 | 用 B 的 token saveProject 改 A 的项目名/状态/visibility | 403 |
| 14 | 改他人团队项目的任务 | 用 B 的 token saveTask（A 的 TEAM 项目） | 成功（协作场景允许） |
| 15 | 翻他人回收站 | A 软删项目后用 B 的 token getProjects | B 看不到该软删项目 |

## 8. 坑位速查表（本次全部踩过）

| 症状 | 根因 | 解法 |
|------|------|------|
| Edge Function 一直 401 | JWT signing key 被轮换，旧 JWT anon key 失效 | Verify JWT 关 OFF + 用内置环境变量；或重新生成 key |
| 401 且 Authorization 头正确 | 同上 / publishable key 不是 JWT | 同上 |
| SQL Editor 报 `syntax error at or near "-"` | SQL 里有 `--` 注释 | 删注释 |
| 拿 publishable key 能读全表 | RLS 有 `USING (true)` policy | 删光 policy，default deny |
| 保存数据静默失败（返回 null） | 表缺列 / 吞错误 | 表结构与代码对齐；写操作 throw error |
| 所有写操作返回 500 Internal error | 云端表结构与代码不一致（列名/NOT NULL 对不上，如 `dependencies` vs `dependency_ids`、`completed` vs `status`） | 查 `information_schema.columns` 对比代码 upsert 的字段名，用 `ALTER TABLE ... RENAME COLUMN / ADD COLUMN IF NOT EXISTS / ALTER COLUMN ... DROP NOT NULL` 对齐（2026-09 实测踩过） |
| 普通用户改密码失败 | 复用了管理员接口 | 独立 changeOwnPassword 操作 |
| 限流不生效 | Edge 多 isolate，内存 Map 不共享 | 限流计数存数据库表 |
| Cloudflare 打开白屏 | vite `base` 是 GH Pages 子路径 | 改 `base: './'` |
| workers.dev 打不开 | 路由默认 Disabled | Settings → Domains & Routes 启用 |
| 国内不开代理打不开线上（workers.dev） | `*.workers.dev` 在中国大陆被 DNS 污染（返回假 IP） | 用 GitHub Pages 主线地址；国内要直连须绑自定义域名 |
| 页面长时间空白、Console 无报错 | 渲染阻塞外链（`cdn.tailwindcss.com` / `fonts.googleapis.com`）加载不到 | 样式改构建期编译，字体用系统栈，不引运行时外链 |
| 部署后网页还是旧的 | 浏览器/CDN 缓存 | 无痕模式或强刷 |
| 成员打开团队项目改任务报 403 | 前端一次性全量回写 `projects[]`，其中含他人 owner 的项目 | 改细粒度保存（`updateTask`/`deleteTask`）；`saveProjects` 内部按 `ownerId` 跳过并提示 skipped |
| 软删项目在回收站消失 | `getProjects` 用可见性过滤把 `deleted_at` 行一并挡掉 | 过滤条件放宽为 `!deleted_at \|\| user_id === me`（只对 owner 保留软删行） |
| `.in('id', [])` 报 500 | 可见项目为空时仍拼空数组条件 | 先判 `ids.length === 0` 直接返回 `[]` |
| 找不到 JWT/Secrets 设置页 | 新版 Dashboard 改版 | JWT 在 Settings→API Keys/JWT Keys；Secrets 在 Edge Functions 设置 |
| 重命名管理员后多出重复账号 | 初始化只查固定用户名 | 改查"是否存在任意 admin" |

## 9. 开工前必问用户的问题

1. 团队规模？（决定是否需要审批流、限流强度）
2. 部署平台：国内访问默认 GitHub Pages（本项目主线，仓库必须公开）；Cloudflare Worker 作备用（支持私有仓库+无限流量，但 `*.workers.dev` 国内被 DNS 污染，需代理或自定义域名）。
3. 是否需要管理员审批注册？
4. 首个管理员账号名/初始密码（提醒部署后立即修改）。
5. 域名偏好（workers.dev 子域名可自定义一次）。

## 10. 交付顺序（避免返工）

1. 建 GitHub 私有仓库并推送干净代码（无密钥）
2. Supabase 建项目 → 跑建表 SQL（含 RLS）→ 确认无残留 policy
3. 写 Edge Function（含全部安全件）→ 部署 → 设 ADMIN_INIT_PASSWORD 环境变量
4. 前端服务层对接 → 本地跑通登录/读写
5. 配 wrangler.toml + vite base → 推送 → Cloudflare 部署 → 启用 workers.dev
6. 新域名加入 CORS 白名单 → 重新部署 Function
7. 跑第 7 节验收清单 → 用户改管理员密码 → 交付
