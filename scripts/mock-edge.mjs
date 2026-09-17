// Local in-memory mock of the api-proxy edge function, for UI self-testing.
// Mirrors the edge contract: snake_case rows in "tables", camelCase assembly on getProjects.
// Run: node scripts/mock-edge.mjs   (listens on :8787)
import http from 'node:http';

const db = {
  projects: new Map(),
  tasks: new Map(),
  subtasks: new Map(),
  milestones: new Map(),
  settings: null,
  notifications: new Map(),
  users: new Map([
    ['user-admin', { id: 'user-admin', name: 'admin', password_hash: 'x', role: 'admin', status: 'approved', created_at: new Date().toISOString() }],
  ]),
};

const assembleProjects = () =>
  [...db.projects.values()].map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    status: p.status,
    deletedAt: p.deleted_at,
    createdAt: p.created_at,
    tasks: [...db.tasks.values()]
      .filter((t) => t.project_id === p.id)
      .map((t) => ({
        id: t.id,
        projectId: t.project_id,
        title: t.title,
        description: t.description ?? '',
        status: t.status,
        priority: t.priority,
        tags: t.tags || [],
        startDate: t.start_date,
        dueDate: t.due_date,
        assignee: t.assignee ?? '',
        requester: t.requester ?? '',
        dependencies: t.dependencies || [],
        createdAt: t.created_at,
        subtasks: [...db.subtasks.values()]
          .filter((st) => st.task_id === t.id)
          .map((st) => ({
            id: st.id,
            title: st.title,
            completed: !!st.completed,
            assignee: st.assignee ?? '',
            dueDate: st.due_date,
          })),
      })),
    milestones: [...db.milestones.values()]
      .filter((m) => m.project_id === p.id)
      .map((m) => ({ id: m.id, title: m.title, date: m.date, completed: !!m.completed })),
  }));

const syncProject = (p) => {
  db.projects.set(p.id, {
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    deleted_at: p.deletedAt ?? null,
    created_at: p.createdAt,
  });
  for (const t of p.tasks || []) {
    db.tasks.set(t.id, {
      id: t.id,
      project_id: p.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      tags: t.tags || [],
      start_date: t.startDate,
      due_date: t.dueDate,
      assignee: t.assignee,
      requester: t.requester,
      dependencies: t.dependencies || [],
      created_at: t.createdAt,
    });
    for (const st of t.subtasks || []) {
      db.subtasks.set(st.id, {
        id: st.id,
        task_id: t.id,
        title: st.title,
        completed: !!st.completed,
        assignee: st.assignee || '',
        due_date: st.dueDate || null,
      });
    }
    for (const [id, row] of [...db.subtasks]) {
      if (row.task_id === t.id && !(t.subtasks || []).some((s) => s.id === id)) db.subtasks.delete(id);
    }
  }
  for (const [id, row] of [...db.tasks]) {
    if (row.project_id === p.id && !(p.tasks || []).some((t) => t.id === id)) db.tasks.delete(id);
  }
  for (const m of p.milestones || []) {
    db.milestones.set(m.id, { id: m.id, project_id: p.id, title: m.title, date: m.date, completed: !!m.completed });
  }
  for (const [id, row] of [...db.milestones]) {
    if (row.project_id === p.id && !(p.milestones || []).some((m) => m.id === id)) db.milestones.delete(id);
  }
};

const publicUser = (u) => ({ id: u.id, name: u.name, role: u.role, status: u.status, created_at: u.created_at });

