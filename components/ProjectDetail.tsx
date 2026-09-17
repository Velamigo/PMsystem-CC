
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Project, Task, Milestone, TaskStatus, TaskPriority, ProjectVisibility } from '../types';
import { Calendar, CheckCircle, Circle, Plus, ArrowLeft, User, Clock, Filter, SlidersHorizontal, Flag, List, BarChart2, Trash2, X, Pencil, CornerDownRight, ChevronDown, ChevronUp, Check, Lock, Users } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { GanttChart } from './GanttChart';
import { DatePicker } from './DatePicker';

interface ProjectDetailProps {
  project: Project;
  currentUserId?: string;
  onBack: () => void;
  onSelectTask: (taskId: string) => void;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
  onAddTask: () => void;
  onUpdateProject: (project: Project) => void;
  onAddMilestone: (milestone: Milestone) => void;
  onUpdateMilestone: (milestone: Milestone) => void;
  onDeleteMilestone: (milestoneId: string) => void;
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({ 
  project, 
  currentUserId,
  onBack, 
  onSelectTask, 
  onUpdateTaskStatus,
  onAddTask,
  onUpdateProject,
  onAddMilestone,
  onUpdateMilestone,
  onDeleteMilestone
}) => {
  const { t } = useLanguage();
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'DATE' | 'PRIORITY'>('DATE');
  const [viewMode, setViewMode] = useState<'LIST' | 'GANTT'>('LIST');

  // Inline Project Editing
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [tempName, setTempName] = useState(project.name);
  const [tempDesc, setTempDesc] = useState(project.description);
  const [tempVisibility, setTempVisibility] = useState<ProjectVisibility>(project.visibility || 'PERSONAL');
  const descTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Only the creator may change project-level settings, including visibility.
  const isOwner = !project.ownerId || project.ownerId === currentUserId;

  // Milestone Section State (Default Collapsed)
  const [isMilestonesExpanded, setIsMilestonesExpanded] = useState(false);

  // Milestone Modal State
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');

  // Sync temp state if project prop changes externally
  useEffect(() => {
      setTempName(project.name);
      setTempDesc(project.description);
      setTempVisibility(project.visibility || 'PERSONAL');
  }, [project.name, project.description, project.visibility]);

  // Auto-resize description textarea
  useEffect(() => {
      if (isEditingHeader && descTextareaRef.current) {
          descTextareaRef.current.style.height = 'auto';
          descTextareaRef.current.style.height = descTextareaRef.current.scrollHeight + 'px';
      }
  }, [isEditingHeader, tempDesc]);

  const handleSaveProjectHeader = () => {
      if (tempName.trim()) {
          onUpdateProject({
              ...project,
              name: tempName,
              description: tempDesc,
              visibility: tempVisibility
          });
          setIsEditingHeader(false);
      }
  };

  const handleCancelProjectHeader = () => {
      setTempName(project.name);
      setTempDesc(project.description);
      setTempVisibility(project.visibility || 'PERSONAL');
      setIsEditingHeader(false);
  };

  // Sort milestones by date
  const sortedMilestones = [...project.milestones].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Determine current milestone (first uncompleted one)
  const currentMilestoneIndex = sortedMilestones.findIndex(m => !m.completed);
  const nextMilestone = currentMilestoneIndex !== -1 ? sortedMilestones[currentMilestoneIndex] : null;

  const handleOpenAddMilestone = () => {
      setEditingMilestoneId(null);
      setNewMilestoneTitle('');
      setNewMilestoneDate('');
      setShowMilestoneModal(true);
  };

  const handleOpenEditMilestone = (m: Milestone, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingMilestoneId(m.id);
      setNewMilestoneTitle(m.title);
      setNewMilestoneDate(m.date);
      setShowMilestoneModal(true);
  };

  const handleSaveMilestone = (e: React.FormEvent) => {
      e.preventDefault();
      if(newMilestoneTitle && newMilestoneDate) {
          if (editingMilestoneId) {
             const existing = project.milestones.find(m => m.id === editingMilestoneId);
             onUpdateMilestone({
                 id: editingMilestoneId,
                 title: newMilestoneTitle,
                 date: newMilestoneDate,
                 completed: existing ? existing.completed : false
             });
          } else {
             onAddMilestone({
                id: (crypto as any).randomUUID(),
                title: newMilestoneTitle,
                date: newMilestoneDate,
                completed: false
             });
          }
          
          setNewMilestoneTitle('');
          setNewMilestoneDate('');
          setShowMilestoneModal(false);
      }
  };

  const getTaskStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DONE: return 'bg-green-100 text-green-700 border-green-200';
      case TaskStatus.IN_PROGRESS: return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTaskStatusText = (status: TaskStatus) => {
      switch(status) {
          case TaskStatus.DONE: return t.done;
          case TaskStatus.IN_PROGRESS: return t.inProgress;
          default: return t.todo;
      }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH: return 'text-red-600 bg-red-50 border-red-100';
      case TaskPriority.MEDIUM: return 'text-amber-600 bg-amber-50 border-amber-100';
      case TaskPriority.LOW: return 'text-blue-600 bg-blue-50 border-blue-100';
      default: return 'text-slate-500';
    }
  };

