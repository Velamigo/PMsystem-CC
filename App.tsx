
import React, { useState, useEffect, useRef } from 'react';
import { Project, Task, ViewState, TaskStatus, AppNotification, Milestone, ProjectStatus, AppSettings } from './types';
import { getProjects, saveProjects, getNotifications, addNotification, markNotificationRead, checkDeadlines, createProject, duplicateProject, deleteProject, hardDeleteProject, addMilestone, updateMilestone, deleteMilestone, setProjectStatus, generateBackupData, getSettings, saveSettings, importData, exportData, updateProject } from './services/supabaseService';
import { getCurrentUser, logout, changeOwnPassword, updateCurrentUser, type User as AuthUser } from './src/services/auth';
import { exportToExcelDB, importFromExcelDB, generateExcelBuffer } from './services/excelService';
import { Dashboard } from './components/Dashboard';
import { ProjectDetail } from './components/ProjectDetail';
import { TaskDetail } from './components/TaskDetail';
import { CalendarView } from './components/CalendarView';
import { SettingsPage } from './components/SettingsPage';
import { NotificationList } from './components/NotificationList';
import { GlobalTaskList } from './components/GlobalTaskList';
import LoginPage from './src/components/LoginPage';
import AdminPanel from './src/components/AdminPanel';
import { Bell, Calendar, Layout, Globe, Download, Upload, Settings, Trash2, X, RefreshCw, AlertTriangle, LogOut, Edit2, CheckCircle, Database, Shield, Key } from 'lucide-react';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';

