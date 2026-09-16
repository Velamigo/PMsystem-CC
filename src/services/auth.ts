import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
  status: 'approved' | 'pending' | 'rejected';
  created_at: string;
}

// Generate a random salt
function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Hash password with salt: returns "salt:hash"
async function hashPasswordWithSalt(password: string, salt?: string): Promise<string> {
  const actualSalt = salt || generateSalt();
  const encoder = new TextEncoder();
  // Combine salt + password for hashing
  const data = encoder.encode(actualSalt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${actualSalt}:${hash}`;
}

// Verify password against stored "salt:hash"
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt] = parts;
  const newHash = await hashPasswordWithSalt(password, salt);
  return newHash === storedHash;
}

async function ensureAdminExists() {
  const { data: admin } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .single();

  if (!admin) {
    const adminHash = await hashPasswordWithSalt('ProTrack2024!');
    await supabase
      .from('users')
      .insert({
        name: 'superadmin',
        password_hash: adminHash,
        role: 'admin',
        status: 'approved',
      });
    console.log('Admin account created: superadmin / ProTrack2024!');
  }
}

export async function login(name: string, password: string): Promise<{ user: User | null; error: string | null }> {
  await ensureAdminExists();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('name', name)
    .single();

  if (error || !data) {
    return { user: null, error: '用户名或密码错误' };
  }

  // Verify password with salt
  const isValid = await verifyPassword(password, data.password_hash);
  if (!isValid) {
    return { user: null, error: '用户名或密码错误' };
  }

  if (data.status === 'pending') {
    return { user: null, error: '账号待审批，请等待管理员批准' };
  }

  if (data.status === 'rejected') {
    return { user: null, error: '账号已被拒绝' };
  }

  const user: User = {
    id: data.id,
    name: data.name,
    role: data.role,
    status: data.status,
    created_at: data.created_at,
  };

  localStorage.setItem('currentUser', JSON.stringify(user));
  return { user, error: null };
}

export async function register(name: string, password: string): Promise<{ success: boolean; error: string | null }> {
  await ensureAdminExists();

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('name', name)
    .single();

  if (existing) {
    return { success: false, error: '用户名已存在' };
  }

  const passwordHash = await hashPasswordWithSalt(password);

  const { error } = await supabase
    .from('users')
    .insert({
      name,
      password_hash: passwordHash,
      role: 'user',
      status: 'pending',
    });

  if (error) {
    return { success: false, error: '注册失败，请重试' };
  }

  return { success: true, error: null };
}

export async function getPendingUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function approveUser(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ status: 'approved' })
    .eq('id', userId);

  return !error;
}

export async function rejectUser(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ status: 'rejected' })
    .eq('id', userId);

  return !error;
}

export async function getAllUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<{ success: boolean; error: string | null }> {
  const passwordHash = await hashPasswordWithSalt(newPassword);
  const { error } = await supabase
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('id', userId);

  if (error) return { success: false, error: '密码重置失败' };
  return { success: true, error: null };
}

export async function changeUsername(userId: string, newName: string): Promise<{ success: boolean; error: string | null }> {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('name', newName)
    .single();

  if (existing) {
    return { success: false, error: '用户名已存在' };
  }

  const { error } = await supabase
    .from('users')
    .update({ name: newName })
    .eq('id', userId);

  if (error) return { success: false, error: '用户名修改失败' };
  return { success: true, error: null };
}

export async function deleteUser(userId: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (error) return { success: false, error: '删除用户失败' };
  return { success: true, error: null };
}

export async function changeOwnPassword(userId: string, oldPassword: string, newPassword: string): Promise<{ success: boolean; error: string | null }> {
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (!user) {
    return { success: false, error: '用户不存在' };
  }

  // Verify old password with salt
  const isValid = await verifyPassword(oldPassword, user.password_hash);
  if (!isValid) {
    return { success: false, error: '原密码错误' };
  }

  const newHash = await hashPasswordWithSalt(newPassword);
  const { error } = await supabase
    .from('users')
    .update({ password_hash: newHash })
    .eq('id', userId);

  if (error) return { success: false, error: '密码修改失败' };
  return { success: true, error: null };
}

export function getCurrentUser(): User | null {
  const stored = localStorage.getItem('currentUser');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function updateCurrentUser(user: User) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem('currentUser');
}
