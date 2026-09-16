/// <reference types="vite/client" />
import { Project, Task, TaskStatus, TaskPriority, AppNotification, Milestone, AppSettings, ProjectStatus } from '../types';

const EDGE_FUNCTION_URL = 'https://bqhnrmcrcvsmrxyxdymx.supabase.co/functions/v1/api-proxy';

// 获取当前用户 ID
export const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user?.id || null;
    }
  } catch (e) {
    console.error('Failed to get current user from localStorage:', e);
  }
  return null;
};

// 调用 Edge Function
async function callEdgeFunction(operation: string, params: any = {}): Promise<any> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not logged in');

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operation,
      params,
      authToken: userId,
    }),
  });

  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return result.data;
}

// ============ Projects ============

export const getProjects = async (): Promise<Project[]> => {
  try {
    const projects = await callEdgeFunction('getProjects');
    return projects || [];
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
};

export const saveProjects = async (projects: Project[]): Promise<void> => {
  for (const project of projects) {
    await callEdgeFunction('saveProject', { project });
  }
};

export const updateProject = async (updatedProject: Project): Promise<void> => {
  await callEdgeFunction('saveProject', { project: updatedProject });
};

export const createProject = async (name: string, description: string): Promise<Project[]> => {
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    description,
    status: ProjectStatus.ACTIVE,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    tasks: [],
    milestones: [],
  };
  await callEdgeFunction('saveProject', { project });
  return getProjects();
};

export const duplicateProject = async (projectId: string, copySuffix: string): Promise<Project[]> => {
  const projects = await getProjects();
  const original = projects.find(p => p.id === projectId);
  if (!original) return projects;

  const newProject: Project = {
    ...original,
    id: crypto.randomUUID(),
    name: `${original.name} ${copySuffix}`,
    createdAt: new Date().toISOString(),
    tasks: original.tasks?.map(t => ({ ...t, id: crypto.randomUUID(), projectId: crypto.randomUUID() })) || [],
    milestones: original.milestones?.map(m => ({ ...m, id: crypto.randomUUID(), projectId: crypto.randomUUID() })) || [],
  };
  await callEdgeFunction('saveProject', { project: newProject });
  return getProjects();
};

export const deleteProject = async (projectId: string): Promise<Project[]> => {
  await callEdgeFunction('deleteProject', { projectId });
  return getProjects();
};

export const hardDeleteProject = async (projectId: string): Promise<Project[]> => {
  await callEdgeFunction('hardDeleteProject', { projectId });
  return getProjects();
};

export const setProjectStatus = async (projectId: string, status: ProjectStatus): Promise<Project[]> => {
  const projects = await getProjects();
  const project = projects.find(p => p.id === projectId);
  if (project) {
    project.status = status;
    await callEdgeFunction('saveProject', { project });
  }
  return getProjects();
};

// ============ Tasks ============

