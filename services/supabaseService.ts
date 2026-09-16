/// <reference types="vite/client" />
import { supabase } from './supabaseClient';
import { Project, Task, TaskStatus, TaskPriority, AppNotification, Milestone, AppSettings, ProjectStatus } from '../types';

// Get current user ID
export const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

// ============ Projects ============

export const getProjects = async (): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects:', error);
    return [];
  }

  const projects: Project[] = await Promise.all(
    (data || []).map(async (p) => {
      const [tasksRes, milestonesRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('project_id', p.id),
        supabase.from('milestones').select('*').eq('project_id', p.id),
      ]);

      const tasks: Task[] = await Promise.all(
        (tasksRes.data || []).map(async (t) => {
          const { data: subtasks } = await supabase
            .from('subtasks')
            .select('*')
            .eq('task_id', t.id);

          return {
            id: t.id,
            projectId: t.project_id,
            title: t.title,
            description: t.description,
            status: t.status as TaskStatus,
            priority: t.priority as TaskPriority,
            tags: t.tags || [],
            startDate: t.start_date || '',
            dueDate: t.due_date || '',
            assignee: t.assignee || '',
            requester: t.requester || '',
            dependencies: t.dependencies || [],
            subtasks: (subtasks || []).map((st: any) => ({
              id: st.id,
              title: st.title,
              completed: st.completed,
              assignee: st.assignee,
              dueDate: st.due_date,
            })),
            createdAt: t.created_at,
          };
        })
      );

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        status: (p.status || ProjectStatus.ACTIVE) as ProjectStatus,
        deletedAt: p.deleted_at,
        milestones: (milestonesRes.data || []).map((m: any) => ({
          id: m.id,
          title: m.title,
          date: m.date,
          completed: m.completed,
        })),
        tasks,
        createdAt: p.created_at,
      };
    })
  );

  return projects;
};

export const saveProjects = async (projects: Project[]): Promise<void> => {
  for (const project of projects) {
    await updateProject(project);
  }
};

export const updateProject = async (updatedProject: Project): Promise<void> => {
  await supabase
    .from('projects')
    .update({
      name: updatedProject.name,
      description: updatedProject.description,
      status: updatedProject.status,
      deleted_at: updatedProject.deletedAt,
    })
    .eq('id', updatedProject.id);
};

export const createProject = async (name: string, description: string): Promise<Project[]> => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, description, status: ProjectStatus.ACTIVE, user_id: userId })
    .select()
    .single();

  if (error) throw error;

  return await getProjects();
};

