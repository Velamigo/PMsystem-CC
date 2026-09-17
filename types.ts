
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export enum TaskPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED', // New Status
  SUSPENDED = 'SUSPENDED', // Terminated/On Hold
  TRASHED = 'TRASHED', // Recycle Bin
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  assignee?: string;
  dueDate?: string;
  dueDateModifiedCount?: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  startDate: string; // ISO Date string (New)
  dueDate: string; // ISO Date string
  assignee: string;
  requester?: string; // New: Requester field
  dependencies: string[]; // Array of Task IDs that this task depends on (New)
  subtasks: Subtask[];
  createdAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
  completed: boolean;
}

export type ProjectVisibility = 'PERSONAL' | 'TEAM';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus; // New field
  visibility?: ProjectVisibility; // PERSONAL = creator only, TEAM = every logged-in user
  ownerId?: string; // Creator's user id, returned by the backend
  ownerName?: string; // Creator's display name, so TEAM projects can be attributed
  deletedAt?: string; // For 30-day retention
  milestones: Milestone[];
  tasks: Task[]; 
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'DEADLINE' | 'STATUS_CHANGE' | 'ASSIGNMENT' | 'BACKUP';
  read: boolean;
  createdAt: string;
  relatedId?: string; // Task ID or Project ID
}

export interface AppSettings {
  commonTags: string[];
  commonAssignees: string[];
  commonRequesters: string[];
  backupPath?: string; // New: Store local path string for Electron
  enableAI?: boolean;
  apiKey?: string;
  enableAutoExcelExport?: boolean; // New: Toggle for Excel auto-export
}

// Navigation State Types
export type ViewState = 
  | { type: 'DASHBOARD' }
  | { type: 'CALENDAR' }
  | { type: 'SETTINGS' }
  | { type: 'PROJECT_DETAIL'; projectId: string }
  | { type: 'TASK_DETAIL'; projectId: string; taskId: string }
  | { type: 'GLOBAL_TASK_LIST'; filter: 'ALL' | 'PENDING' }; // New View State

// Electron Bridge Definition
declare global {
  interface Window {
    electron?: {
      selectFolder: () => Promise<string | null>;
      saveFile: (folderPath: string, fileName: string, content: string | Uint8Array) => Promise<boolean>;
    };
    process?: {
      env: {
        [key: string]: string | undefined;
      }
    }
  }
}