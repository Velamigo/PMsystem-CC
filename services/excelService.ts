
import * as XLSX from 'xlsx';
import { Project, Task, Milestone, Subtask, ProjectStatus, TaskStatus, TaskPriority, AppSettings } from '../types';
import { getSettings } from './supabaseService';

// Define the "Database Schema" for Excel
interface ProjectRow {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  deletedAt?: string;
}

interface TaskRow {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  startDate: string;
  dueDate: string;
  assignee: string;
  requester: string;
  tags: string; // Comma separated
  dependencies: string; // Comma separated
  createdAt: string;
}

interface SubtaskRow {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  assignee?: string;
  dueDate?: string;
  dueDateModifiedCount?: number;
}

interface MilestoneRow {
  id: string;
  projectId: string;
  title: string;
  date: string;
  completed: boolean;
}

interface SettingRow {
    key: string;
    value: string;
}

const createWorkbook = async (projects: Project[]) => {
  const wb = XLSX.utils.book_new();

  // 1. Prepare Projects Table
  const projectRows: ProjectRow[] = projects.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    createdAt: p.createdAt,
    deletedAt: p.deletedAt
  }));
  const wsProjects = XLSX.utils.json_to_sheet(projectRows);
  XLSX.utils.book_append_sheet(wb, wsProjects, "Projects");

  // 2. Prepare Tasks Table
  const taskRows: TaskRow[] = [];
  const subtaskRows: SubtaskRow[] = [];

  projects.forEach(p => {
    p.tasks.forEach(t => {
      taskRows.push({
        id: t.id,
        projectId: p.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        startDate: t.startDate,
        dueDate: t.dueDate,
        assignee: t.assignee || '',
        requester: t.requester || '',
        tags: t.tags.join(','),
        dependencies: t.dependencies.join(','),
        createdAt: t.createdAt
      });

      t.subtasks.forEach(st => {
        subtaskRows.push({
          id: st.id,
          taskId: t.id,
          title: st.title,
          completed: st.completed,
          assignee: st.assignee,
          dueDate: st.dueDate,
          dueDateModifiedCount: st.dueDateModifiedCount
        });
      });
    });
  });
  
  const wsTasks = XLSX.utils.json_to_sheet(taskRows);
  XLSX.utils.book_append_sheet(wb, wsTasks, "Tasks");

  const wsSubtasks = XLSX.utils.json_to_sheet(subtaskRows);
  XLSX.utils.book_append_sheet(wb, wsSubtasks, "Subtasks");

  // 3. Prepare Milestones Table
  const milestoneRows: MilestoneRow[] = [];
  projects.forEach(p => {
    p.milestones.forEach(m => {
      milestoneRows.push({
        id: m.id,
        projectId: p.id,
        title: m.title,
        date: m.date,
        completed: m.completed
      });
    });
  });

  const wsMilestones = XLSX.utils.json_to_sheet(milestoneRows);
  XLSX.utils.book_append_sheet(wb, wsMilestones, "Milestones");

  // 4. Settings Table
  const currentSettings = await getSettings();
  const settingRows: SettingRow[] = [
      { key: 'commonTags', value: JSON.stringify(currentSettings.commonTags) },
      { key: 'commonAssignees', value: JSON.stringify(currentSettings.commonAssignees) },
      { key: 'commonRequesters', value: JSON.stringify(currentSettings.commonRequesters) },
      { key: 'enableAI', value: JSON.stringify(!!currentSettings.enableAI) },
      { key: 'enableAutoExcelExport', value: JSON.stringify(!!currentSettings.enableAutoExcelExport) }
  ];
  const wsSettings = XLSX.utils.json_to_sheet(settingRows);
  XLSX.utils.book_append_sheet(wb, wsSettings, "Settings");

  return wb;
};

export const generateExcelBuffer = async (projects: Project[]): Promise<Uint8Array> => {
  const wb = await createWorkbook(projects);
  // type: 'array' returns Uint8Array
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as any;
};

export const exportToExcelDB = async (projects: Project[]) => {
  const wb = await createWorkbook(projects);
  
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  // Write File triggers download in browser: PT_YYYY-MM-DD_HH-mm-ss.xlsx
  XLSX.writeFile(wb, `PT_${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}.xlsx`);
};