export const duplicateProject = async (projectId: string, copySuffix: string): Promise<Project[]> => {
  const userId = await getCurrentUserId();
  const projects = await getProjects();
  const source = projects.find(p => p.id === projectId);
  if (!source) return projects;

  const { data: newProject, error } = await supabase
    .from('projects')
    .insert({
      name: `${source.name}${copySuffix}`,
      description: source.description,
      status: ProjectStatus.ACTIVE,
      user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;

  const taskIdMap = new Map<string, string>();
  for (const task of source.tasks) {
    const newTaskId = crypto.randomUUID();
    taskIdMap.set(task.id, newTaskId);

    await supabase.from('tasks').insert({
      id: newTaskId,
      project_id: newProject.id,
      user_id: userId,
      title: task.title,
      description: task.description,
      status: TaskStatus.TODO,
      priority: task.priority,
      tags: task.tags,
      start_date: task.startDate,
      due_date: task.dueDate,
      assignee: task.assignee,
      requester: task.requester,
      dependencies: task.dependencies.map(depId => taskIdMap.get(depId) || depId),
    });

    for (const subtask of task.subtasks) {
      await supabase.from('subtasks').insert({
        id: crypto.randomUUID(),
        task_id: newTaskId,
        user_id: userId,
        title: subtask.title,
        completed: false,
        assignee: subtask.assignee,
        due_date: subtask.dueDate,
      });
    }
  }

  for (const milestone of source.milestones) {
    await supabase.from('milestones').insert({
      id: crypto.randomUUID(),
      project_id: newProject.id,
      user_id: userId,
      title: milestone.title,
      date: milestone.date,
      completed: false,
    });
  }

  return await getProjects();
};

export const hardDeleteProject = async (projectId: string): Promise<Project[]> => {
  await supabase.from('projects').delete().eq('id', projectId);
  return await getProjects();
};

export const deleteProject = async (projectId: string): Promise<Project[]> => {
  await supabase
    .from('projects')
    .update({ status: ProjectStatus.TRASHED, deleted_at: new Date().toISOString() })
    .eq('id', projectId);
  return await getProjects();
};

export const setProjectStatus = async (projectId: string, status: ProjectStatus): Promise<Project[]> => {
  await supabase
    .from('projects')
    .update({ status, deleted_at: null })
    .eq('id', projectId);
  return await getProjects();
};

// ============ Milestones ============

export const addMilestone = async (projectId: string, milestone: Milestone): Promise<Project[]> => {
  const userId = await getCurrentUserId();
  await supabase.from('milestones').insert({
    id: milestone.id,
    project_id: projectId,
    user_id: userId,
    title: milestone.title,
    date: milestone.date,
    completed: milestone.completed,
  });
  return await getProjects();
};

export const updateMilestone = async (projectId: string, milestone: Milestone): Promise<Project[]> => {
  await supabase
    .from('milestones')
    .update({ title: milestone.title, date: milestone.date, completed: milestone.completed })
    .eq('id', milestone.id);
  return await getProjects();
};

export const deleteMilestone = async (projectId: string, milestoneId: string): Promise<Project[]> => {
  await supabase.from('milestones').delete().eq('id', milestoneId);
  return await getProjects();
};

// ============ Notifications ============

export const getNotifications = async (): Promise<AppNotification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return [];

  return (data || []).map((n: any) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    read: n.read,
    createdAt: n.created_at,
    relatedId: n.related_id,
  }));
};

export const saveNotifications = async (notifications: AppNotification[]): Promise<void> => {
  const userId = await getCurrentUserId();
  await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  for (const notif of notifications) {
    await supabase.from('notifications').insert({
      id: notif.id,
      user_id: userId,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      read: notif.read,
      related_id: notif.relatedId,
      created_at: notif.createdAt,
    });
  }
};

export const addNotification = async (notification: AppNotification): Promise<AppNotification[]> => {
  const userId = await getCurrentUserId();
  const current = await getNotifications();
  const exists = current.some(n =>
    n.type === notification.type &&
    n.relatedId === notification.relatedId &&
    n.message === notification.message &&
    new Date(n.createdAt).toDateString() === new Date().toDateString()
  );

  if (!exists) {
    await supabase.from('notifications').insert({
      id: notification.id,
      user_id: userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      read: notification.read,
      related_id: notification.relatedId,
      created_at: notification.createdAt,
    });
    return [notification, ...current];
  }
  return current;
};

export const markNotificationRead = async (id: string): Promise<void> => {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
};

export const checkDeadlines = async (projects: Project[]): Promise<AppNotification[]> => {
  const notifications = await getNotifications();
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  let updatedNotifications = [...notifications];
  let hasChanges = false;

  projects.forEach(p => {
    if (p.status === ProjectStatus.TRASHED) return;

    p.tasks.forEach(t => {
      if (t.status !== TaskStatus.DONE) {
        const dueDate = new Date(t.dueDate);
        if (dueDate <= tomorrow && dueDate >= new Date(now.setHours(0, 0, 0, 0))) {
          const exists = updatedNotifications.some(
            n => n.relatedId === t.id && n.type === 'DEADLINE' && new Date(n.createdAt).toDateString() === new Date().toDateString()
          );
          if (!exists) {
            updatedNotifications.unshift({
              id: crypto.randomUUID(),
              title: '即将截止',
              message: `任务 "${t.title}" 即将到期 (${t.dueDate})。`,
              type: 'DEADLINE',
              read: false,
              createdAt: new Date().toISOString(),
              relatedId: t.id,
            });
            hasChanges = true;
          }
        }
      }
    });
  });

  if (hasChanges) {
    await saveNotifications(updatedNotifications);
  }
  return updatedNotifications;
};