const handlers = {
  // ---- auth ----
  initAdmin: () => ({ created: false }),
  login: (params) => {
    const u = [...db.users.values()].find((x) => x.name === params.name);
    return u ? publicUser(u) : null;
  },
  register: (params) => {
    const id = `user-${db.users.size + 1}`;
    db.users.set(id, { id, name: params.name, password_hash: 'x', role: 'user', status: 'pending', created_at: new Date().toISOString() });
    return { success: true };
  },
  getAllUsers: () => [...db.users.values()].map(publicUser),
  getPendingUsers: () => [...db.users.values()].filter((u) => u.status === 'pending').map(publicUser),
  approveUser: (params) => {
    const u = db.users.get(params.userId);
    if (u) u.status = 'approved';
    return { success: true };
  },
  rejectUser: (params) => {
    const u = db.users.get(params.userId);
    if (u) u.status = 'rejected';
    return { success: true };
  },
  deleteUser: (params) => {
    db.users.delete(params.userId);
    return { success: true };
  },
  resetUserPassword: () => ({ success: true }),
  changeUsername: () => ({ success: true }),
  changeOwnPassword: () => ({ success: true }),

  // ---- projects ----
  getProjects: () => assembleProjects(),
  saveProject: (params) => {
    syncProject(params.project);
    return db.projects.get(params.project.id);
  },
  deleteProject: (params) => {
    const p = db.projects.get(params.projectId);
    if (p) {
      p.deleted_at = new Date().toISOString();
      p.status = 'TRASHED';
    }
    return { success: true };
  },
  hardDeleteProject: (params) => {
    db.projects.delete(params.projectId);
    for (const [id, t] of [...db.tasks]) if (t.project_id === params.projectId) db.tasks.delete(id);
    for (const [id, m] of [...db.milestones]) if (m.project_id === params.projectId) db.milestones.delete(id);
    return { success: true };
  },

  // ---- tasks ----
  getTasks: () => [...db.tasks.values()],
  saveTask: (params) => {
    const t = params.task;
    db.tasks.set(t.id, {
      id: t.id,
      project_id: t.projectId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      tags: t.tags || [],
      start_date: t.startDate,
      due_date: t.dueDate,
      assignee: t.assignee,
      requester: t.requester,
      dependencies: t.dependencies || [],
      created_at: t.createdAt,
    });
    return db.tasks.get(t.id);
  },
  deleteTask: (params) => {
    db.tasks.delete(params.taskId);
    for (const [id, st] of [...db.subtasks]) if (st.task_id === params.taskId) db.subtasks.delete(id);
    return { success: true };
  },

  // ---- milestones ----
  getMilestones: () => [...db.milestones.values()],
  saveMilestone: (params) => {
    const m = params.milestone;
    db.milestones.set(m.id, { id: m.id, project_id: m.projectId, title: m.title, date: m.date, completed: !!m.completed });
    return db.milestones.get(m.id);
  },
  deleteMilestone: (params) => {
    db.milestones.delete(params.milestoneId);
    return { success: true };
  },

  // ---- subtasks ----
  getSubtasks: () => [...db.subtasks.values()],
  saveSubtask: (params) => {
    const st = params.subtask;
    db.subtasks.set(st.id, { id: st.id, task_id: st.taskId, title: st.title, completed: !!st.completed, assignee: st.assignee || '', due_date: st.dueDate || null });
    return db.subtasks.get(st.id);
  },
  deleteSubtask: (params) => {
    db.subtasks.delete(params.subtaskId);
    return { success: true };
  },

  // ---- notifications ----
  getNotifications: () => [...db.notifications.values()],
  addNotification: (params) => {
    db.notifications.set(params.notification.id, params.notification);
    return params.notification;
  },
  markNotificationRead: (params) => {
    const n = db.notifications.get(params.notificationId);
    if (n) n.read = true;
    return { success: true };
  },

  // ---- settings ----
  getSettings: () =>
    db.settings || {
      commonTags: ['Bug', 'Feature', 'Design', 'Backend', 'Frontend', 'Urgent'],
      commonAssignees: ['Alice', 'Bob', 'Charlie', 'David'],
      commonRequesters: ['Product Manager', 'CEO', 'Client A', 'Client B'],
      enableAutoExcelExport: false,
    },
  saveSettings: (params) => {
    db.settings = params.settings;
    return params.settings;
  },

  // ---- debug (mock only) ----
  __dump: () => ({
    projects: [...db.projects.values()],
    tasks: [...db.tasks.values()],
    subtasks: [...db.subtasks.values()],
    milestones: [...db.milestones.values()],
    notifications: [...db.notifications.values()],
    settings: db.settings,
    users: [...db.users.values()].map(publicUser),
  }),
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const { operation, params = {} } = JSON.parse(body || '{}');
    const handler = handlers[operation];
    res.setHeader('Content-Type', 'application/json');
    if (!handler) {
      console.log(`[mock] UNKNOWN OPERATION: ${operation}`);
      res.end(JSON.stringify({ error: `Unknown operation: ${operation}` }));
      return;
    }
    try {
      const data = handler(params);
      console.log(`[mock] ${operation} ok`);
      res.end(JSON.stringify({ data }));
    } catch (e) {
      console.log(`[mock] ${operation} FAILED: ${e.message}`);
      res.end(JSON.stringify({ error: e.message }));
    }
  });
});

server.listen(8787, () => console.log('mock edge listening on :8787'));
