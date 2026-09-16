// 认证服务 - 通过 Edge Function 调用

const EDGE_FUNCTION_URL = 'https://bqhnrmcrcvsmrxyxdymx.supabase.co/functions/v1/api-proxy';
const ANON_KEY = 'sb_publishable_o3pPNc1c-kEe_RyvC79OEg_6lb0wGmu';

const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${ANON_KEY}`,
};

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
  status: 'approved' | 'pending' | 'rejected';
  created_at: string;
  password_hash?: string;
}

// 生成随机盐
function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 密码加盐哈希
async function hashPasswordWithSalt(password: string, salt?: string): Promise<string> {
  const actualSalt = salt || generateSalt();
  const encoder = new TextEncoder();
  const data = encoder.encode(actualSalt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${actualSalt}:${hash}`;
}

// 验证密码
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt] = parts;
  const newHash = await hashPasswordWithSalt(password, salt);
  return newHash === storedHash;
}

// 确保管理员存在
async function ensureAdminExists() {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'getAllUsers',
      params: {},
      authToken: 'system',
    }),
  });
  const result = await response.json();

  if (result.error || !result.data) return;

  const users = result.data as User[];
  const hasAdmin = users.some(u => u.role === 'admin');

  if (!hasAdmin) {
    const adminHash = await hashPasswordWithSalt('ProTrack2024!');
    await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        operation: 'register',
        params: {
          name: 'superadmin',
          passwordHash: adminHash,
          role: 'admin',
          status: 'approved',
        },
        authToken: 'system',
      }),
    });
    console.log('Admin account created: superadmin / ProTrack2024!');
  }
}

// 登录
export async function login(name: string, password: string): Promise<{ user: User | null; error: string | null }> {
  await ensureAdminExists();

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'login',
      params: { name },
      authToken: 'system',
    }),
  });
  const result = await response.json();

  if (result.error || !result.data) {
    return { user: null, error: '用户名或密码错误' };
  }

  const user = result.data as User;

  // 验证密码
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return { user: null, error: '用户名或密码错误' };
  }

  if (user.status === 'pending') {
    return { user: null, error: '账号待审批，请等待管理员批准' };
  }

  if (user.status === 'rejected') {
    return { user: null, error: '账号已被拒绝' };
  }

  // 不返回密码哈希
  const { password_hash, ...safeUser } = user;
  localStorage.setItem('currentUser', JSON.stringify(safeUser));
  return { user: safeUser, error: null };
}

// 注册
export async function register(name: string, password: string): Promise<{ success: boolean; error: string | null }> {
  await ensureAdminExists();

  const passwordHash = await hashPasswordWithSalt(password);

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'register',
      params: { name, passwordHash },
      authToken: 'system',
    }),
  });
  const result = await response.json();

  if (result.error) {
    return { success: false, error: '用户名已存在' };
  }

  return { success: true, error: null };
}

// 获取待审批用户
export async function getPendingUsers(): Promise<User[]> {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'getPendingUsers',
      params: {},
      authToken: getCurrentUserId(),
    }),
  });
  const result = await response.json();
  if (result.error) return [];
  return result.data || [];
}

// 审批用户
export async function approveUser(userId: string): Promise<boolean> {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'approveUser',
      params: { userId },
      authToken: getCurrentUserId(),
    }),
  });
  const result = await response.json();
  return !result.error;
}

// 拒绝用户
export async function rejectUser(userId: string): Promise<boolean> {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'rejectUser',
      params: { userId },
      authToken: getCurrentUserId(),
    }),
  });
  const result = await response.json();
  return !result.error;
}

// 获取所有用户
export async function getAllUsers(): Promise<User[]> {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'getAllUsers',
      params: {},
      authToken: getCurrentUserId(),
    }),
  });
  const result = await response.json();
  if (result.error) return [];
  return result.data || [];
}

// 重置用户密码
export async function resetUserPassword(userId: string, newPassword: string): Promise<{ success: boolean; error: string | null }> {
  const passwordHash = await hashPasswordWithSalt(newPassword);
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'resetUserPassword',
      params: { userId, passwordHash },
      authToken: getCurrentUserId(),
    }),
  });
  const result = await response.json();
  if (result.error) return { success: false, error: '密码重置失败' };
  return { success: true, error: null };
}

// 修改用户名
export async function changeUsername(userId: string, newName: string): Promise<{ success: boolean; error: string | null }> {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'changeUsername',
      params: { userId, newName },
      authToken: getCurrentUserId(),
    }),
  });
  const result = await response.json();
  if (result.error) return { success: false, error: result.error };
  return { success: true, error: null };
}

// 删除用户
export async function deleteUser(userId: string): Promise<{ success: boolean; error: string | null }> {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'deleteUser',
      params: { userId },
      authToken: getCurrentUserId(),
    }),
  });
  const result = await response.json();
  if (result.error) return { success: false, error: '删除用户失败' };
  return { success: true, error: null };
}

// 修改自己的密码
export async function changeOwnPassword(userId: string, oldPassword: string, newPassword: string): Promise<{ success: boolean; error: string | null }> {
  // 先获取用户信息验证旧密码
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'login',
      params: { name: getCurrentUserName() },
      authToken: 'system',
    }),
  });
  const result = await response.json();

  if (result.error || !result.data) {
    return { success: false, error: '用户不存在' };
  }

  const user = result.data as User;
  const isValid = await verifyPassword(oldPassword, user.password_hash);
  if (!isValid) {
    return { success: false, error: '原密码错误' };
  }

  const newHash = await hashPasswordWithSalt(newPassword);
  const updateResponse = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'resetUserPassword',
      params: { userId, passwordHash: newHash },
      authToken: getCurrentUserId(),
    }),
  });
  const updateResult = await updateResponse.json();
  if (updateResult.error) return { success: false, error: '密码修改失败' };
  return { success: true, error: null };
}

// 获取当前用户
export function getCurrentUser(): User | null {
  const stored = localStorage.getItem('currentUser');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

// 更新当前用户
export function updateCurrentUser(user: User) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

// 退出登录
export function logout() {
  localStorage.removeItem('currentUser');
}

// 工具函数
function getCurrentUserId(): string {
  const user = getCurrentUser();
  if (!user) throw new Error('Not logged in');
  return user.id;
}

function getCurrentUserName(): string {
  const user = getCurrentUser();
  if (!user) throw new Error('Not logged in');
  return user.name;
}
