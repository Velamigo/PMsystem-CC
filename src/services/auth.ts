// 认证服务 - 通过 Edge Function 调用

const EDGE_FUNCTION_URL = 'https://bqhnrmcrcvsmrxyxdymx.supabase.co/functions/v1/api-proxy';

const AUTH_HEADERS = {
  'Content-Type': 'application/json',
};

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
  status: 'approved' | 'pending' | 'rejected';
  created_at: string;
}

// 初始化管理员（仅在无管理员时创建）
async function ensureAdminExists() {
  await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'initAdmin',
      params: {},
    }),
  });
}

// 登录
export async function login(name: string, password: string): Promise<{ user: User | null; error: string | null }> {
  await ensureAdminExists();

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'login',
      params: { name, password },
    }),
  });
  const result = await response.json();

  if (result.error || !result.data) {
    return { user: null, error: '用户名或密码错误' };
  }

  const user = result.data as User;

  if (user.status === 'pending') {
    return { user: null, error: '账号待审批，请等待管理员批准' };
  }

  if (user.status === 'rejected') {
    return { user: null, error: '账号已被拒绝' };
  }

  localStorage.setItem('currentUser', JSON.stringify(user));
  return { user, error: null };
}

// 注册
export async function register(name: string, password: string): Promise<{ success: boolean; error: string | null }> {
  await ensureAdminExists();

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'register',
      params: { name, password },
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
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'resetUserPassword',
      params: { userId, password: newPassword },
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
  if (result.error) return { success: false, error: result.error };
  return { success: true, error: null };
}

// 修改自己的密码（管理员需要知道旧密码）
export async function changeOwnPassword(userId: string, oldPassword: string, newPassword: string): Promise<{ success: boolean; error: string | null }> {
  // 通过 login 验证旧密码
  const user = getCurrentUser();
  if (!user) return { success: false, error: '未登录' };

  const loginResponse = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'login',
      params: { name: user.name, password: oldPassword },
    }),
  });
  const loginResult = await loginResponse.json();

  if (loginResult.error || !loginResult.data) {
    return { success: false, error: '原密码错误' };
  }

  // 调用 resetUserPassword 设置新密码
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      operation: 'resetUserPassword',
      params: { userId, password: newPassword },
      authToken: getCurrentUserId(),
    }),
  });
  const result = await response.json();
  if (result.error) return { success: false, error: '密码修改失败' };
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
