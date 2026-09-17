
import React, { useMemo, useState } from 'react';
import { Project, TaskStatus, ProjectStatus, Milestone, ProjectVisibility } from '../types';
import { Briefcase, CheckCircle, Clock, AlertCircle, Plus, X, Settings, List, Ban, RefreshCw, AlertTriangle, Pencil, Flag, Trash2, CheckSquare, Check, Search, FileSpreadsheet, Copy, LayoutList, StretchVertical, ChevronRight, ChevronDown, Lock, Users, User } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

// Define a consistent color palette
const PROJECT_THEMES = [
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', bar: 'bg-blue-600', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', bar: 'bg-emerald-600', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', bar: 'bg-amber-600', dot: 'bg-amber-500' },
  { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', bar: 'bg-purple-600', dot: 'bg-purple-500' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', bar: 'bg-rose-600', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-900', bar: 'bg-cyan-600', dot: 'bg-cyan-500' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900', bar: 'bg-indigo-600', dot: 'bg-indigo-500' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', bar: 'bg-orange-600', dot: 'bg-orange-500' },
];

const getProjectTheme = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PROJECT_THEMES.length;
  return PROJECT_THEMES[index];
};

interface DashboardProps {
  projects: Project[];
  currentUserId?: string;
  onSelectProject: (projectId: string) => void;
  onUpdateTaskStatus: (projectId: string, taskId: string, status: TaskStatus) => void;
  onCreateProject: (name: string, desc: string, visibility: ProjectVisibility) => void;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onUpdateProjectStatus: (projectId: string, status: ProjectStatus) => void;
  onViewAllTasks: (filter: 'ALL' | 'PENDING') => void;
  onUpdateMilestone: (projectId: string, milestone: Milestone) => void;
  onExportExcel: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
    projects = [], 
    currentUserId,
    onSelectProject, 
    onCreateProject, 
    onDuplicateProject,
    onDeleteProject, 
    onUpdateProjectStatus,
    onViewAllTasks,
    onUpdateMilestone,
    onExportExcel
}) => {
  const { t } = useLanguage();
  
  // UI State - Default set to COMPACT as requested
  const [viewMode, setViewMode] = useState<'COMFORTABLE' | 'COMPACT'>('COMPACT');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectVisibility, setNewProjectVisibility] = useState<ProjectVisibility>('PERSONAL');
  const [projectSearch, setProjectSearch] = useState('');

  // Milestone Confirmation State
  const [milestoneToConfirm, setMilestoneToConfirm] = useState<{projectId: string, milestone: Milestone} | null>(null);

  // State to track which action is pending confirmation
  const [confirmAction, setConfirmAction] = useState<{id: string, type: 'SUSPEND' | 'DELETE' | 'RESTORE' | 'COMPLETE' | 'ACTIVATE'} | null>(null);

  const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);
  const completedProjects = projects.filter(p => p.status === ProjectStatus.COMPLETED);
  const visibleProjects = projects.filter(p => p.status !== ProjectStatus.TRASHED);
  
  const filteredActiveProjects = activeProjects.filter(p => 
      p.name.toLowerCase().includes(projectSearch.toLowerCase()) || 
      p.description.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const stats = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;
    let pendingTasks = 0;
    const statsProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);

    if (Array.isArray(statsProjects)) {
        statsProjects.forEach(p => {
            if (p && Array.isArray(p.tasks)) {
                p.tasks.forEach(t => {
                    totalTasks++;
                    if (t.status === TaskStatus.DONE) completedTasks++;
                    else pendingTasks++;
                });
            }
        });
    }

    const overallProgress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
    return { totalTasks, completedTasks, pendingTasks, overallProgress };
  }, [projects]);

  const handleSubmitNewProject = (e: React.FormEvent) => {
      e.preventDefault();
      if(newProjectName.trim()) {
          onCreateProject(newProjectName, newProjectDesc, newProjectVisibility);
          setNewProjectName('');
          setNewProjectDesc('');
          setNewProjectVisibility('PERSONAL');
          setShowNewProjectModal(false);
      }
  };

  // Project-level actions belong to the creator; TEAM projects only open up task editing.
  const isOwner = (project: Project) => !project.ownerId || project.ownerId === currentUserId;

  const renderVisibilityBadge = (project: Project) => {
      const isTeam = project.visibility === 'TEAM';
      return (
          <span className="hidden sm:inline-flex items-center gap-1 flex-shrink-0 min-w-0">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide border ${isTeam ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                  {isTeam ? <Users size={9} /> : <Lock size={9} />}
                  {isTeam ? t.visibilityTeam : t.visibilityPersonal}
              </span>
              {isTeam && project.ownerName && (
                  <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold text-slate-500 bg-white border border-slate-200 max-w-[120px]"
                      title={`${t.projectOwnerLabel}${project.ownerName}`}
                  >
                      <User size={9} className="flex-shrink-0" />
                      <span className="truncate">{project.ownerName}</span>
                  </span>
              )}
          </span>
      );
  };

  const handleEditClick = (projectId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectProject(projectId);
  }

  const handleDuplicateClick = (projectId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onDuplicateProject(projectId);
  }

  const toggleProjectExpansion = (projectId: string) => {
      if (viewMode === 'COMFORTABLE') return; 
      setExpandedProjectId(expandedProjectId === projectId ? null : projectId);
  };

  const initiateAction = (id: string, type: 'SUSPEND' | 'DELETE' | 'RESTORE' | 'COMPLETE' | 'ACTIVATE') => {
      setConfirmAction({ id, type });
  };

  const cancelAction = () => {
      setConfirmAction(null);
  };

  const executeAction = () => {
      if (!confirmAction) return;
      switch(confirmAction.type) {
          case 'SUSPEND': onUpdateProjectStatus(confirmAction.id, ProjectStatus.SUSPENDED); break;
          case 'RESTORE':
          case 'ACTIVATE': onUpdateProjectStatus(confirmAction.id, ProjectStatus.ACTIVE); break;
          case 'COMPLETE': onUpdateProjectStatus(confirmAction.id, ProjectStatus.COMPLETED); break;
          case 'DELETE': onDeleteProject(confirmAction.id); break;
      }
      setConfirmAction(null);
  };

  const handleMilestoneClick = (projectId: string, milestone: Milestone, e: React.MouseEvent) => {
      e.stopPropagation();
      setMilestoneToConfirm({ projectId, milestone });
  };

  const confirmMilestoneUpdate = () => {
      if (milestoneToConfirm) {
          const { projectId, milestone } = milestoneToConfirm;
          onUpdateMilestone(projectId, { ...milestone, completed: !milestone.completed });
          setMilestoneToConfirm(null);
      }
  };

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const isToday = (dateStr: string) => dateStr === getTodayStr();
  const isFuture = (dateStr: string) => new Date(dateStr) > new Date(getTodayStr());

  return (
    <div className="space-y-4 animate-fade-in relative pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-1">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t.dashboard}</h1>
        </div>
      </div>

      {/* KPI Cards Container */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Active Projects */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-3 transition-all hover:shadow-md">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg flex-shrink-0"><Briefcase size={18} /></div>
                <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 font-medium truncate uppercase tracking-wider">{t.activeProjects}</p>
                    <p className="text-lg font-bold text-slate-800">{activeProjects.length}</p>
                </div>
            </div>

            {/* Completed Projects */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-3 transition-all hover:shadow-md">
                <div className="p-2 bg-green-50 text-green-600 rounded-lg flex-shrink-0"><CheckSquare size={18} /></div>
                <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 font-medium truncate uppercase tracking-wider">{t.completedProjects}</p>
                    <p className="text-lg font-bold text-slate-800">{completedProjects.length}</p>
                </div>
            </div>

            {/* Overall Completion */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-3 transition-all hover:shadow-md">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg flex-shrink-0"><CheckCircle size={18} /></div>
                <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 font-medium truncate uppercase tracking-wider">{t.overallCompletion}</p>
                    <p className="text-lg font-bold text-slate-800">{stats.overallProgress}%</p>
                </div>
            </div>

            {/* Tasks Remaining */}
            <div onClick={() => onViewAllTasks('PENDING')} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-3 cursor-pointer hover:shadow-md hover:border-amber-200 transition-all">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg flex-shrink-0"><Clock size={18} /></div>
                <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 font-medium truncate uppercase tracking-wider">{t.tasksRemaining}</p>
                    <p className="text-lg font-bold text-slate-800">{stats.pendingTasks}</p>
                </div>
            </div>

            {/* Total Tasks */}
            <div onClick={() => onViewAllTasks('ALL')} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-3 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg flex-shrink-0"><AlertCircle size={18} /></div>
                <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 font-medium truncate uppercase tracking-wider">{t.totalTasks}</p>
                    <p className="text-lg font-bold text-slate-800">{stats.totalTasks}</p>
                </div>
            </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center bg-slate-50/50 gap-4">
            <div className="flex items-center gap-4 w-full lg:w-auto">
                <h2 className="font-bold text-slate-700 text-sm hidden md:block uppercase tracking-wider">{t.projectProgress}</h2>
                
                <div className="flex bg-slate-200/60 p-0.5 rounded-lg">
                    <button 
                        onClick={() => setViewMode('COMFORTABLE')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${viewMode === 'COMFORTABLE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        title={t.comfortableView}
                    >
                        <LayoutList size={14} />
                        <span className="hidden sm:inline">{t.comfortableView}</span>
                    </button>
                    <button 
                        onClick={() => { setViewMode('COMPACT'); setExpandedProjectId(null); }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${viewMode === 'COMPACT' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        title={t.compactView}
                    >
                        <StretchVertical size={14} />
                        <span className="hidden sm:inline">{t.compactView}</span>
                    </button>
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                 <div className="relative flex-1 sm:flex-none">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                     <input type="text" className="w-full sm:w-56 pl-9 pr-4 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800" placeholder={t.searchProjects} value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} />
                 </div>
                <div className="flex gap-2">
                    <button type="button" onClick={onExportExcel} className="flex-1 sm:flex-none justify-center flex items-center bg-white border border-slate-300 text-slate-600 hover:bg-green-50 hover:text-green-700 hover:border-green-200 px-3 py-1.5 rounded-lg font-bold transition-colors shadow-sm text-xs whitespace-nowrap"><FileSpreadsheet size={14} className="mr-1.5" /> Excel</button>
                    <button type="button" onClick={() => setShowManageModal(true)} className="flex-1 sm:flex-none justify-center flex items-center bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-bold transition-colors shadow-sm text-xs whitespace-nowrap"><List size={14} className="mr-1.5" /> {t.manageProjects}</button>
                    <button type="button" onClick={() => setShowNewProjectModal(true)} className="flex-1 sm:flex-none justify-center flex items-center bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold transition-colors shadow-sm text-xs whitespace-nowrap"><Plus size={14} className="mr-1.5" /> {t.newProject}</button>
                </div>
            </div>
        </div>
        
        <div className="divide-y divide-slate-100 bg-white">
            {filteredActiveProjects.length === 0 ? (
                <div className="p-10 text-center text-slate-500">
                    <Briefcase size={40} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-sm">{projectSearch ? t.noTasksFilter : t.noActiveTasks}</p>
                </div>
            ) : filteredActiveProjects.map((project) => {
                const totalTasks = project.tasks.length;
                const completedTasks = project.tasks.filter(t => t.status === TaskStatus.DONE).length;
                const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
                const theme = getProjectTheme(project.id);
                const sortedMilestones = [...project.milestones].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const isExpanded = viewMode === 'COMFORTABLE' || expandedProjectId === project.id;

                return (
                    <div 
                        key={project.id} 
                        className={`transition-all ${isExpanded ? theme.bg + ' bg-opacity-40 ring-1 ring-inset ' + theme.border : 'bg-white hover:bg-slate-50'}`}
                    >
                        <div 
                            onClick={() => toggleProjectExpansion(project.id)}
                            className={`flex justify-between items-center px-5 transition-all cursor-pointer ${viewMode === 'COMPACT' ? 'py-3' : 'pt-4 pb-1'}`}
                        >
                             <div className="flex items-center gap-3 flex-1 min-w-0">
                                {viewMode === 'COMPACT' && (
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <div className={`w-2 h-2 rounded-full ${theme.dot}`}></div>
                                        {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                    </div>
                                )}
                                <h3 className={`font-bold transition-all truncate ${viewMode === 'COMPACT' ? 'text-sm text-slate-700' : 'text-base text-blue-900'}`}>
                                    {project.name}
                                </h3>
                                {renderVisibilityBadge(project)}
                                {viewMode === 'COMPACT' && (
                                     <span className="text-[10px] font-bold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                                        {percent}%
                                     </span>
                                )}
                             </div>

                             <div className="flex gap-1.5 ml-4">
                                <button onClick={(e) => handleDuplicateClick(project.id, e)} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-green-600 hover:border-green-300 transition-colors shadow-sm" title={t.copyProject}><Copy size={13} /></button>
                                <button onClick={(e) => handleEditClick(project.id, e)} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-sm" title={t.editProject}><Pencil size={13} /></button>
                             </div>
                        </div>

                        <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div 
                                className="px-5 pb-5 pt-1 cursor-pointer"
                                onClick={() => onSelectProject(project.id)}
                            >
                                <div className="mb-4">
                                     <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">{project.description}</p>
                                </div>

                                <div className="flex flex-col lg:flex-row items-center gap-5">
                                    <div className="w-full lg:w-auto lg:min-w-[320px]">
                                         <div className="bg-white/70 border border-white/80 rounded-lg p-2 flex items-center gap-3 shadow-sm">
                                             <span className="text-xl font-black text-slate-800">{percent}%</span>
                                             <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                 <div className={`h-full transition-all duration-500 rounded-full ${theme.bar}`} style={{width: `${percent}%`}}></div>
                                             </div>
                                             <div className="text-[10px] text-slate-500 font-bold whitespace-nowrap">
                                                  {completedTasks}/{totalTasks}
                                             </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 w-full min-w-0"> 
                                        {sortedMilestones.length > 0 ? (
                                            <div className="relative flex justify-between items-start pt-1 px-1">
                                                <div className="absolute top-[7px] left-2 right-2 h-0.5 bg-slate-200/80 -z-0"></div>
                                                {sortedMilestones.map((m) => {
                                                    const isDateToday = isToday(m.date);
                                                    const isOverdue = !m.completed && !isDateToday && new Date(m.date) < new Date(new Date().setHours(0,0,0,0));
                                                    return (
                                                        <div key={m.id} className="relative flex flex-col items-center flex-1 max-w-[90px] text-center group z-10" onClick={(e) => handleMilestoneClick(project.id, m, e)}>
                                                            <div className={`w-3.5 h-3.5 rounded-full border-2 z-10 box-content mb-1.5 transition-all duration-300 cursor-pointer flex items-center justify-center ${m.completed ? 'bg-green-500 border-green-500 shadow-sm' : isDateToday ? 'bg-white border-amber-400 ring-4 ring-amber-100' : isOverdue ? 'bg-white border-red-500 ring-2 ring-red-100' : 'bg-white border-slate-300'}`} title={m.completed ? "Mark as Incomplete" : "Mark as Complete"}>{m.completed && <Check size={8} strokeWidth={4} className="text-white" />}</div>
                                                            <div className="flex flex-col items-center w-full pointer-events-none">
                                                                <p className={`text-[10px] font-bold truncate w-full px-1 ${m.completed ? 'text-green-700' : isDateToday ? 'text-amber-600' : isOverdue ? 'text-red-600' : 'text-slate-600'}`} title={m.title}>{m.title}</p>
                                                                <p className={`text-[9px] leading-tight mt-0.5 ${isDateToday ? 'text-amber-500 font-bold' : isOverdue ? 'text-red-400 font-medium' : 'text-slate-400'}`}>{m.date}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-slate-400 italic py-1 text-center lg:text-left">{t.noMilestonesSet}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>

      {/* Milestone Confirmation Modal */}
      {milestoneToConfirm && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Flag size={18} className="text-blue-500" />{t.confirmMilestoneUpdate}</h3>
                    <button onClick={() => setMilestoneToConfirm(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <div className="p-6">
                    {milestoneToConfirm.milestone.completed ? (<p className="text-slate-700 text-sm mb-4">{t.confirmUncomplete}</p>) : isFuture(milestoneToConfirm.milestone.date) ? (<div className="bg-green-50 border border-green-100 rounded-lg p-3 mb-4"><p className="text-green-800 text-sm font-medium">{t.confirmEarlyComplete.replace('{plan}', milestoneToConfirm.milestone.date).replace('{actual}', getTodayStr())}</p></div>) : (<p className="text-slate-700 text-sm mb-4">{t.confirmComplete}</p>)}
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setMilestoneToConfirm(null)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">{t.noCancel}</button>
                        <button onClick={confirmMilestoneUpdate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{t.yesUpdate}</button>
                    </div>
                </div>
             </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800">{t.newProject}</h3>
                    <button type="button" onClick={() => setShowNewProjectModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmitNewProject} className="p-6 space-y-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">{t.projectName}</label><input type="text" required value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder={t.enterTitle} /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">{t.projectDesc}</label><textarea rows={3} value={newProjectDesc} onChange={(e) => setNewProjectDesc(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder={t.descPlaceholder} /></div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.projectVisibility}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(['PERSONAL', 'TEAM'] as ProjectVisibility[]).map(v => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => setNewProjectVisibility(v)}
                                    className={`text-left p-3 rounded-lg border transition-all ${newProjectVisibility === v ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                >
                                    <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                                        {v === 'TEAM' ? <Users size={14} className="text-indigo-500" /> : <Lock size={14} className="text-slate-400" />}
                                        {v === 'TEAM' ? t.visibilityTeam : t.visibilityPersonal}
                                    </span>
                                    <span className="block text-[11px] text-slate-500 mt-1 leading-snug">{v === 'TEAM' ? t.visibilityTeamHint : t.visibilityPersonalHint}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setShowNewProjectModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">{t.cancel}</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">{t.createProject}</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Manage Projects Modal */}
      {showManageModal && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[85vh] flex flex-col">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center"><Settings className="mr-2 text-slate-500" size={20} />{t.projectManagement}</h3>
                    <button type="button" onClick={() => setShowManageModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <div className="p-4 overflow-y-auto flex-1 bg-slate-50/50">
                    <div className="space-y-3">
                        {visibleProjects.map(p => {
                            const isConfirming = confirmAction?.id === p.id;
                            const isActive = p.status === ProjectStatus.ACTIVE;
                            const isCompleted = p.status === ProjectStatus.COMPLETED;
                            return (
                                <div key={p.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1"><h4 className="font-bold text-slate-800 text-base truncate">{p.name}</h4><span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${isActive ? 'bg-green-50 text-green-700 border-green-200' : isCompleted ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{isActive ? t.statusActive : isCompleted ? t.statusCompleted : t.statusSuspended}</span>{renderVisibilityBadge(p)}</div>
                                        <p className="text-xs text-slate-500 line-clamp-1">{p.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
                                        {isConfirming ? (
                                            <div className="flex items-center gap-2 bg-red-50 p-1.5 rounded-lg border border-red-100 animate-fade-in"><AlertTriangle size={16} className="text-red-500 ml-1" /><span className="text-[11px] font-bold text-red-700 mr-2">{confirmAction.type === 'DELETE' ? t.confirmTerminate : confirmAction.type === 'SUSPEND' ? t.confirmSuspend : confirmAction.type === 'COMPLETE' ? 'Mark Done?' : 'Activate?'}</span><button type="button" onClick={executeAction} className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded shadow-sm hover:bg-red-700 transition-colors">Yes</button><button type="button" onClick={cancelAction} className="px-3 py-1 bg-white text-slate-600 border border-slate-200 text-xs font-bold rounded hover:bg-slate-50 transition-colors">No</button></div>
                                        ) : (
                                            <>
                                                <button type="button" onClick={(e) => handleDuplicateClick(p.id, e)} className="flex items-center px-3 py-2 text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors shadow-sm"><Copy size={13} className="mr-1.5" /> {t.copyProject}</button>
                                                {isOwner(p) && !isCompleted && <button type="button" onClick={() => initiateAction(p.id, 'COMPLETE')} className="flex items-center px-3 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-[11px] font-bold transition-colors shadow-sm"><CheckSquare size={13} className="mr-1.5" /> {t.markCompleted}</button>}
                                                {isOwner(p) && !isActive && <button type="button" onClick={() => initiateAction(p.id, 'ACTIVATE')} className="flex items-center px-3 py-2 text-green-600 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-[11px] font-bold transition-colors shadow-sm"><RefreshCw size={13} className="mr-1.5" /> {t.markActive}</button>}
                                                {isOwner(p) && isActive && <button type="button" onClick={() => initiateAction(p.id, 'SUSPEND')} className="flex items-center px-3 py-2 text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-[11px] font-bold transition-colors shadow-sm"><Ban size={13} className="mr-1.5" /> {t.suspendProject}</button>}
                                                {isOwner(p)
                                                    ? <button type="button" onClick={() => initiateAction(p.id, 'DELETE')} className="flex items-center px-3 py-2 text-slate-500 bg-white hover:bg-slate-50 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-lg text-[11px] font-bold transition-colors shadow-sm"><Trash2 size={13} className="mr-1.5" /> {t.terminateProject}</button>
                                                    : <span className="px-3 py-2 text-[11px] text-slate-400 italic">{t.ownerOnlyAction}</span>}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};
