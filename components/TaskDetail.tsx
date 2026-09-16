
import React, { useState, useRef, useEffect } from 'react';
import { Task, Subtask, TaskStatus, TaskPriority, AppSettings } from '../types';
import { ArrowLeft, Save, Trash2, Plus, X, CheckSquare, Square, Tag, GitMerge, Calendar, ChevronDown, AlertTriangle, Check, History, User } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getProjects, getSettings } from '../services/storageService';
import { DatePicker } from './DatePicker';

interface TaskDetailProps {
  task: Task | null; // Null means new task
  projectId: string;
  onBack: () => void;
  onSave: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

type TaskType = 'NORMAL' | 'DEPENDENT';

// Custom Select Component for cleaner look
interface CustomSelectProps {
    label: string;
    value: string;
    options: { label: string; value: string }[];
    onChange: (value: string) => void;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ label, value, options, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => o.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between bg-white border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium transition-shadow"
            >
                <span className="truncate">{selectedOption?.label || value}</span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden animate-fade-in">
                    <div className="max-h-60 overflow-y-auto py-1">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors ${
                                    opt.value === value 
                                    ? 'bg-blue-600 text-white' 
                                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                                }`}
                            >
                                {opt.label}
                                {opt.value === value && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Custom Combobox Component for Assignee/Requester
const Combobox = ({ 
    label, 
    value, 
    onChange, 
    options, 
    placeholder,
    compact = false
}: { 
    label?: string, 
    value: string, 
    onChange: (val: string) => void, 
    options: string[], 
    placeholder: string,
    compact?: boolean
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [filteredOptions, setFilteredOptions] = useState(options);

    useEffect(() => {
        setFilteredOptions(options.filter(opt => opt.toLowerCase().includes(value.toLowerCase())));
    }, [value, options]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    return (
        <div className="relative w-full" ref={wrapperRef}>
            {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
            <div className="relative">
                <input 
                    type="text" 
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    className={`w-full bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 pr-8 text-slate-800 ${compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'}`}
                    placeholder={placeholder}
                />
                <button 
                    type="button"
                    tabIndex={-1}
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                    <ChevronDown size={14} />
                </button>
            </div>
            
            {isOpen && filteredOptions.length > 0 && (
                <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                    {filteredOptions.map((opt, idx) => (
                        <li 
                            key={idx}
                            onClick={() => {
                                onChange(opt);
                                setIsOpen(false);
                            }}
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-slate-700"
                        >
                            {opt}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export const TaskDetail: React.FC<TaskDetailProps> = ({ task, projectId, onBack, onSave, onDelete }) => {
  const { t } = useLanguage();
  const [taskType, setTaskType] = useState<TaskType>(task && task.dependencies.length > 0 ? 'DEPENDENT' : 'NORMAL');
  
  // Confirmation state for deleting task
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState<Task>({
    id: task?.id || (crypto as any).randomUUID(),
    projectId: projectId,
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || TaskStatus.TODO,
    priority: task?.priority || TaskPriority.MEDIUM,
    tags: task?.tags || [],
    startDate: task?.startDate || new Date().toISOString().split('T')[0],
    dueDate: task?.dueDate || new Date().toISOString().split('T')[0],
    assignee: task?.assignee || '',
    requester: task?.requester || '',
    dependencies: task?.dependencies || [],
    subtasks: task?.subtasks || [],
    createdAt: task?.createdAt || new Date().toISOString(),
  });

  // New Subtask Inputs
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState('');
  const [newSubtaskDate, setNewSubtaskDate] = useState('');
  
  const [newTag, setNewTag] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Load other tasks & Settings
  useEffect(() => {
    window.scrollTo(0, 0);
    const allProjects = getProjects();
    const currentProject = allProjects.find(p => p.id === projectId);
    if (currentProject) {
        setProjectTasks(currentProject.tasks.filter(t => t.id !== formData.id));
    }
    setSettings(getSettings());
  }, [projectId, formData.id]);

  // Auto-resize textarea
  useEffect(() => {
      if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      }
  }, [formData.description]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePredecessorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const predId = e.target.value;
      if (!predId) {
          setFormData({ ...formData, dependencies: [] });
          return;
      }

      const predecessor = projectTasks.find(pt => pt.id === predId);
      if (predecessor) {
          const predEnd = new Date(predecessor.dueDate);
          const newStart = new Date(predEnd);
          newStart.setDate(newStart.getDate() + 1);
          
          const currentStart = new Date(formData.startDate);
          const currentEnd = new Date(formData.dueDate);
          let durationDays = 1;
          if (!isNaN(currentStart.getTime()) && !isNaN(currentEnd.getTime())) {
              const durationTime = currentEnd.getTime() - currentStart.getTime();
              durationDays = Math.ceil(durationTime / (1000 * 3600 * 24));
              if (durationDays < 0) durationDays = 1;
          }
          
          const newEnd = new Date(newStart);
          newEnd.setDate(newEnd.getDate() + durationDays);

          setFormData({
              ...formData,
              dependencies: [predId],
              startDate: newStart.toISOString().split('T')[0],
              dueDate: newEnd.toISOString().split('T')[0]
          });
      }
  };

  const handleTaskTypeChange = (type: TaskType) => {
      setTaskType(type);
      if (type === 'NORMAL') {
          setFormData({ ...formData, dependencies: [] });
      }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newSubtask: Subtask = {
      id: (crypto as any).randomUUID(),
      title: newSubtaskTitle,
      completed: false,
      assignee: newSubtaskAssignee,
      dueDate: newSubtaskDate,
      dueDateModifiedCount: 0
    };
    setFormData({ ...formData, subtasks: [...formData.subtasks, newSubtask] });
    setNewSubtaskTitle('');
    setNewSubtaskAssignee('');
    setNewSubtaskDate('');
  };

  const toggleSubtask = (subtaskId: string) => {
    const updatedSubtasks = formData.subtasks.map(st => 
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    setFormData({ ...formData, subtasks: updatedSubtasks });
  };

  const updateSubtaskField = (id: string, field: keyof Subtask, value: any) => {
    setFormData(prev => ({
        ...prev,
        subtasks: prev.subtasks.map(st => {
            if (st.id === id) {
                // If date changes, increment modification count
                if (field === 'dueDate' && st.dueDate !== value) {
                     return { ...st, [field]: value, dueDateModifiedCount: (st.dueDateModifiedCount || 0) + 1 };
                }
                return { ...st, [field]: value };
            }
            return st;
        })
    }));
  };

  const deleteSubtask = (subtaskId: string) => {
    setFormData({ ...formData, subtasks: formData.subtasks.filter(st => st.id !== subtaskId) });
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
        e.preventDefault();
        if (!formData.tags.includes(newTag.trim())) {
            setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
        }
        setNewTag('');
    }
  };
  
  const handleTagInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setNewTag(val);
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  // 2-Step Delete Logic
  const handleDeleteClick = () => {
      if (!isDeleting) {
          setIsDeleting(true);
      } else {
          onDelete(formData.id);
      }
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 sticky top-0 bg-slate-50 py-4 z-20 border-b border-slate-200">
        <button 
          onClick={onBack}
          className="flex items-center text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={20} className="mr-2" /> {t.cancel}
        </button>
        <div className="flex gap-3">
            {task && (
                <button 
                    type="button"
                    onClick={handleDeleteClick}
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors border border-transparent cursor-pointer ${
                        isDeleting 
                        ? 'bg-red-600 text-white hover:bg-red-700' 
                        : 'text-red-500 hover:bg-red-50 hover:border-red-100'
                    }`}
                >
                    {isDeleting ? (
                        <>
                            <AlertTriangle size={18} className="mr-2" /> 
                            {t.deleteConfirm || "Confirm?"}
                        </>
                    ) : (
                        <>
                            <Trash2 size={18} className="mr-2" /> 
                            {t.delete}
                        </>
                    )}
                </button>
            )}
            {isDeleting && (
                <button
                    type="button"
                    onClick={() => setIsDeleting(false)}
                    className="text-slate-400 hover:text-slate-600 px-2"
                >
                    {t.cancel}
                </button>
            )}

            <button 
                type="button"
                onClick={() => onSave(formData)}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-colors cursor-pointer"
            >
                <Save size={18} className="mr-2" /> {t.saveTask}
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-8">
            {/* Title */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.taskTitle}</label>
                <input 
                    type="text" 
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full text-xl font-bold bg-white border-b-2 border-slate-200 focus:border-blue-500 outline-none px-0 py-2 transition-colors placeholder-slate-300 text-slate-800"
                    placeholder={t.enterTitle}
                />
            </div>

            {/* Task Type Toggle */}
            <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <label className="block text-sm font-bold text-slate-700 mb-3">{t.taskType}</label>
                <div className="flex gap-4">
                    <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all flex-1 ${taskType === 'NORMAL' ? 'bg-white border-blue-500 shadow-sm' : 'border-slate-200 hover:bg-white'}`}>
                        <input 
                            type="radio" 
                            name="taskType" 
                            checked={taskType === 'NORMAL'} 
                            onChange={() => handleTaskTypeChange('NORMAL')}
                            className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                        <div className="ml-3">
                            <span className="block text-sm font-medium text-slate-900">{t.typeNormal}</span>
                            <span className="block text-xs text-slate-500">Manual date selection</span>
                        </div>
                    </label>
                    <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all flex-1 ${taskType === 'DEPENDENT' ? 'bg-white border-blue-500 shadow-sm' : 'border-slate-200 hover:bg-white'}`}>
                        <input 
                            type="radio" 
                            name="taskType" 
                            checked={taskType === 'DEPENDENT'} 
                            onChange={() => handleTaskTypeChange('DEPENDENT')}
                            className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                         <div className="ml-3">
                            <span className="block text-sm font-medium text-slate-900">{t.typeDependent}</span>
                            <span className="block text-xs text-slate-500">Calculated from predecessor</span>
                        </div>
                    </label>
                </div>
            </div>

            {/* Dynamic Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                     <CustomSelect 
                        label={t.status}
                        value={formData.status}
                        onChange={(val) => setFormData({...formData, status: val as TaskStatus})}
                        options={[
                            { label: t.todo, value: TaskStatus.TODO },
                            { label: t.inProgress, value: TaskStatus.IN_PROGRESS },
                            { label: t.done, value: TaskStatus.DONE }
                        ]}
                     />
                </div>
                <div>
                     <CustomSelect 
                        label={t.priority}
                        value={formData.priority}
                        onChange={(val) => setFormData({...formData, priority: val as TaskPriority})}
                        options={[
                            { label: t.low, value: TaskPriority.LOW },
                            { label: t.medium, value: TaskPriority.MEDIUM },
                            { label: t.high, value: TaskPriority.HIGH }
                        ]}
                     />
                </div>

                {/* Conditional Logic: Dependent vs Normal */}
                {taskType === 'DEPENDENT' ? (
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-amber-50 p-4 rounded-lg border border-amber-100">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-amber-900 mb-1 flex items-center">
                                <GitMerge size={16} className="mr-2" /> {t.predecessorTask}
                            </label>
                            <div className="relative">
                                <select 
                                    onChange={handlePredecessorChange}
                                    value={formData.dependencies[0] || ''}
                                    className="w-full appearance-none bg-white border border-amber-200 rounded-lg px-4 py-2.5 pr-10 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                                >
                                    <option value="">{t.selectPredecessorPlaceholder}</option>
                                    {projectTasks.length > 0 ? projectTasks.map(pt => (
                                        <option key={pt.id} value={pt.id}>
                                            {pt.title} (End: {pt.dueDate})
                                        </option>
                                    )) : (
                                        <option disabled>No other tasks available</option>
                                    )}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-amber-800 mb-1">{t.startDate}</label>
                             <div className="w-full bg-amber-100/50 border border-amber-200 rounded-lg px-4 py-2 text-slate-500 cursor-not-allowed italic flex items-center">
                                <Calendar size={14} className="mr-2 opacity-50"/> {formData.startDate} 
                                <span className="ml-2 text-xs opacity-70">({t.autoCalculated})</span>
                             </div>
                        </div>
                        <div>
                             <DatePicker 
                                label={t.dueDate}
                                value={formData.dueDate}
                                onChange={(val) => setFormData({...formData, dueDate: val})}
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <div>
                            <DatePicker 
                                label={t.startDate}
                                value={formData.startDate}
                                onChange={(val) => setFormData({...formData, startDate: val})}
                            />
                        </div>
                        <div>
                             <DatePicker 
                                label={t.dueDate}
                                value={formData.dueDate}
                                onChange={(val) => setFormData({...formData, dueDate: val})}
                            />
                        </div>
                    </>
                )}

                {/* New Custom Comboboxes */}
                <Combobox 
                    label={t.assignee}
                    value={formData.assignee}
                    onChange={(val) => setFormData({...formData, assignee: val})}
                    options={settings?.commonAssignees || []}
                    placeholder={t.assigneePlaceholder}
                />
                 <Combobox 
                    label={t.requester}
                    value={formData.requester || ''}
                    onChange={(val) => setFormData({...formData, requester: val})}
                    options={settings?.commonRequesters || []}
                    placeholder={t.requesterPlaceholder}
                />
            </div>

            {/* Tags */}
            <div className="mb-6">
                 <label className="block text-sm font-medium text-slate-700 mb-2">{t.tags}</label>
                 <div className="flex flex-wrap gap-2 mb-2">
                    {formData.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                            {tag}
                            <button onClick={() => removeTag(tag)} className="ml-1.5 text-indigo-500 hover:text-indigo-900"><X size={12} /></button>
                        </span>
                    ))}
                 </div>
                 <div className="flex items-center border border-slate-300 rounded-lg bg-white px-3 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                    <Tag size={16} className="text-slate-400 mr-2" />
                    <input 
                        type="text" 
                        value={newTag}
                        list="tags-list"
                        onChange={handleTagInput}
                        onKeyDown={handleAddTag}
                        placeholder={t.addTagPlaceholder}
                        className="flex-1 bg-transparent py-2 outline-none text-sm text-slate-800"
                    />
                     <datalist id="tags-list">
                        {settings?.commonTags.map(tag => <option key={tag} value={tag} />)}
                    </datalist>
                 </div>
            </div>

            <div className="mb-6">
                <div className="flex justify-between items-center mb-1">
                     <label className="block text-sm font-medium text-slate-700">{t.description}</label>
                </div>
                <textarea 
                    ref={textareaRef}
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden text-slate-800"
                    placeholder={t.descPlaceholder}
                    style={{ minHeight: '100px' }}
                />
            </div>

            <hr className="my-8 border-slate-100" />

            {/* Subtasks Section */}
            <div>
                <div className="flex justify-between items-end mb-4">
                    <h3 className="text-lg font-bold text-slate-800">{t.subtasks}</h3>
                </div>
                
                <div className="space-y-3 mb-6">
                    {formData.subtasks.map(st => (
                        <div key={st.id} className="group bg-slate-50 p-3 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors">
                            <div className="flex items-center gap-3">
                                {/* Checkbox */}
                                <button onClick={() => toggleSubtask(st.id)} className="text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0">
                                    {st.completed ? <CheckSquare size={20} className="text-green-500" /> : <Square size={20} />}
                                </button>
                                
                                <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                                    {/* Title */}
                                    <p className={`text-sm font-medium text-slate-800 flex-1 ${st.completed ? 'line-through text-slate-400' : ''}`}>{st.title}</p>
                                    
                                    {/* Inline Assignee & Date */}
                                    <div className="flex items-center gap-2">
                                        <div className="w-[140px]">
                                             <Combobox 
                                                value={st.assignee || ''}
                                                onChange={(val) => updateSubtaskField(st.id, 'assignee', val)}
                                                options={settings?.commonAssignees || []}
                                                placeholder={t.assignee || "Assignee"}
                                                compact
                                            />
                                        </div>
                                        <div className="relative">
                                            <DatePicker 
                                                value={st.dueDate || ''}
                                                onChange={(val) => updateSubtaskField(st.id, 'dueDate', val)}
                                                small
                                                placeholder={t.dueDate}
                                                className="w-[130px]"
                                            />
                                            {/* Modified Count Badge */}
                                            {st.dueDateModifiedCount && st.dueDateModifiedCount > 0 ? (
                                                <div className="absolute -top-2 -right-2 bg-orange-100 text-orange-700 border border-orange-200 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm" title={`Date changed ${st.dueDateModifiedCount} times`}>
                                                    {st.dueDateModifiedCount}
                                                </div>
                                            ) : null}
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => deleteSubtask(st.id)}
                                            className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 ml-1"
                                            title={t.remove}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {formData.subtasks.length === 0 && (
                        <div className="text-center py-4 text-slate-400 text-sm italic">
                            No subtasks added yet.
                        </div>
                    )}
                </div>

                {/* Add New Subtask Form - Inline */}
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <p className="text-xs font-bold text-blue-800 mb-3 uppercase tracking-wide">Add New Subtask</p>
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                        <input 
                            type="text"
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                            placeholder={t.subtaskPlaceholder}
                            className="flex-1 w-full bg-white border border-blue-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-400 text-slate-800"
                        />
                        
                        <div className="w-full sm:w-[140px]">
                             <Combobox 
                                value={newSubtaskAssignee}
                                onChange={setNewSubtaskAssignee}
                                options={settings?.commonAssignees || []}
                                placeholder={t.assigneePlaceholder}
                                compact
                            />
                        </div>
                        
                        <div className="w-full sm:w-auto">
                             <DatePicker 
                                value={newSubtaskDate}
                                onChange={setNewSubtaskDate}
                                small
                                placeholder={t.dueDate}
                                className="w-full sm:w-auto min-w-[130px]"
                             />
                        </div>

                        <button 
                            type="button"
                            onClick={handleAddSubtask}
                            disabled={!newSubtaskTitle.trim()}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center h-[34px]"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};