const AppContent: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewState, setViewState] = useState<ViewState>({ type: 'DASHBOARD' });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // User Profile State
  const [userName, setUserName] = useState('User');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  // Toast Notification
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  // Auto Backup State
  const [backupDirHandle, setBackupDirHandle] = useState<any>(null); // Browser handle
  const [backupPath, setBackupPath] = useState<string | null>(null); // Electron path

  // State for Recycle Bin Modal confirmation interactions
  const [confirmBinAction, setConfirmBinAction] = useState<{id: string, type: 'RESTORE' | 'HARD_DELETE'} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language, setLanguage, t } = useLanguage();

  // Check auth state on mount
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setIsAuthenticated(true);
      setCurrentUser(user);
      setUserName(user.name);
    }
  }, []);

  // Load data on mount (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadData = async () => {
      try {
        const data = await getProjects();
        const safeData = Array.isArray(data) ? data : [];
        setProjects(safeData);
        
        // Notification initialization
        const savedNotifications = await getNotifications();
        const safeSavedNotifications = Array.isArray(savedNotifications) ? savedNotifications : [];
        
        // Check deadlines returns array
        const deadlineNotifications = await checkDeadlines(safeData);
        
        // Combine if checkDeadlines returned new ones, otherwise use saved
        setNotifications(deadlineNotifications.length > safeSavedNotifications.length ? deadlineNotifications : safeSavedNotifications);

        // Load Settings
        const settings = await getSettings();
        if (settings) {
            if (settings.userName) setUserName(settings.userName);
        }
        if (window.electron && settings.backupPath) {
            setBackupPath(settings.backupPath);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isAuthenticated]);

  const handleLogout = async () => {
    logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setProjects([]);
    setNotifications([]);
  };

  const handleLogin = () => {
    const user = getCurrentUser();
    if (user) {
      setCurrentUser(user);
      setIsAuthenticated(true);
      setUserName(user.name);
      setLoading(true);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentUser) return;
    setPasswordMsg(null);
    const { success, error } = await changeOwnPassword(currentUser.id, oldPassword, newPassword);
    if (success) {
      setPasswordMsg({ msg: '密码修改成功', type: 'success' });
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => { setShowPasswordChange(false); setPasswordMsg(null); }, 2000);
    } else {
      setPasswordMsg({ msg: error || '修改失败', type: 'error' });
    }
  };

  const handleUpdateCurrentUser = (user: AuthUser) => {
    updateCurrentUser(user);
    setCurrentUser(user);
    setUserName(user.name);
  };

  // Auto Backup Logic
  useEffect(() => {
      const performBackup = async () => {
          try {
              const currentSettings = await getSettings();
              // Check if any auto-backup feature is enabled
              const isExcelEnabled = currentSettings.enableAutoExcelExport;
              
              const hasBrowserHandle = !!backupDirHandle;
              const hasElectronPath = !!(window.electron && backupPath);
              const canWriteToFile = hasBrowserHandle || hasElectronPath;

              // If nothing is enabled or possible, exit
              if (!canWriteToFile && !isExcelEnabled) return;

              const now = new Date();
              const yyyy = now.getFullYear();
              const mm = String(now.getMonth() + 1).padStart(2, '0');
              const dd = String(now.getDate()).padStart(2, '0');
              const hh = String(now.getHours()).padStart(2, '0');
              const min = String(now.getMinutes()).padStart(2, '0');
              const ss = String(now.getSeconds()).padStart(2, '0');
              const timestamp = `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
              
              const jsonFileName = `PT_${timestamp}.json`;
              const excelFileName = `PT_${timestamp}.xlsx`;

              // 1. Generate Data
              const jsonData = await generateBackupData();
              let excelData: Uint8Array | null = null;
              if (isExcelEnabled) {
                   const currentProjects = await getProjects();
                   excelData = generateExcelBuffer(currentProjects);
              }

              // 2. Strategy A: Write to Disk (Preferred)
              if (canWriteToFile) {
                  if (hasElectronPath && window.electron && backupPath) {
                      // Electron
                      await window.electron.saveFile(backupPath, jsonFileName, jsonData);
                      if (excelData) await window.electron.saveFile(backupPath, excelFileName, excelData);
                      console.log('Auto backup (Electron) successful');
                  } else if (hasBrowserHandle) {
                      // Browser File System API
                      // @ts-ignore
                      const fileHandle = await backupDirHandle.getFileHandle(jsonFileName, { create: true });
                      // @ts-ignore
                      const writable = await fileHandle.createWritable();
                      await writable.write(jsonData);
                      await writable.close();
                      
                      if (excelData) {
                          // @ts-ignore
                          const excelHandle = await backupDirHandle.getFileHandle(excelFileName, { create: true });
                          // @ts-ignore
                          const excelWritable = await excelHandle.createWritable();
                          await excelWritable.write(excelData);
                          await excelWritable.close();
                      }
                      console.log('Auto backup (Browser) successful');
                  }
              } 
              // 3. Strategy B: Fallback Notification (If Excel enabled but no folder selected)
              else if (isExcelEnabled) {
                  const notif: AppNotification = {
                      id: (crypto as any).randomUUID(),
                      title: 'Scheduled Backup Ready',
                      message: 'Click to download your scheduled Excel backup.',
                      type: 'BACKUP',
                      read: false,
                      createdAt: new Date().toISOString(),
                  };
                  const updated = await addNotification(notif);
                  setNotifications(updated);
              }

          } catch (err) {
              console.error('Auto backup failed:', err);
          }
      };

      // Perform initial check/backup if conditions met
      // performBackup(); // Optional: triggered on mount/change, but maybe too aggressive.

      // Schedule every hour (3600000 ms)
      const intervalId = setInterval(performBackup, 3600000);

      return () => clearInterval(intervalId);
  }, [backupDirHandle, backupPath]);

  // Toast Helper
  const showToast = (msg: string) => {
      setToastMsg(msg);
      setTimeout(() => setToastMsg(null), 3000);
  };

  // Filter trashed projects
  const trashedProjects = projects.filter(p => p.status === ProjectStatus.TRASHED);

  const getInitials = (name: string) => {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const saveUserName = async () => {
      if (tempName.trim()) {
          setUserName(tempName.trim());
          const s = await getSettings();
          await saveSettings({ ...s, userName: tempName.trim() });
          setIsEditingName(false);
          showToast("Nickname updated");
      }
  };

  // Recursively update downstream tasks
  const propagateDependencyDelays = (allTasks: Task[], changedTask: Task): Task[] => {
      let updatedTasks = [...allTasks];
      // Find direct dependents
      const dependents = updatedTasks.filter(t => t.dependencies.includes(changedTask.id));
      
      dependents.forEach(dep => {
          const prevTaskDueDate = new Date(changedTask.dueDate);
          const depStartDate = new Date(dep.startDate);
          
          if (depStartDate <= prevTaskDueDate) {
              // Calculate shift amount
              const newStartDate = new Date(prevTaskDueDate);
              newStartDate.setDate(newStartDate.getDate() + 1); // Start next day
              
              const duration = new Date(dep.dueDate).getTime() - new Date(dep.startDate).getTime();
              const newDueDate = new Date(newStartDate.getTime() + duration);
              
              const updatedDep = {
                  ...dep,
                  startDate: newStartDate.toISOString().split('T')[0],
                  dueDate: newDueDate.toISOString().split('T')[0]
              };
              
              // Update array
              updatedTasks = updatedTasks.map(t => t.id === dep.id ? updatedDep : t);
              
              // Recurse
              updatedTasks = propagateDependencyDelays(updatedTasks, updatedDep);
          }
      });
      
      return updatedTasks;
  };

  const handleCreateTask = async (newTask: Task) => {
    // Handle notification for new assignment before map
    if (newTask.assignee && !projects.some(p => p.id === newTask.projectId && p.tasks.some(t => t.id === newTask.id))) {
        const notif: AppNotification = {
            id: (crypto as any).randomUUID(),
            title: language === 'zh' ? '新任务分配' : 'New Task Assigned',
            message: language === 'zh' ? `您被分配了任务 "${newTask.title}"` : `You have been assigned to "${newTask.title}"`,
            type: 'ASSIGNMENT',
            read: false,
            createdAt: new Date().toISOString(),
            relatedId: newTask.id
        };
        const updatedNotifs = await addNotification(notif);
        setNotifications(updatedNotifs);
    }

    const updatedProjects = projects.map(p => {
        if (p.id === newTask.projectId) {
            let updatedTasks = [...p.tasks];
            
            // 1. Update or Add the specific task
            const taskIndex = updatedTasks.findIndex(t => t.id === newTask.id);
            if (taskIndex >= 0) {
                updatedTasks[taskIndex] = newTask;
            } else {
                updatedTasks.push(newTask);
            }
            
            // 2. Handle Dependency Cascade
            updatedTasks = propagateDependencyDelays(updatedTasks, newTask);

            return { ...p, tasks: updatedTasks };
        }
        return p;
    });
    
    setProjects(updatedProjects);
    await saveProjects(updatedProjects);
    
    // Return to project view
    setViewState({ type: 'PROJECT_DETAIL', projectId: newTask.projectId });
  };

  const handleDeleteTask = async (taskId: string, projectId: string) => {
      if (!taskId || !projectId) return;

      const updatedProjects = projects.map(p => {
          if (p.id === projectId) {
              return { ...p, tasks: p.tasks.filter(t => t.id !== taskId) };
          }
          return p;
      });
      setProjects(updatedProjects);
      await saveProjects(updatedProjects);
      setViewState({ type: 'PROJECT_DETAIL', projectId });
  };

  const handleUpdateTaskStatus = async (projectId: string, taskId: string, status: TaskStatus) => {
      const updatedProjects = projects.map(p => {
          if (p.id === projectId) {
              const task = p.tasks.find(t => t.id === taskId);
              if (task && task.status !== status) {
                  // Add notification for status change
                  const statusText = status === TaskStatus.DONE ? t.done : status === TaskStatus.IN_PROGRESS ? t.inProgress : t.todo;

                  const notif: AppNotification = {
                      id: (crypto as any).randomUUID(),
                      title: language === 'zh' ? '任务更新' : 'Task Updated',
                      message: language === 'zh' ? `任务 "${task.title}" 标记为 ${statusText}` : `Task "${task.title}" marked as ${statusText}`,
                      type: 'STATUS_CHANGE',
                      read: false,
                      createdAt: new Date().toISOString(),
                      relatedId: taskId
                  };
                  addNotification(notif).then(updated => setNotifications(updated));
              }

              return {
                  ...p,
                  tasks: p.tasks.map(t => t.id === taskId ? { ...t, status } : t)
              };
          }
          return p;
      });
      setProjects(updatedProjects);
      await saveProjects(updatedProjects);
  };

  const handleNotificationClick = async (notification: AppNotification) => {
      // 1. Mark as read
      await markNotificationRead(notification.id);
      const updated = notifications.map(n => n.id === notification.id ? { ...n, read: true } : n);
      setNotifications(updated);

      // 2. Handle Action based on type
      if (notification.type === 'BACKUP') {
          handleExcelExport();
      }
      // Can add other click handlers here (e.g. navigate to task)
  };

  const handleCreateProject = async (name: string, desc: string) => {
      const updated = await createProject(name, desc);
      setProjects(updated);
      showToast(t.dataSaved);
  };

  const handleUpdateProject = async (updatedProject: Project) => {
      await updateProject(updatedProject);
      const newProjects = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
      setProjects(newProjects);
      showToast(t.dataSaved);
  };

  const handleDuplicateProject = async (projectId: string) => {
      const updated = await duplicateProject(projectId, t.copySuffix);
      setProjects(updated);
      showToast(t.dataSaved);
  }

  const handleDeleteProject = async (projectId: string) => {
      if (!projectId) return;
      // deleteProject is now "soft delete" in supabaseService
      const updated = await deleteProject(projectId);
      setProjects(updated);
      showToast(t.recycleBinMsg);
  };

  // Permanently delete
  const handleHardDeleteProject = async (projectId: string) => {
      if (!projectId) return;
      const updated = await hardDeleteProject(projectId);
      setProjects(updated);
  };

  // New handler for Suspend/Restore
  const handleUpdateProjectStatus = async (projectId: string, status: ProjectStatus) => {
      if (!projectId) return;
      const updated = await setProjectStatus(projectId, status);
      setProjects(updated);
  };
  
  const handleAddMilestone = async (projectId: string, milestone: Milestone) => {
      const updated = await addMilestone(projectId, milestone);
      setProjects(updated);
  };

  const handleUpdateMilestone = async (projectId: string, milestone: Milestone) => {
      const updated = await updateMilestone(projectId, milestone);
      setProjects(updated);
  };

  const handleDeleteMilestone = async (projectId: string, milestoneId: string) => {
      const updated = await deleteMilestone(projectId, milestoneId);
      setProjects(updated);
  };

  // --- Excel Database Functions ---
  const handleExcelExport = () => {
      exportToExcelDB(projects);
      showToast("Excel DB Exported");
  };

  const handleDataImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          let result: { projects: Project[], settings?: AppSettings } | null = null;
          
          try {
            if (file.name.toLowerCase().endsWith('.xlsx')) {
                result = await importFromExcelDB(file);
            } else if (file.name.toLowerCase().endsWith('.json')) {
                result = await importData(file);
            } else {
                alert("Unsupported file type. Please upload .xlsx or .json");
                return;
            }

            if (result) {
                setProjects(result.projects);
                await saveProjects(result.projects);
                
                if (result.settings) {
                    await saveSettings(result.settings);
                    if (result.settings.userName) setUserName(result.settings.userName);
                }
                showToast(t.dataImported);
            } else {
                alert(t.importError);
            }
          } catch (err) {
              console.error(err);
              alert(t.importError);
          }
          
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  // Modal Actions for Recycle Bin
  const initiateBinAction = (id: string, type: 'RESTORE' | 'HARD_DELETE') => {
      setConfirmBinAction({ id, type });
  };

  const executeBinAction = () => {
      if (!confirmBinAction) return;
      
      if (confirmBinAction.type === 'RESTORE') {
          handleUpdateProjectStatus(confirmBinAction.id, ProjectStatus.ACTIVE);
      } else if (confirmBinAction.type === 'HARD_DELETE') {
          handleHardDeleteProject(confirmBinAction.id);
      }
      setConfirmBinAction(null);
  };

  const renderContent = () => {
    switch (viewState.type) {
      case 'DASHBOARD':
        return (
          <Dashboard 
            projects={projects} 
            onSelectProject={(id) => setViewState({ type: 'PROJECT_DETAIL', projectId: id })}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onCreateProject={handleCreateProject}
            onDuplicateProject={handleDuplicateProject}
            onDeleteProject={handleDeleteProject}
            onUpdateProjectStatus={handleUpdateProjectStatus}
            onViewAllTasks={(filter) => setViewState({ type: 'GLOBAL_TASK_LIST', filter })}
            onUpdateMilestone={handleUpdateMilestone}
            onExportExcel={handleExcelExport}
          />
        );
      
      case 'CALENDAR':
        return (
          <CalendarView 
            projects={projects}
            onSelectTask={(projectId, taskId) => setViewState({ type: 'TASK_DETAIL', projectId, taskId })}
          />
        );
      
      case 'SETTINGS':
        return (
            <SettingsPage 
                onBack={() => setViewState({ type: 'DASHBOARD' })} 
                onImport={triggerImport}
                onSetupBackup={setBackupDirHandle}
                isBackupEnabled={!!backupDirHandle || !!(window.electron && backupPath)}
            />
        );

      case 'GLOBAL_TASK_LIST':
        return (
            <GlobalTaskList 
                projects={projects}
                initialFilter={viewState.filter}
                onBack={() => setViewState({ type: 'DASHBOARD' })}
                onSelectTask={(projectId, taskId) => setViewState({ type: 'TASK_DETAIL', projectId, taskId })}
                onUpdateTaskStatus={handleUpdateTaskStatus}
            />
        );

      case 'PROJECT_DETAIL': {
        const project = projects.find(p => p.id === viewState.projectId);
        if (!project) return <div className="p-8 text-center text-slate-500">{t.unknownProject}</div>;
        return (
          <ProjectDetail 
            project={project}
            onBack={() => setViewState({ type: 'DASHBOARD' })}
            onSelectTask={(taskId) => setViewState({ type: 'TASK_DETAIL', projectId: project.id, taskId })}
            onAddTask={() => setViewState({ type: 'TASK_DETAIL', projectId: project.id, taskId: 'new' })}
            onUpdateTaskStatus={(taskId, status) => handleUpdateTaskStatus(project.id, taskId, status)}
            onUpdateProject={handleUpdateProject}
            onAddMilestone={(milestone) => handleAddMilestone(project.id, milestone)}
            onUpdateMilestone={(milestone) => handleUpdateMilestone(project.id, milestone)}
            onDeleteMilestone={(milestoneId) => handleDeleteMilestone(project.id, milestoneId)}
          />
        );
      }

      case 'TASK_DETAIL': {
        const project = projects.find(p => p.id === viewState.projectId);
        if (!project) return <div className="p-8 text-center text-slate-500">{t.unknownProject}</div>;
        const task = viewState.taskId === 'new' 
            ? null 
            : project.tasks.find(t => t.id === viewState.taskId) || null;

        return (
            <TaskDetail 
                task={task}
                projectId={project.id}
                onBack={() => setViewState({ type: 'PROJECT_DETAIL', projectId: project.id })}
                onSave={handleCreateTask}
                onDelete={(id) => handleDeleteTask(id, project.id)}
            />
        );
      }
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading data from Supabase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans" onClick={() => { setShowNotifications(false); setShowProfileMenu(false); }}>
      
      {/* Toast Notification */}
      {toastMsg && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
              <div className="bg-slate-800 text-white px-6 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center">
                  <CheckCircle size={16} className="text-green-400 mr-2" />
                  {toastMsg}
              </div>
          </div>
      )}

      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer gap-8">
                <div className="flex items-center gap-2" onClick={() => setViewState({ type: 'DASHBOARD' })}>
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
                        P
                    </div>
                    <span className="font-bold text-xl tracking-tight text-slate-800">{t.appTitle}</span>
                </div>
                
                {/* Desktop Nav */}
                <div className="hidden md:flex space-x-4">
                     <button 
                        onClick={() => setViewState({ type: 'DASHBOARD' })}
                        className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewState.type === 'DASHBOARD' ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
                     >
                        <Layout size={18} className="mr-2" />
                        {t.dashboard}
                     </button>
                     <button 
                        onClick={() => setViewState({ type: 'CALENDAR' })}
                        className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewState.type === 'CALENDAR' ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
                     >
                        <Calendar size={18} className="mr-2" />
                        {t.calendar}
                     </button>
                </div>
            </div>
            
            <div className="flex items-center space-x-4 md:space-x-6">

                {/* Database Tools */}
                <div className="flex items-center border-r border-slate-200 pr-4 mr-2 space-x-1 md:space-x-2">
                    <button 
                        onClick={exportData}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-1"
                        title="Export Data (JSON)"
                    >
                        <Database size={20} />
                        <Download size={12} />
                    </button>
                    <button 
                        onClick={triggerImport}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-1"
                        title="Import from Excel/JSON Database"
                    >
                         <Database size={20} />
                         <Upload size={12} />
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.json" onChange={handleDataImport} />
                    
                    <div className="w-px h-6 bg-slate-200 mx-2"></div>
                    
                    <button 
                        onClick={() => setShowRecycleBin(true)}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors relative group"
                        title={t.recycleBin}
                    >
                        <Trash2 size={20} />
                        {trashedProjects.length > 0 && (
                            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-1 ring-white"></span>
                        )}
                    </button>
                </div>

                {/* Language Switcher */}
                <button 
                    onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                    className="flex items-center text-slate-500 hover:text-blue-600 transition-colors p-1 rounded-md hover:bg-slate-100"
                    title="Switch Language"
                >
                    <Globe size={20} className="mr-1" />
                    <span className="text-sm font-medium uppercase">{language}</span>
                </button>

               <div className="relative" onClick={(e) => e.stopPropagation()}>
                   <button 
                      className="text-slate-500 hover:text-slate-700 relative p-1 rounded-full hover:bg-slate-100 transition-colors"
                      onClick={() => setShowNotifications(!showNotifications)}
                   >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"></span>
                        )}
                   </button>
                   
                   {showNotifications && (
                       <NotificationList 
                          notifications={notifications} 
                          onMarkRead={handleNotificationClick}
                          onClose={() => setShowNotifications(false)}
                        />
                   )}
               </div>

                {/* User Profile Dropdown */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                   <button
                        onClick={() => setShowProfileMenu(!showProfileMenu)} 
                        className="h-8 w-8 bg-slate-200 hover:bg-slate-300 rounded-full flex items-center justify-center text-slate-500 font-bold border border-slate-300 transition-colors"
                   >
                        {getInitials(userName)}
                   </button>
                   
                   {showProfileMenu && (
                       <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 animate-fade-in overflow-hidden">
                           <div className="p-4 border-b border-slate-100 bg-slate-50">
                               <p className="text-xs text-slate-500 font-medium uppercase mb-1">{t.userProfile}</p>
                               <p className="text-sm text-slate-700 font-medium truncate">{currentUser?.name || 'User'}</p>
                               {isEditingName ? (
                                   <div className="flex gap-2 mt-2">
                                       <input 
                                           autoFocus
                                           className="w-full text-sm border border-blue-300 rounded px-2 py-1 outline-none bg-white text-slate-800"
                                           value={tempName}
                                           onChange={(e) => setTempName(e.target.value)}
                                           onKeyDown={(e) => e.key === 'Enter' && saveUserName()}
                                           placeholder="Name"
                                       />
                                       <button onClick={saveUserName} className="text-green-600"><CheckCircle size={16}/></button>
                                   </div>
                               ) : (
                                   <div className="flex justify-between items-center group mt-1">
                                       <p className="text-xs text-slate-500 truncate">昵称: {userName}</p>
                                       <button 
                                           onClick={() => { setIsEditingName(true); setTempName(userName); }}
                                           className="text-slate-400 hover:text-blue-600"
                                        >
                                           <Edit2 size={12} />
                                       </button>
                                   </div>
                               )}
                           </div>
                           <div className="p-2">
                               {currentUser?.role === 'admin' && (
                                    <button 
                                         onClick={() => { setShowAdminPanel(true); setShowProfileMenu(false); }}
                                         className="w-full flex items-center px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                     >
                                         <Shield size={16} className="mr-2" />
                                         人员管理
                                     </button>
                               )}
                               <button 
                                    onClick={() => { setShowPasswordChange(true); setShowProfileMenu(false); }}
                                    className="w-full flex items-center px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                >
                                    <Key size={16} className="mr-2" />
                                    修改密码
                                </button>
                                <button 
                                    onClick={() => { setViewState({ type: 'SETTINGS' }); setShowProfileMenu(false); }}
                                    className="w-full flex items-center px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors"
                                >
                                    <Settings size={16} className="mr-2" />
                                    {t.settings}
                                </button>
                                <button 
                                    onClick={handleLogout}
                                    className="w-full flex items-center px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <LogOut size={16} className="mr-2" />
                                    {t.signOut}
                                </button>
                           </div>
                       </div>
                   )}
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>

      {/* Recycle Bin Modal (Global) */}
      {showRecycleBin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in p-4">
             <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[80vh] flex flex-col">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-red-50">
                    <h3 className="font-bold text-red-800 flex items-center">
                        <Trash2 className="mr-2 text-red-600" size={20} />
                        {t.recycleBin}
                    </h3>
                    <button type="button" onClick={() => setShowRecycleBin(false)} className="text-red-400 hover:text-red-600">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1 bg-slate-50/50">
                    <div className="mb-4 text-xs text-slate-500 bg-white p-3 rounded border border-slate-200">
                        {t.recycleBinDesc}
                    </div>

                    <div className="space-y-3">
                        {trashedProjects.length === 0 ? (
                             <div className="text-center py-12 text-slate-400">
                                 <Trash2 size={40} className="mx-auto mb-3 opacity-20" />
                                 <p>{t.emptyRecycleBin}</p>
                             </div>
                        ) : trashedProjects.map(p => {
                            const isConfirming = confirmBinAction?.id === p.id;
                            
                            return (
                                <div key={p.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
                                    <div className="flex-1 opacity-75">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-slate-800 text-lg line-through decoration-slate-400">{p.name}</h4>
                                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-red-200">
                                                {t.statusTrashed}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 line-clamp-1">{p.description}</p>
                                        <p className="text-[10px] text-slate-400 mt-1">Deleted: {p.deletedAt ? new Date(p.deletedAt).toLocaleDateString() : 'Unknown'}</p>
                                    </div>

                                    {/* Action Area */}
                                    <div className="flex items-center gap-2">
                                        {isConfirming ? (
                                             <div className="flex items-center gap-2 bg-red-50 p-1.5 rounded-lg border border-red-100 animate-fade-in">
                                                <AlertTriangle size={16} className="text-red-500 ml-1" />
                                                <span className="text-xs font-bold text-red-700 mr-2">
                                                    {confirmBinAction.type === 'HARD_DELETE' ? t.confirmPermanentDelete : 'Restore?'}
                                                </span>
                                                <button 
                                                    type="button"
                                                    onClick={executeBinAction}
                                                    className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded shadow-sm hover:bg-red-700 transition-colors"
                                                >
                                                    Yes
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => setConfirmBinAction(null)}
                                                    className="px-3 py-1 bg-white text-slate-600 border border-slate-200 text-xs font-bold rounded hover:bg-slate-50 transition-colors"
                                                >
                                                    No
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button 
                                                    type="button"
                                                    onClick={() => initiateBinAction(p.id, 'RESTORE')}
                                                    className="flex items-center px-3 py-2 text-green-600 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    <RefreshCw size={14} className="mr-1.5 pointer-events-none" /> {t.restoreProject}
                                                </button>
                                                
                                                <button 
                                                    type="button"
                                                    onClick={() => initiateBinAction(p.id, 'HARD_DELETE')}
                                                    className="flex items-center px-3 py-2 text-red-600 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    <Trash2 size={14} className="mr-1.5 pointer-events-none" /> {t.deletePermanently}
                                                </button>
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

      {/* Admin Panel Modal */}
      {showAdminPanel && currentUser?.role === 'admin' && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} onUpdateCurrentUser={handleUpdateCurrentUser} />
      )}

      {/* Password Change Modal */}
      {showPasswordChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">修改密码</h3>
              <button onClick={() => { setShowPasswordChange(false); setOldPassword(''); setNewPassword(''); setPasswordMsg(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            {passwordMsg && (
              <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${passwordMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {passwordMsg.msg}
              </div>
            )}
            <div className="space-y-3">
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="输入原密码"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="输入新密码（至少6位）"
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordChange()}
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowPasswordChange(false); setOldPassword(''); setNewPassword(''); setPasswordMsg(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handlePasswordChange}
                disabled={oldPassword.length < 1 || newPassword.length < 6}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                确认修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

export default App;