export const getTasks = async (): Promise<Task[]> => {
  try {
    const tasks = await callEdgeFunction('getTasks');
    return tasks || [];
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
};

export const saveTasks = async (tasks: Task[]): Promise<void> => {
  for (const task of tasks) {
    await callEdgeFunction('saveTask', { task });
  }
};

export const updateTask = async (updatedTask: Task): Promise<void> => {
  await callEdgeFunction('saveTask', { task: updatedTask });
};

export const createTask = async (task: Task): Promise<Task> => {
  return callEdgeFunction('saveTask', { task });
};

export const deleteTask = async (taskId: string): Promise<void> => {
  await callEdgeFunction('deleteTask', { taskId });
};

// ============ Milestones ============

export const getMilestones = async (): Promise<Milestone[]> => {
  try {
    const milestones = await callEdgeFunction('getMilestones');
    return milestones || [];
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return [];
  }
};

export const saveMilestone = async (milestone: Milestone): Promise<Milestone> => {
  return callEdgeFunction('saveMilestone', { milestone });
};

export const updateMilestone = async (projectId: string, milestone: Milestone): Promise<Project[]> => {
  await callEdgeFunction('saveMilestone', { milestone });
  return getProjects();
};

export const deleteMilestone = async (milestoneId: string): Promise<void> => {
  await callEdgeFunction('deleteMilestone', { milestoneId });
};

export const addMilestone = async (projectId: string, milestone: Milestone): Promise<Project[]> => {
  await callEdgeFunction('saveMilestone', { milestone });
  return getProjects();
};

// ============ Subtasks ============

export const getSubtasks = async (): Promise<any[]> => {
  try {
    const subtasks = await callEdgeFunction('getSubtasks');
    return subtasks || [];
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    return [];
  }
};

export const saveSubtask = async (subtask: any): Promise<any> => {
  return callEdgeFunction('saveSubtask', { subtask });
};

export const deleteSubtask = async (subtaskId: string): Promise<void> => {
  await callEdgeFunction('deleteSubtask', { subtaskId });
};

// ============ Notifications ============

export const getNotifications = async (): Promise<AppNotification[]> => {
  try {
    const notifications = await callEdgeFunction('getNotifications');
    return notifications || [];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

export const addNotification = async (notification: AppNotification): Promise<AppNotification[]> => {
  await callEdgeFunction('addNotification', { notification });
  return getNotifications();
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
  await callEdgeFunction('markNotificationRead', { notificationId });
};

export const saveNotifications = async (notifications: AppNotification[]): Promise<void> => {
  for (const notification of notifications) {
    await callEdgeFunction('addNotification', { notification });
  }
};

// ============ Settings ============

export const getSettings = async (): Promise<AppSettings> => {
  try {
    const settings = await callEdgeFunction('getSettings');
    return settings || {
      commonTags: ['Bug', 'Feature', 'Design', 'Backend', 'Frontend', 'Urgent'],
      commonAssignees: ['Alice', 'Bob', 'Charlie', 'David'],
      commonRequesters: ['Product Manager', 'CEO', 'Client A', 'Client B'],
      enableAutoExcelExport: false,
    };
  } catch (error) {
    console.error('Error fetching settings:', error);
    return {
      commonTags: ['Bug', 'Feature', 'Design', 'Backend', 'Frontend', 'Urgent'],
      commonAssignees: ['Alice', 'Bob', 'Charlie', 'David'],
      commonRequesters: ['Product Manager', 'CEO', 'Client A', 'Client B'],
      enableAutoExcelExport: false,
    };
  }
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  await callEdgeFunction('saveSettings', { settings });
};

// ============ Import/Export ============

export const exportData = async (): Promise<any> => {
  const [projects, notifications, settings] = await Promise.all([
    getProjects(),
    getNotifications(),
    getSettings(),
  ]);

  return {
    projects,
    notifications,
    settings,
    exportDate: new Date().toISOString(),
  };
};

export const importData = async (file: File): Promise<{ projects: Project[]; settings?: AppSettings } | null> => {
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
          await callEdgeFunction('saveProject', { project });

          if (project.tasks) {
            for (const task of project.tasks) {
              await callEdgeFunction('saveTask', { task });

              if (task.subtasks) {
                for (const subtask of task.subtasks) {
                  await callEdgeFunction('saveSubtask', {
                    subtask: {
                      ...subtask,
                      taskId: task.id,
                    },
                  });
                }
              }
            }
          }

          if (project.milestones) {
            for (const milestone of project.milestones) {
              await callEdgeFunction('saveMilestone', { milestone });
            }
          }
        }

        resolve({ projects: loadedProjects, settings: loadedSettings });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// ============ Backup ============

export const generateBackupData = async (): Promise<any> => {
  return exportData();
};

export const checkDeadlines = async (tasks: Task[]): Promise<AppNotification[]> => {
  const notifications: AppNotification[] = [];
  const now = new Date();

  for (const task of tasks) {
    if (task.dueDate && task.status !== TaskStatus.DONE) {
      const dueDate = new Date(task.dueDate);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilDue <= 3 && daysUntilDue >= 0) {
        notifications.push({
          id: crypto.randomUUID(),
          type: 'DEADLINE',
          title: '任务即将到期',
          message: `任务 "${task.title}" 将在 ${daysUntilDue} 天后到期`,
          read: false,
          relatedId: task.id,
          createdAt: new Date().toISOString(),
        });
      } else if (daysUntilDue < 0) {
        notifications.push({
          id: crypto.randomUUID(),
          type: 'DEADLINE',
          title: '任务已逾期',
          message: `任务 "${task.title}" 已逾期 ${Math.abs(daysUntilDue)} 天`,
          read: false,
          relatedId: task.id,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return notifications;
};
