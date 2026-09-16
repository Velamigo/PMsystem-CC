
import React, { useState, useMemo } from 'react';
import { Project, Task, TaskStatus, TaskPriority, ProjectStatus } from '../types';
import { ArrowLeft, Filter, Search, User, Clock, CheckCircle, Circle, Flag } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

// Reuse theme logic for consistency
const PROJECT_THEMES = [
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', badge: 'bg-blue-100 text-blue-800' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-800' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-800' },
  { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', badge: 'bg-purple-100 text-purple-800' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', badge: 'bg-rose-100 text-rose-800' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-900', badge: 'bg-cyan-100 text-cyan-800' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900', badge: 'bg-indigo-100 text-indigo-800' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', badge: 'bg-orange-100 text-orange-800' },
];

const getProjectTheme = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PROJECT_THEMES.length;
  return PROJECT_THEMES[index];
};

interface GlobalTaskListProps {
    projects: Project[];
    initialFilter: 'ALL' | 'PENDING';
    onBack: () => void;
    onSelectTask: (projectId: string, taskId: string) => void;
    onUpdateTaskStatus: (projectId: string, taskId: string, status: TaskStatus) => void;
}

export const GlobalTaskList: React.FC<GlobalTaskListProps> = ({ 
    projects, 
    initialFilter, 
    onBack, 
    onSelectTask,
    onUpdateTaskStatus
}) => {
    const { t } = useLanguage();
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING'>(initialFilter);
    const [searchQuery, setSearchQuery] = useState('');

    const flattenedTasks = useMemo(() => {
        const allTasks: Array<{ task: Task; project: Project; theme: any }> = [];
        
        projects.forEach(p => {
            if (p.status === ProjectStatus.TRASHED) return;
            const theme = getProjectTheme(p.id);
            p.tasks.forEach(t => {
                allTasks.push({ task: t, project: p, theme });
            });
        });

        return allTasks
            .filter(item => {
                if (statusFilter === 'PENDING') {
                    return item.task.status !== TaskStatus.DONE;
                }
                return true;
            })
            .filter(item => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return item.task.title.toLowerCase().includes(q) || 
                       item.project.name.toLowerCase().includes(q) ||
                       item.task.assignee.toLowerCase().includes(q);
            })
            .sort((a, b) => new Date(a.task.dueDate).getTime() - new Date(b.task.dueDate).getTime());
    }, [projects, statusFilter, searchQuery]);

    const getPriorityColor = (priority: TaskPriority) => {
        switch (priority) {
          case TaskPriority.HIGH: return 'text-red-600 bg-red-50 border-red-100';
          case TaskPriority.MEDIUM: return 'text-amber-600 bg-amber-50 border-amber-100';
          case TaskPriority.LOW: return 'text-blue-600 bg-blue-50 border-blue-100';
          default: return 'text-slate-500';
        }
    };

    return (
        <div className="animate-fade-in pb-20">
             <button 
                onClick={onBack}
                className="flex items-center text-slate-500 hover:text-slate-800 mb-6 transition-colors"
            >
                <ArrowLeft size={18} className="mr-2" /> {t.backToDashboard}
            </button>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        {statusFilter === 'PENDING' ? t.tasksRemaining : t.totalTasks}
                    </h1>
                    <p className="text-slate-500 mt-2">
                        {flattenedTasks.length} tasks found across {projects.filter(p => p.status === ProjectStatus.ACTIVE).length} active projects.
                    </p>
                </div>
                
                <div className="flex gap-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search tasks..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                        />
                    </div>
                    <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                        <button 
                            onClick={() => setStatusFilter('PENDING')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === 'PENDING' ? 'bg-slate-100 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {t.todo} / {t.inProgress}
                        </button>
                        <button 
                            onClick={() => setStatusFilter('ALL')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === 'ALL' ? 'bg-slate-100 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            All Tasks
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {flattenedTasks.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                        <p className="text-slate-400">No tasks found matching your criteria.</p>
                    </div>
                ) : (
                    flattenedTasks.map(({ task, project, theme }) => (
                        <div 
                            key={task.id} 
                            onClick={() => onSelectTask(project.id, task.id)}
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex-1">
                                    {/* Project Badge */}
                                    <div className="mb-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border ${theme.bg} ${theme.border} ${theme.text}`}>
                                            {project.name}
                                        </span>
                                    </div>

                                    <div className="flex items-center mb-1">
                                        <h3 className={`text-lg font-semibold text-slate-800 ${task.status === TaskStatus.DONE ? 'line-through text-slate-400' : ''}`}>
                                            {task.title}
                                        </h3>
                                        
                                        <div className={`ml-3 flex items-center text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border ${getPriorityColor(task.priority || TaskPriority.MEDIUM)}`}>
                                            <Flag size={10} className="mr-1" />
                                            {task.priority}
                                        </div>
                                    </div>
                                    <p className="text-slate-500 text-sm line-clamp-1">{task.description}</p>
                                </div>

                                <div className="flex items-center gap-6 text-sm text-slate-500">
                                    <div className="flex items-center w-32" title="Assignee">
                                        <User size={16} className="mr-1.5 text-slate-400" />
                                        <span className="truncate">{task.assignee || 'Unassigned'}</span>
                                    </div>
                                    <div className="flex items-center w-40" title="Due Date">
                                        <Clock size={16} className="mr-1.5 text-slate-400" />
                                        {new Date(task.dueDate).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center pl-4 border-l border-slate-100" onClick={(e) => e.stopPropagation()}>
                                        <div 
                                            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-green-600 transition-colors"
                                            onClick={() => {
                                                const nextStatus = task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;
                                                onUpdateTaskStatus(project.id, task.id, nextStatus);
                                            }}
                                        >
                                            {task.status === TaskStatus.DONE ? <CheckCircle size={22} className="text-green-500" /> : <Circle size={22} />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