// ============ Settings ============

export const getSettings = async (): Promise<AppSettings> => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'app_settings')
    .single();

  if (error || !data) {
    return {
      userName: 'User',
      commonTags: ['Bug', 'Feature', 'Design', 'Backend', 'Frontend', 'Urgent'],
      commonAssignees: ['Alice', 'Bob', 'Charlie', 'David'],
      commonRequesters: ['Product Manager', 'CEO', 'Client A', 'Client B'],
      enableAutoExcelExport: false,
    };
  }

  return data.value as AppSettings;
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  const userId = await getCurrentUserId();
  await supabase
    .from('settings')
    .upsert({ key: 'app_settings', user_id: userId, value: settings });
};

// ============ Backup / Import / Export ============

export const generateBackupData = async (): Promise<string> => {
  const projects = await getProjects();
  const notifications = await getNotifications();
  const settings = await getSettings();
  return JSON.stringify({ projects, notifications, settings }, null, 2);
};

export const exportData = async (): Promise<void> => {
  const jsonString = await generateBackupData();
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  a.download = `PT_${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const importData = async (file: File): Promise<{ projects: Project[]; settings?: AppSettings } | null> => {
  const userId = await getCurrentUserId();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error('File is empty');

        const json = JSON.parse(text);

        if (!json || typeof json !== 'object') {
          throw new Error('Invalid JSON structure');
        }

        let loadedProjects: Project[] = [];
        let loadedSettings: AppSettings | undefined = undefined;

        if (json.projects && Array.isArray(json.projects)) {
          loadedProjects = json.projects;
          if (json.notifications) {
            await saveNotifications(json.notifications);
          }
          if (json.settings) {
            loadedSettings = json.settings;
            await saveSettings(json.settings);
          }
        } else if (Array.isArray(json)) {
          loadedProjects = json;
        } else {
          throw new Error('Invalid backup format: No projects array found.');
        }

        for (const project of loadedProjects) {
          await supabase
            .from('projects')
            .upsert({
              id: project.id,
              user_id: userId,
              name: project.name,
              description: project.description,
              status: project.status,
              deleted_at: project.deletedAt,
              created_at: project.createdAt,
            });

          for (const task of project.tasks) {
            await supabase
              .from('tasks')
              .upsert({
                id: task.id,
                project_id: task.projectId,
                user_id: userId,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                tags: task.tags,
                start_date: task.startDate,
                due_date: task.dueDate,
                assignee: task.assignee,
                requester: task.requester,
                dependencies: task.dependencies,
                created_at: task.createdAt,
              });

            for (const subtask of task.subtasks) {
              await supabase
                .from('subtasks')
                .upsert({
                  id: subtask.id,
                  task_id: task.id,
                  user_id: userId,
                  title: subtask.title,
                  completed: subtask.completed,
                  assignee: subtask.assignee,
                  due_date: subtask.dueDate,
                });
            }
          }

          for (const milestone of project.milestones) {
            await supabase
              .from('milestones')
              .upsert({
                id: milestone.id,
                project_id: project.id,
                user_id: userId,
                title: milestone.title,
                date: milestone.date,
                completed: milestone.completed,
              });
          }
        }

        resolve({ projects: loadedProjects, settings: loadedSettings });
      } catch (err) {
        console.error('Import failed', err);
        resolve(null);
      }
    };
    reader.readAsText(file);
  });
};
