
import { Project, TaskStatus, TaskPriority, AppNotification, Milestone, AppSettings, ProjectStatus, Task } from '../types';

const STORAGE_KEY = 'protrack_data_v4_zh'; 
const NOTIFICATION_KEY = 'protrack_notifications_v4_zh';
const SETTINGS_KEY = 'protrack_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
    userName: 'John Doe',
    commonTags: ['Bug', 'Feature', 'Design', 'Backend', 'Frontend', 'Urgent'],
    commonAssignees: ['Alice', 'Bob', 'Charlie', 'David'],
    commonRequesters: ['Product Manager', 'CEO', 'Client A', 'Client B'],
    enableAutoExcelExport: false,
};

const TODAY = new Date();
const formatDate = (date: Date) => date.toISOString().split('T')[0];

const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: '企业网站重构',
    description: '使用全新的品牌形象和 React 前端技术重构企业官网。',
    status: ProjectStatus.ACTIVE,
    createdAt: new Date().toISOString(),
    milestones: [
      { id: 'm1', title: '设计阶段', date: '2023-10-30', completed: true },
      { id: 'm2', title: '前端开发', date: formatDate(new Date(TODAY.getTime() - 86400000 * 5)), completed: false },
      { id: 'm3', title: '测试与上线', date: formatDate(new Date(TODAY.getTime() + 86400000 * 10)), completed: false },
      { id: 'm4', title: '项目结束', date: formatDate(new Date(TODAY.getTime() + 86400000 * 30)), completed: false },
    ],
    tasks: [
      {
        id: 't1',
        projectId: 'p1',
        title: '确认 Figma 设计稿',
        description: '与利益相关者共同评审高保真设计图。',
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        tags: ['设计', 'UX'],
        startDate: '2023-10-01',
        dueDate: '2023-10-05',
        assignee: '李设计',
        requester: '产品总监',
        subtasks: [],
        dependencies: [],
        createdAt: '2023-10-01',
      },
      {
        id: 't2',
        projectId: 'p1',
        title: '搭建 React 仓库',
        description: '初始化 Vite, Tailwind 和 TypeScript 配置。',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        tags: ['开发', '基建'],
        startDate: formatDate(new Date(TODAY.getTime() - 86400000 * 2)),
        dueDate: formatDate(new Date(TODAY.getTime() + 86400000 * 3)),
        assignee: '王开发',
        requester: '技术经理',
        subtasks: [
          { id: 'st1', title: '安装依赖包', completed: true },
          { id: 'st2', title: '配置 ESLint 规则', completed: false },
        ],
        dependencies: ['t1'],
        createdAt: '2023-10-01',
      }
    ]
  }
];

export const getProjects = (): Project[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_PROJECTS));
    return MOCK_PROJECTS;
  }
  const projects = JSON.parse(data) as Project[];
  return projects.map(p => ({
      ...p,
      status: p.status || ProjectStatus.ACTIVE,
      milestones: p.milestones || [],
      tasks: p.tasks || []
  }));
};