export const importFromExcelDB = async (file: File): Promise<{projects: Project[], settings?: AppSettings} | null> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });

        // Basic Validation
        if (!wb.SheetNames.includes("Projects") || !wb.SheetNames.includes("Tasks")) {
            console.error("Invalid Excel DB format");
            resolve(null);
            return;
        }

        // Read Sheets
        const projectRows: ProjectRow[] = XLSX.utils.sheet_to_json(wb.Sheets["Projects"]);
        const taskRows: TaskRow[] = XLSX.utils.sheet_to_json(wb.Sheets["Tasks"]);
        const subtaskRows: SubtaskRow[] = wb.SheetNames.includes("Subtasks") 
            ? XLSX.utils.sheet_to_json(wb.Sheets["Subtasks"]) 
            : [];
        const milestoneRows: MilestoneRow[] = wb.SheetNames.includes("Milestones") 
            ? XLSX.utils.sheet_to_json(wb.Sheets["Milestones"]) 
            : [];
        const settingRows: SettingRow[] = wb.SheetNames.includes("Settings")
            ? XLSX.utils.sheet_to_json(wb.Sheets["Settings"])
            : [];

        // Parse Settings
        let loadedSettings: AppSettings | undefined = undefined;
        if (settingRows.length > 0) {
            const defaults = await getSettings();
            const newSettings: any = { ...defaults };
            
            settingRows.forEach(row => {
                if (row.key === 'commonTags' || row.key === 'commonAssignees' || row.key === 'commonRequesters') {
                    try { newSettings[row.key] = JSON.parse(row.value); } catch {}
                } else if (row.key === 'enableAI' || row.key === 'enableAutoExcelExport') {
                     try { newSettings[row.key] = JSON.parse(row.value); } catch {}
                } else {
                    newSettings[row.key] = row.value;
                }
            });
            loadedSettings = newSettings as AppSettings;
        }

        // Reconstruct Object Graph
        const projects: Project[] = projectRows.map(pr => {
          // Find Milestones for this project
          const pMilestones = milestoneRows
            .filter(mr => mr.projectId === pr.id)
            .map(mr => ({
                id: mr.id || (crypto as any).randomUUID(),
                title: mr.title,
                date: mr.date,
                completed: mr.completed
            }));

          // Find Tasks for this project
          const pTasks = taskRows
            .filter(tr => tr.projectId === pr.id)
            .map(tr => {
               // Find Subtasks for this task
               const tSubtasks = subtaskRows
                .filter(sr => sr.taskId === tr.id)
                .map(sr => ({
                    id: sr.id || (crypto as any).randomUUID(),
                    title: sr.title,
                    completed: sr.completed,
                    assignee: sr.assignee,
                    dueDate: sr.dueDate,
                    dueDateModifiedCount: sr.dueDateModifiedCount
                }));

               return {
                   id: tr.id || (crypto as any).randomUUID(),
                   projectId: pr.id,
                   title: tr.title,
                   description: tr.description || '',
                   status: (tr.status as TaskStatus) || TaskStatus.TODO,
                   priority: (tr.priority as TaskPriority) || TaskPriority.MEDIUM,
                   tags: tr.tags ? String(tr.tags).split(',').filter(t => t) : [],
                   startDate: tr.startDate || new Date().toISOString().split('T')[0],
                   dueDate: tr.dueDate || new Date().toISOString().split('T')[0],
                   assignee: tr.assignee || '',
                   requester: tr.requester || '',
                   dependencies: tr.dependencies ? String(tr.dependencies).split(',').filter(d => d) : [],
                   subtasks: tSubtasks,
                   createdAt: tr.createdAt || new Date().toISOString()
               } as Task;
            });

          return {
              id: pr.id || (crypto as any).randomUUID(),
              name: pr.name,
              description: pr.description || '',
              status: (pr.status as ProjectStatus) || ProjectStatus.ACTIVE,
              deletedAt: pr.deletedAt,
              createdAt: pr.createdAt || new Date().toISOString(),
              milestones: pMilestones,
              tasks: pTasks
          } as Project;
        });

        resolve({ projects, settings: loadedSettings });

      } catch (err) {
        console.error("Excel Import Failed", err);
        resolve(null);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};