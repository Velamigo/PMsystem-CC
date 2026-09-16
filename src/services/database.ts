import { supabase, getCurrentUser } from './auth';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  deleted_at: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  tags: string[];
  start_date: string | null;
  due_date: string | null;
  assignee: string;
  requester: string;
  dependencies: string[];
  created_at: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  date: string;
  completed: boolean;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  assignee: string;
  due_date: string | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  related_id: string | null;
  created_at: string;
}

export interface Settings {
  userName: string;
  commonTags: string[];
  commonAssignees: string[];
  commonRequesters: string[];
  enableAutoExcelExport: boolean;
}

function getUserId(): string | null {
  const user = getCurrentUser();
  return user?.id || null;
}

// Projects
export async function getProjects(): Promise<Project[]> {
  const userId = getUserId();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createProject(name: string, description: string): Promise<Project> {
  const userId = getUserId();
  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: userId, name, description })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// Tasks
export async function getTasks(projectId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createTask(projectId: string, task: Omit<Task, 'id' | 'project_id' | 'created_at'>): Promise<Task> {
  const userId = getUserId();
  const { data, error } = await supabase
    .from('tasks')
    .insert({ user_id: userId, project_id: projectId, ...task })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Milestones
export async function getMilestones(projectId: string): Promise<Milestone[]> {
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('date', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createMilestone(projectId: string, milestone: Omit<Milestone, 'id' | 'project_id'>): Promise<Milestone> {
  const userId = getUserId();
  const { data, error } = await supabase
    .from('milestones')
    .insert({ user_id: userId, project_id: projectId, ...milestone })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMilestone(id: string, updates: Partial<Milestone>): Promise<Milestone> {
  const { data, error } = await supabase
    .from('milestones')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMilestone(id: string): Promise<void> {
  const { error } = await supabase
    .from('milestones')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Subtasks
export async function getSubtasks(taskId: string): Promise<Subtask[]> {
  const { data, error } = await supabase
    .from('subtasks')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createSubtask(taskId: string, subtask: Omit<Subtask, 'id' | 'task_id'>): Promise<Subtask> {
  const userId = getUserId();
  const { data, error } = await supabase
    .from('subtasks')
    .insert({ user_id: userId, task_id: taskId, ...subtask })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSubtask(id: string, updates: Partial<Subtask>): Promise<Subtask> {
  const { data, error } = await supabase
    .from('subtasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSubtask(id: string): Promise<void> {
  const { error } = await supabase
    .from('subtasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Notifications
export async function getNotifications(): Promise<Notification[]> {
  const userId = getUserId();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createNotification(notification: Omit<Notification, 'id' | 'created_at'>): Promise<Notification> {
  const userId = getUserId();
  const { data, error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, ...notification })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);

  if (error) throw error;
}

// Settings
export async function getSettings(): Promise<Settings> {
  const userId = getUserId();
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'app_settings')
    .eq('user_id', userId)
    .single();

  if (error) {
    // Return default settings if none found
    return {
      userName: 'User',
      commonTags: ['Bug', 'Feature', 'Design', 'Backend', 'Frontend', 'Urgent'],
      commonAssignees: ['Alice', 'Bob', 'Charlie', 'David'],
      commonRequesters: ['Product Manager', 'CEO', 'Client A', 'Client B'],
      enableAutoExcelExport: false,
    };
  }

  return data.value;
}

export async function updateSettings(settings: Settings): Promise<void> {
  const userId = getUserId();
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'app_settings', user_id: userId, value: settings });

  if (error) throw error;
}