export const saveProjects = (projects: Project[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

export const updateProject = (updatedProject: Project) => {
  const projects = getProjects();
  const index = projects.findIndex(p => p.id === updatedProject.id);
  if (index !== -1) {
    projects[index] = { ...projects[index], ...updatedProject };
    saveProjects(projects);
  }
};

export const createProject = (name: string, description: string): Project[] => {
    const projects = getProjects();
    const newProject: Project = {
        id: (crypto as any).randomUUID(),
        name,
        description,
        status: ProjectStatus.ACTIVE,
        createdAt: new Date().toISOString(),
        milestones: [],
        tasks: []
    };
    const updated = [newProject, ...projects];
    saveProjects(updated);
    return updated;
};

export const duplicateProject = (projectId: string, copySuffix: string): Project[] => {
    const projects = getProjects();
    const source = projects.find(p => p.id === projectId);
    if (!source) return projects;

    const newProjectId = (crypto as any).randomUUID();
    
    // Remap task IDs to keep internal dependencies intact in the copy
    const taskIdMap = new Map<string, string>();
    source.tasks.forEach(t => {
        taskIdMap.set(t.id, (crypto as any).randomUUID());
    });

    const newTasks: Task[] = source.tasks.map(t => ({
        ...t,
        id: taskIdMap.get(t.id)!,
        projectId: newProjectId,
        status: TaskStatus.TODO, // Reset status for the copy
        dependencies: t.dependencies.map(depId => taskIdMap.get(depId) || depId),
        subtasks: t.subtasks.map(st => ({
            ...st,
            id: (crypto as any).randomUUID(),
            completed: false
        })),
        createdAt: new Date().toISOString()
    }));

    const newMilestones: Milestone[] = source.milestones.map(m => ({
        ...m,
        id: (crypto as any).randomUUID(),
        completed: false
    }));

    const newProject: Project = {
        ...source,
        id: newProjectId,
        name: `${source.name}${copySuffix}`,
        status: ProjectStatus.ACTIVE,
        createdAt: new Date().toISOString(),
        milestones: newMilestones,
        tasks: newTasks
    };

    const updated = [newProject, ...projects];
    saveProjects(updated);
    return updated;
};

export const hardDeleteProject = (projectId: string): Project[] => {
    const projects = getProjects();
    const updated = projects.filter(p => p.id !== projectId);
    saveProjects(updated);
    return updated;
};

export const deleteProject = (projectId: string): Project[] => {
    const projects = getProjects();
    const updated = projects.map(p => {
        if (p.id === projectId) {
            return { ...p, status: ProjectStatus.TRASHED, deletedAt: new Date().toISOString() };
        }
        return p;
    });
    saveProjects(updated);
    return updated;
};

export const setProjectStatus = (projectId: string, status: ProjectStatus): Project[] => {
    const projects = getProjects();
    const updated = projects.map(p => {
        if (p.id === projectId) {
            return { ...p, status: status, deletedAt: undefined };
        }
        return p;
    });
    saveProjects(updated);
    return updated;
};

export const addMilestone = (projectId: string, milestone: Milestone): Project[] => {
    const projects = getProjects();
    const updated = projects.map(p => {
        if (p.id === projectId) {
            return { ...p, milestones: [...(p.milestones || []), milestone] };
        }
        return p;
    });
    saveProjects(updated);
    return updated;
};

export const updateMilestone = (projectId: string, milestone: Milestone): Project[] => {
    const projects = getProjects();
    const updated = projects.map(p => {
        if (p.id === projectId) {
            return {
                ...p,
                milestones: (p.milestones || []).map(m => m.id === milestone.id ? milestone : m)
            };
        }
        return p;
    });
    saveProjects(updated);
    return updated;
};

export const deleteMilestone = (projectId: string, milestoneId: string): Project[] => {
    const projects = getProjects();
    const updated = projects.map(p => {
        if (p.id === projectId) {
            return { ...p, milestones: (p.milestones || []).filter(m => m.id !== milestoneId) };
        }
        return p;
    });
    saveProjects(updated);
    return updated;
};

export const generateBackupData = (): string => {
    return JSON.stringify({
        projects: getProjects(),
        notifications: getNotifications(),
        settings: getSettings()
    }, null, 2);
};

export const exportData = () => {
    const jsonString = generateBackupData();
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

export const importData = (file: File): Promise<{projects: Project[], settings?: AppSettings} | null> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                if (!text) throw new Error("File is empty");

                const json = JSON.parse(text);
                
                if (!json || typeof json !== 'object') {
                    throw new Error("Invalid JSON structure");
                }

                let loadedProjects: Project[] = [];
                let loadedSettings: AppSettings | undefined = undefined;

                if (json.projects && Array.isArray(json.projects)) {
                    loadedProjects = json.projects;
                    if (json.notifications) {
                        localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(json.notifications));
                    }
                    if (json.settings) {
                        loadedSettings = json.settings;
                        localStorage.setItem(SETTINGS_KEY, JSON.stringify(json.settings));
                    }
                } 
                else if (Array.isArray(json)) {
                    loadedProjects = json;
                } else {
                    throw new Error("Invalid backup format: No projects array found.");
                }

                localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedProjects));
                resolve({ projects: loadedProjects, settings: loadedSettings });
            } catch (err) {
                console.error("Import failed", err);
                resolve(null);
            }
        };
        reader.readAsText(file);
    });
};

export const getNotifications = (): AppNotification[] => {
  const data = localStorage.getItem(NOTIFICATION_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveNotifications = (notifications: AppNotification[]) => {
  localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
};

export const addNotification = (notification: AppNotification) => {
  const current = getNotifications();
  const exists = current.some(n => 
    n.type === notification.type && 
    n.relatedId === notification.relatedId && 
    n.message === notification.message &&
    new Date(n.createdAt).toDateString() === new Date().toDateString()
  );
  
  if (!exists) {
    const updated = [notification, ...current];
    saveNotifications(updated);
    return updated;
  }
  return current;
};

export const markNotificationRead = (id: string) => {
  const notifications = getNotifications();
  const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
  saveNotifications(updated);
  return updated;
};

export const checkDeadlines = (projects: Project[]): AppNotification[] => {
    const notifications = getNotifications();
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    let updatedNotifications = [...notifications];
    let hasChanges = false;

    projects.forEach(p => {
        if (p.status === ProjectStatus.TRASHED) return;

        p.tasks.forEach(t => {
            if (t.status !== TaskStatus.DONE) {
                const dueDate = new Date(t.dueDate);
                if (dueDate <= tomorrow && dueDate >= new Date(now.setHours(0,0,0,0))) {
                    const exists = updatedNotifications.some(n => n.relatedId === t.id && n.type === 'DEADLINE' && new Date(n.createdAt).toDateString() === new Date().toDateString());
                    if (!exists) {
                        updatedNotifications.unshift({
                            id: (crypto as any).randomUUID(),
                            title: '即将截止',
                            message: `任务 "${t.title}" 即将到期 (${t.dueDate})。`,
                            type: 'DEADLINE',
                            read: false,
                            createdAt: new Date().toISOString(),
                            relatedId: t.id
                        });
                        hasChanges = true;
                    }
                }
            }
        });
    });

    if (hasChanges) {
        saveNotifications(updatedNotifications);
    }
    return updatedNotifications;
};

export const getSettings = (): AppSettings => {
    const data = localStorage.getItem(SETTINGS_KEY);
    const parsed = data ? JSON.parse(data) : {};
    return { ...DEFAULT_SETTINGS, ...parsed };
};

export const saveSettings = (settings: AppSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};
