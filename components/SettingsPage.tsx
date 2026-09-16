
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Tag, User, Users, Database, FileDown, FileUp, FolderOpen, ToggleRight, ToggleLeft, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getSettings, saveSettings, exportData } from '../services/storageService';
import { AppSettings } from '../types';

interface SettingsPageProps {
    onBack: () => void;
    onImport: () => void;
    onSetupBackup?: (handle: any) => void;
    isBackupEnabled?: boolean;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack, onImport, onSetupBackup, isBackupEnabled = false }) => {
    const { t } = useLanguage();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [localBackupEnabled, setLocalBackupEnabled] = useState(isBackupEnabled);
    const [backupError, setBackupError] = useState<string | null>(null);
    const [electronPath, setElectronPath] = useState<string | null>(null);
    const [fileSystemApiSupported, setFileSystemApiSupported] = useState(true);

    // Temp states for new items
    const [newTag, setNewTag] = useState('');
    const [newAssignee, setNewAssignee] = useState('');
    const [newRequester, setNewRequester] = useState('');

    useEffect(() => {
        const currentSettings = getSettings();
        setSettings(currentSettings);
        if (window.electron && currentSettings.backupPath) {
            setElectronPath(currentSettings.backupPath);
            setLocalBackupEnabled(true);
        }
        
        // Check for File System Access API support
        // @ts-ignore
        if (!window.showDirectoryPicker && !window.electron) {
            setFileSystemApiSupported(false);
        }
    }, []);

    const handleSave = () => {
        if (settings) {
            // Include backup path in persistence
            const settingsToSave = {
                ...settings,
                backupPath: electronPath || undefined
            };
            saveSettings(settingsToSave);
            alert(t.dataSaved);
        }
    };

    const toggleAutoExcelExport = () => {
        if (settings) {
            setSettings({ ...settings, enableAutoExcelExport: !settings.enableAutoExcelExport });
        }
    };

    const addItem = (field: 'commonTags' | 'commonAssignees' | 'commonRequesters', value: string, setter: (v: string) => void) => {
        if (!value.trim() || !settings) return;
        setSettings({
            ...settings,
            [field]: [...settings[field], value.trim()]
        });
        setter('');
    };

    const removeItem = (field: 'commonTags' | 'commonAssignees' | 'commonRequesters', value: string) => {
        if (!settings) return;
        setSettings({
            ...settings,
            [field]: settings[field].filter(item => item !== value)
        });
    };

    const handleSelectBackupFolder = async () => {
        setBackupError(null);

        // 1. Electron Environment Strategy
        if (window.electron) {
            try {
                const path = await window.electron.selectFolder();
                if (path) {
                    setElectronPath(path);
                    setLocalBackupEnabled(true);
                    // Update settings immediately for the parent component to react if needed
                    if (settings) {
                        const newSettings = { ...settings, backupPath: path };
                        setSettings(newSettings);
                        saveSettings(newSettings);
                    }
                }
            } catch (err) {
                console.error("Electron dialog error", err);
                setBackupError("Failed to select folder via system dialog.");
            }
            return;
        }

        // 2. Browser Environment Strategy (File System Access API)
        if (!onSetupBackup) return;
        
        try {
            // @ts-ignore
            if (!window.showDirectoryPicker) {
                 setBackupError("File System Access API not supported in this browser.");
                 return;
            }
            
            // @ts-ignore
            const handle = await window.showDirectoryPicker();
            if (handle) {
                onSetupBackup(handle);
                setLocalBackupEnabled(true);
            }
        } catch (err: any) {
            console.error('Error selecting folder:', err);
            // Iframe blocking error
            if (err.name === 'SecurityError' || (err.message && err.message.includes('Cross origin sub frames'))) {
                setBackupError(t.iframeError);
            } else if (err.name !== 'AbortError') {
                 setBackupError('Failed to access folder: ' + (err.message || 'Unknown error'));
            }
        }
    };

    const toggleBackup = () => {
        if (!localBackupEnabled) {
            handleSelectBackupFolder();
        } else {
             setLocalBackupEnabled(false);
             setElectronPath(null);
             if (settings) {
                 const newSettings = { ...settings, backupPath: undefined };
                 setSettings(newSettings);
                 saveSettings(newSettings);
             }
             if (onSetupBackup) onSetupBackup(null);
             setBackupError(null);
        }
    };

    if (!settings) return null;

    return (
        <div className="animate-fade-in max-w-4xl mx-auto pb-20">
            <button 
                onClick={onBack}
                className="flex items-center text-slate-500 hover:text-slate-800 mb-6 transition-colors"
            >
                <ArrowLeft size={18} className="mr-2" /> {t.backToDashboard}
            </button>

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">{t.settings}</h1>
                    <p className="text-slate-500 mt-2">{t.settingsDesc}</p>
                </div>
                <button 
                    onClick={handleSave}
                    className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-colors"
                >
                    <Save size={18} className="mr-2" /> {t.saveSettings}
                </button>
            </div>

            <div className="space-y-8">
                {/* Data Backup Section */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Database className="text-slate-500" />
                        <h2 className="text-lg font-bold text-slate-800">{t.dataBackup}</h2>
                    </div>
                    
                    <div className="bg-slate-50 rounded-lg p-5 border border-slate-200 mb-4">
                        <p className="text-sm text-slate-600 mb-4 leading-relaxed">{t.autoBackupDesc}</p>
                        
                        <div className="flex flex-col gap-4">
                             {/* Auto Backup Toggle */}
                             <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={handleSelectBackupFolder}
                                        disabled={!fileSystemApiSupported && !window.electron}
                                        className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${localBackupEnabled ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                                    >
                                        <FolderOpen size={16} className="mr-2" />
                                        {localBackupEnabled 
                                            ? (electronPath ? `Save to: ...${electronPath.slice(-20)}` : t.backupFolderSelected) 
                                            : t.selectBackupFolder}
                                    </button>
                                    {localBackupEnabled && <span className="text-xs text-green-600 font-bold flex items-center">● Active</span>}
                                    {!fileSystemApiSupported && !window.electron && <span className="text-xs text-slate-400 italic">(Browser not supported)</span>}
                                </div>
                                <button onClick={toggleBackup} disabled={!fileSystemApiSupported && !window.electron} className="text-blue-600 hover:text-blue-800 transition-colors ml-4 disabled:opacity-50">
                                    {localBackupEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-slate-300" />}
                                </button>
                            </div>

                             {/* Auto Excel Export Toggle (Always enabled, fallback to notification if no folder) */}
                             <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                                        <FileSpreadsheet size={18} />
                                    </div>
                                    <div>
                                        <span className="block text-sm font-medium text-slate-700">Auto Excel Export (Hourly)</span>
                                        <span className="block text-xs text-slate-500">
                                            {localBackupEnabled 
                                                ? "Saves directly to backup folder" 
                                                : "If backup folder is not set, you will receive a notification to download."}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={toggleAutoExcelExport} className="text-blue-600 hover:text-blue-800 transition-colors ml-4">
                                    {settings.enableAutoExcelExport ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-slate-300" />}
                                </button>
                            </div>

                            {/* Error Message for Iframe/API */}
                            {backupError && (
                                <div className="flex items-start text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 animate-fade-in">
                                    <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                                    <span className="text-xs font-medium">{backupError}</span>
                                </div>
                            )}

                            {/* Divider */}
                            <div className="border-t border-slate-200 my-1"></div>

                            {/* Manual Import/Export */}
                            <div className="flex flex-wrap gap-4 items-center">
                                <button 
                                    onClick={exportData}
                                    className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-all shadow-sm"
                                >
                                    <FileDown size={16} className="mr-2" />
                                    {t.exportData}
                                </button>

                                <button 
                                    onClick={onImport}
                                    className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-all shadow-sm"
                                >
                                    <FileUp size={16} className="mr-2" />
                                    {t.importData}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Common Tags */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Tag className="text-indigo-500" />
                        <h2 className="text-lg font-bold text-slate-800">{t.commonTags}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {settings.commonTags.map(tag => (
                            <div key={tag} className="flex items-center bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100">
                                <span className="text-sm font-medium mr-2">{tag}</span>
                                <button onClick={() => removeItem('commonTags', tag)} className="text-indigo-400 hover:text-indigo-700">
                                    <XIcon size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 max-w-md">
                        <input 
                            type="text" 
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addItem('commonTags', newTag, setNewTag)}
                            placeholder={t.itemPlaceholder}
                            className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-slate-800 placeholder-slate-400"
                        />
                        <button 
                            onClick={() => addItem('commonTags', newTag, setNewTag)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            {t.addItem}
                        </button>
                    </div>
                </div>

                {/* Common Assignees */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <User className="text-emerald-500" />
                        <h2 className="text-lg font-bold text-slate-800">{t.commonAssignees}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {settings.commonAssignees.map(name => (
                            <div key={name} className="flex items-center bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100">
                                <span className="text-sm font-medium mr-2">{name}</span>
                                <button onClick={() => removeItem('commonAssignees', name)} className="text-emerald-400 hover:text-emerald-700">
                                    <XIcon size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 max-w-md">
                        <input 
                            type="text" 
                            value={newAssignee}
                            onChange={(e) => setNewAssignee(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addItem('commonAssignees', newAssignee, setNewAssignee)}
                            placeholder={t.itemPlaceholder}
                            className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-slate-800 placeholder-slate-400"
                        />
                        <button 
                            onClick={() => addItem('commonAssignees', newAssignee, setNewAssignee)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            {t.addItem}
                        </button>
                    </div>
                </div>

                {/* Common Requesters */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="text-amber-500" />
                        <h2 className="text-lg font-bold text-slate-800">{t.commonRequesters}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {settings.commonRequesters.map(name => (
                            <div key={name} className="flex items-center bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-100">
                                <span className="text-sm font-medium mr-2">{name}</span>
                                <button onClick={() => removeItem('commonRequesters', name)} className="text-amber-400 hover:text-amber-700">
                                    <XIcon size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 max-w-md">
                        <input 
                            type="text" 
                            value={newRequester}
                            onChange={(e) => setNewRequester(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addItem('commonRequesters', newRequester, setNewRequester)}
                            placeholder={t.itemPlaceholder}
                            className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-slate-800 placeholder-slate-400"
                        />
                        <button 
                            onClick={() => addItem('commonRequesters', newRequester, setNewRequester)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            {t.addItem}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper component for X icon
const XIcon = ({ size }: { size: number }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);