  const getPriorityText = (priority: TaskPriority) => {
      switch(priority) {
          case TaskPriority.HIGH: return t.high;
          case TaskPriority.MEDIUM: return t.medium;
          case TaskPriority.LOW: return t.low;
          default: return t.medium;
      }
  };

  const getPriorityIconColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH: return 'fill-red-500 text-red-600';
      case TaskPriority.MEDIUM: return 'fill-amber-500 text-amber-600';
      case TaskPriority.LOW: return 'text-blue-600';
      default: return 'text-slate-400';
    }
  };

  // --- Hierarchical Task Logic ---
  
  // 1. Organize tasks into tree structure
  const organizedTasks = useMemo(() => {
    // Filter first
    const filtered = project.tasks
        .filter(t => (filterPriority === 'ALL' || t.priority === filterPriority))
        .filter(t => (filterStatus === 'ALL' || t.status === filterStatus))
        .filter(t => (filterTag === '' || t.tags.includes(filterTag)));

    // Create a map for quick lookup
    const taskMap = new Map<string, Task>();
    filtered.forEach(t => taskMap.set(t.id, t));

    // Identify roots: tasks whose dependencies are NOT in the current filtered list
    // This handles "orphan" branches correctly in filtered views
    const roots: Task[] = [];
    const childrenMap = new Map<string, Task[]>();

    filtered.forEach(t => {
        const hasParentInList = t.dependencies.some(depId => taskMap.has(depId));
        if (!hasParentInList) {
            roots.push(t);
        } else {
            // Add to the first parent found in the list (simplified tree logic)
            // A more complex graph view would be needed for multi-parent, but strict tree is best for list UI
            const parentId = t.dependencies.find(depId => taskMap.has(depId));
            if (parentId) {
                if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
                childrenMap.get(parentId)?.push(t);
            }
        }
    });

    // Helper to flatten the tree into a render list with depth info
    interface RenderItem {
        task: Task;
        depth: number;
        isLastChild: boolean;
        hasChildren: boolean;
    }
    
    const flattenTree = (nodes: Task[], depth: number): RenderItem[] => {
        // Sort nodes at this level
        const sortedNodes = nodes.sort((a, b) => {
            if (sortBy === 'DATE') {
                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            } else {
                const pMap = { [TaskPriority.HIGH]: 3, [TaskPriority.MEDIUM]: 2, [TaskPriority.LOW]: 1 };
                return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
            }
        });

        let result: RenderItem[] = [];
        sortedNodes.forEach((node, index) => {
            const children = childrenMap.get(node.id) || [];
            result.push({
                task: node,
                depth,
                isLastChild: index === sortedNodes.length - 1,
                hasChildren: children.length > 0
            });
            if (children.length > 0) {
                result = [...result, ...flattenTree(children, depth + 1)];
            }
        });
        return result;
    };

    return flattenTree(roots, 0);

  }, [project.tasks, filterPriority, filterStatus, filterTag, sortBy]);
    
  // Get all unique tags from tasks
  const allTags = Array.from(new Set(project.tasks.flatMap(t => t.tags)));

  return (
    <div className="animate-fade-in pb-20 relative">
      <button 
        onClick={onBack}
        className="flex items-center text-slate-500 hover:text-slate-800 mb-6 transition-colors"
      >
        <ArrowLeft size={18} className="mr-2" /> {t.backToDashboard}
      </button>

      <div className="mb-8 group">
        {isEditingHeader ? (
            <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-4">
                    <input 
                        type="text" 
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="text-3xl font-bold text-slate-900 bg-white border-b-2 border-blue-500 outline-none w-full py-1"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveProjectHeader()}
                    />
                    <div className="flex gap-2">
                        <button 
                            onClick={handleSaveProjectHeader}
                            className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                            title={t.saveTask}
                        >
                            <Check size={20} />
                        </button>
                        <button 
                            onClick={handleCancelProjectHeader}
                            className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
                            title={t.cancel}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <textarea 
                    ref={descTextareaRef}
                    value={tempDesc}
                    onChange={(e) => setTempDesc(e.target.value)}
                    className="text-slate-600 w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[80px]"
                    placeholder={t.projectDesc}
                />
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.projectVisibility}</label>
                    <div className="flex gap-2">
                        {(['PERSONAL', 'TEAM'] as ProjectVisibility[]).map(v => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setTempVisibility(v)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${tempVisibility === v ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                            >
                                {v === 'TEAM' ? <Users size={14} /> : <Lock size={14} />}
                                {v === 'TEAM' ? t.visibilityTeam : t.visibilityPersonal}
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">{tempVisibility === 'TEAM' ? t.visibilityTeamHint : t.visibilityPersonalHint}</p>
                </div>
            </div>
        ) : (
            <div 
                className="relative p-2 -m-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group/header"
                onClick={() => isOwner && setIsEditingHeader(true)}
            >
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold tracking-wide border ${project.visibility === 'TEAM' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {project.visibility === 'TEAM' ? <Users size={11} /> : <Lock size={11} />}
                        {project.visibility === 'TEAM' ? t.visibilityTeam : t.visibilityPersonal}
                    </span>
                    {project.visibility === 'TEAM' && project.ownerName && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-slate-500 bg-white border border-slate-200">
                            <User size={11} />
                            {t.projectOwnerLabel}{project.ownerName}
                        </span>
                    )}
                    {isOwner && <Pencil size={18} className="text-slate-300 opacity-0 group-hover/header:opacity-100 transition-all" />}
                </div>
                <p className="text-slate-500 mt-2 max-w-3xl leading-relaxed">{project.description}</p>
            </div>
        )}
      </div>

      {/* Milestone Timeline (Collapsible) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-10 overflow-hidden transition-all duration-300">
        <div 
            className={`px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors ${isMilestonesExpanded ? 'border-b border-slate-100' : ''}`}
            onClick={() => setIsMilestonesExpanded(!isMilestonesExpanded)}
        >
            <div className="flex items-center gap-4 overflow-hidden">
                <h2 className="text-lg font-bold text-slate-800 flex items-center whitespace-nowrap">
                    <Calendar className="mr-2 text-indigo-500" size={20} />
                    {t.projectMilestones}
                </h2>
                
                {/* Collapsed Summary */}
                {!isMilestonesExpanded && nextMilestone && (
                    <div className="hidden sm:flex items-center text-xs font-medium text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 truncate">
                        <span className="text-indigo-400 mr-1.5 whitespace-nowrap">{t.nextMilestone}:</span>
                        <span className="font-bold truncate max-w-[150px]">{nextMilestone.title}</span>
                        <span className="mx-1.5 opacity-50">|</span>
                        <span className="whitespace-nowrap">{new Date(nextMilestone.date).toLocaleDateString()}</span>
                    </div>
                )}
            </div>
            
            <div className="flex items-center gap-3 flex-shrink-0">
                <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenAddMilestone(); }}
                    className="text-sm flex items-center text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                    <Plus size={16} className="mr-1" /> {t.addMilestone}
                </button>
                <div className="p-1 text-slate-400">
                    {isMilestonesExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
            </div>
        </div>
        
        {isMilestonesExpanded && (
            <div className="p-8 overflow-x-auto bg-slate-50/30 animate-fade-in">
                <div className="relative flex items-center min-w-[600px] min-h-[140px]">
                    {/* Connecting Line */}
                    <div className="absolute left-0 right-0 top-1/2 h-1 bg-slate-100 -z-0"></div>
                    
                    <div className="w-full flex justify-between items-center z-10">
                        {sortedMilestones.map((milestone, index) => {
                            const isCompleted = milestone.completed;
                            const isCurrent = index === currentMilestoneIndex;

                            return (
                            <div key={milestone.id} className="relative flex flex-col items-center group cursor-pointer" onClick={(e) => handleOpenEditMilestone(milestone, e)}>
                                <div 
                                className={`w-4 h-4 rounded-full border-4 transition-all duration-300 relative ${
                                    isCompleted ? 'bg-green-500 border-green-100 w-6 h-6' : 
                                    isCurrent ? 'bg-indigo-600 border-indigo-100 w-8 h-8 shadow-lg ring-4 ring-indigo-50' : 
                                    'bg-white border-slate-300 group-hover:border-indigo-300'
                                }`}
                                >
                                    {isCompleted && <CheckCircle className="text-white w-full h-full" size={10}/>}
                                    
                                    {/* Edit Button (Hover) */}
                                    <div 
                                        className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <button 
                                            onClick={(e) => handleOpenEditMilestone(milestone, e)}
                                            className="p-1 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-blue-500 hover:border-blue-200 shadow-sm"
                                            title={t.editMilestone}
                                        >
                                            <Pencil size={10} />
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if(window.confirm(t.deleteMilestoneConfirm)) {
                                                    onDeleteMilestone(milestone.id);
                                                }
                                            }}
                                            className="p-1 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                </div>
                                <div className={`mt-4 text-center transition-colors ${isCurrent ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                                <p className={`text-sm font-bold ${isCurrent ? 'text-indigo-600' : 'text-slate-700'}`}>{milestone.title}</p>
                                <p className="text-xs text-slate-400">{new Date(milestone.date).toLocaleDateString()}</p>
                                {isCurrent && (
                                    <span className="absolute -top-8 bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
                                    {t.currentFocus}
                                    </span>
                                )}
                                </div>
                            </div>
                            );
                        })}
                        {sortedMilestones.length === 0 && (
                            <div className="text-slate-400 italic text-sm w-full text-center">{t.noMilestonesYet}</div>
                        )}
                    </div>
                </div>
                {nextMilestone && (
                    <div className="mt-8 p-3 bg-indigo-50 rounded-lg text-indigo-800 text-sm text-center border border-indigo-100">
                        {t.nextMilestone}: <strong>{nextMilestone.title}</strong> - {new Date(nextMilestone.date).toLocaleDateString()}
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Task List Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-slate-800">{t.projectTasks}</h2>
        
        <div className="flex flex-wrap gap-2 items-center">
            {/* View Switcher */}
            <div className="flex bg-white rounded-lg border border-slate-200 p-1 mr-2">
                <button 
                    onClick={() => setViewMode('LIST')}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'LIST' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    title={t.listView}
                >
                    <List size={18} />
                </button>
                <button 
                    onClick={() => setViewMode('GANTT')}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'GANTT' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    title={t.ganttView}
                >
                    <BarChart2 size={18} />
                </button>
            </div>

            {/* Filters - Styled with Custom Dropdown Appearance */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm">
                <Filter size={14} className="ml-1 text-slate-400"/>
                
                {/* Priority Select */}
                <div className="relative group">
                     <select 
                        className="text-sm appearance-none outline-none text-slate-600 bg-transparent py-1 pl-2 pr-6 cursor-pointer font-medium hover:text-blue-600 transition-colors"
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value as TaskPriority | 'ALL')}
                    >
                        <option value="ALL">{t.allPriorities}</option>
                        <option value={TaskPriority.HIGH}>{t.high}</option>
                        <option value={TaskPriority.MEDIUM}>{t.medium}</option>
                        <option value={TaskPriority.LOW}>{t.low}</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-blue-500" />
                </div>

                <div className="w-px h-4 bg-slate-200 mx-1"></div>

                 {/* Status Select (New) */}
                 <div className="relative group">
                     <select 
                        className="text-sm appearance-none outline-none text-slate-600 bg-transparent py-1 pl-2 pr-6 cursor-pointer font-medium hover:text-blue-600 transition-colors"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as TaskStatus | 'ALL')}
                    >
                        <option value="ALL">{t.allStatuses || "All Statuses"}</option>
                        <option value={TaskStatus.TODO}>{t.todo}</option>
                        <option value={TaskStatus.IN_PROGRESS}>{t.inProgress}</option>
                        <option value={TaskStatus.DONE}>{t.done}</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-blue-500" />
                </div>

                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                
                {/* Tag Select */}
                <div className="relative group">
                    <select 
                        className="text-sm appearance-none outline-none text-slate-600 bg-transparent py-1 pl-2 pr-6 cursor-pointer font-medium hover:text-blue-600 transition-colors max-w-[120px] truncate"
                        value={filterTag}
                        onChange={(e) => setFilterTag(e.target.value)}
                    >
                        <option value="">{t.allTags}</option>
                        {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-blue-500" />
                </div>
            </div>

            {/* Sort (Only for list) */}
            {viewMode === 'LIST' && (
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm">
                    <SlidersHorizontal size={14} className="ml-1 text-slate-400"/>
                    <div className="relative group">
                        <select 
                            className="text-sm appearance-none outline-none text-slate-600 bg-transparent py-1 pl-2 pr-6 cursor-pointer font-medium hover:text-blue-600 transition-colors"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'DATE' | 'PRIORITY')}
                        >
                            <option value="DATE">{t.sortByDate}</option>
                            <option value="PRIORITY">{t.sortByPriority}</option>
                        </select>
                        <ChevronDown size={12} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-blue-500" />
                    </div>
                </div>
            )}

            <button 
            onClick={onAddTask}
            className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm ml-2"
            >
            <Plus size={18} className="mr-2" /> {t.addTask}
            </button>
        </div>
      </div>

      {/* View Content */}
      {viewMode === 'GANTT' ? (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
             <GanttChart tasks={project.tasks} onTaskClick={onSelectTask} />
          </div>
      ) : (
          <div className="grid grid-cols-1 gap-4">
            {project.tasks.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                    <p className="text-slate-400">{t.noTasks}</p>
                    <button onClick={onAddTask} className="mt-2 text-blue-600 hover:underline">{t.createFirstTask}</button>
                </div>
            ) : organizedTasks.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                    <p className="text-slate-400">{t.noTasksFilter}</p>
                    <button onClick={() => { setFilterPriority('ALL'); setFilterTag(''); setFilterStatus('ALL'); }} className="mt-2 text-blue-600 hover:underline">{t.clearFilters}</button>
                </div>
            ) : (
                organizedTasks.map(({ task, depth, hasChildren }) => (
                <div 
                    key={task.id} 
                    className="relative"
                    style={{ marginLeft: `${depth * 24}px` }} // Indentation
                >
                    {/* Visual Connector Logic */}
                    {depth > 0 && (
                        <div className="absolute -left-[24px] top-0 bottom-0 w-[24px] pointer-events-none">
                            {/* Vertical Line from previous sibling */}
                            <div className="absolute left-0 top-0 bottom-[50%] border-l-2 border-slate-200"></div>
                            {/* Horizontal Line to current */}
                            <div className="absolute left-0 top-[50%] w-full border-t-2 border-slate-200 rounded-bl-lg"></div>
                        </div>
                    )}
                    {/* Continuing Vertical Line for children */}
                    {/* If this node is not last child, we might need a continuous line on the left, but simplified tree usually doesn't need complex lines */}

                    <div 
                        onClick={() => onSelectTask(task.id)}
                        className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group relative z-10 ${depth > 0 ? 'bg-slate-50/50' : ''}`}
                    >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center mb-1 flex-wrap gap-2">
                                {/* Dependency Icon Indicator */}
                                {depth > 0 && <CornerDownRight size={14} className="text-slate-400" />}
                                
                                <h3 className="text-lg font-semibold text-slate-800 group-hover:text-blue-600 transition-colors mr-1">{task.title}</h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border ${getTaskStatusColor(task.status)}`}>
                                    {getTaskStatusText(task.status)}
                                </span>
                                <div className={`flex items-center text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border ${getPriorityColor(task.priority || TaskPriority.MEDIUM)}`}>
                                    <Flag size={10} className={`mr-1 ${getPriorityIconColor(task.priority || TaskPriority.MEDIUM)}`} />
                                    {getPriorityText(task.priority || TaskPriority.MEDIUM)}
                                </div>
                                {task.tags && task.tags.map(tag => (
                                    <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                            <p className="text-slate-500 text-sm line-clamp-1 mt-1">{task.description}</p>
                        </div>
                        
                        <div className="flex items-center gap-6 text-sm text-slate-500">
                            <div className="flex items-center" title="Assignee">
                                <User size={16} className="mr-1.5 text-slate-400" />
                                {task.assignee || 'Unassigned'}
                            </div>
                            <div className="flex items-center" title="Date Range">
                                <Clock size={16} className="mr-1.5 text-slate-400" />
                                {new Date(task.startDate).toLocaleDateString()} - {new Date(task.dueDate).toLocaleDateString()}
                            </div>
                            <div className="flex items-center pl-4 border-l border-slate-100">
                                <div 
                                    className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-green-600 transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const nextStatus = task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;
                                        onUpdateTaskStatus(task.id, nextStatus);
                                    }}
                                >
                                    {task.status === TaskStatus.DONE ? <CheckCircle size={22} className="text-green-500" /> : <Circle size={22} />}
                                </div>
                            </div>
                        </div>
                        </div>
                        
                        {/* Subtask Preview */}
                        {task.subtasks.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-50 flex gap-2">
                                <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-green-500" 
                                        style={{ width: `${(task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100}%` }}
                                    />
                                </div>
                                <span className="text-xs text-slate-400 font-medium w-16 text-right">
                                    {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length} {t.subtasksCount}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                ))
            )}
          </div>
      )}

      {/* New/Edit Milestone Modal */}
      {showMilestoneModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <h3 className="font-bold text-slate-800">{editingMilestoneId ? t.editMilestone : t.addMilestone}</h3>
                    <button onClick={() => setShowMilestoneModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSaveMilestone} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t.milestoneTitle}</label>
                        <input 
                            type="text" 
                            required
                            value={newMilestoneTitle}
                            onChange={(e) => setNewMilestoneTitle(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={t.enterTitle}
                        />
                    </div>
                    <div>
                        <DatePicker 
                            label={t.milestoneDate}
                            value={newMilestoneDate}
                            onChange={setNewMilestoneDate}
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button 
                            type="button" 
                            onClick={() => setShowMilestoneModal(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
                        >
                            {t.cancel}
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                        >
                            {editingMilestoneId ? t.saveMilestone : t.createMilestone}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
