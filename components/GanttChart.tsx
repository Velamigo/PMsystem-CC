
import React, { useMemo, useState } from 'react';
import { Task } from '../types';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface GanttChartProps {
    tasks: Task[];
    onTaskClick: (taskId: string) => void;
}

// Helper to parse "YYYY-MM-DD" strictly as local date without timezone shift
const parseLocal = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
};

// Helper to get ISO week number
const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const GanttChart: React.FC<GanttChartProps> = ({ tasks, onTaskClick }) => {
    const { language } = useLanguage();
    const locale = language === 'zh' ? 'zh-CN' : 'en-US';

    // State for zooming (pixels per day). 
    // Range: 2 (Month View) to 60 (Day View)
    const [dayWidth, setDayWidth] = useState(40);
    
    // Determine View Mode
    // >= 24: Day View
    // 8 <= width < 24: Week View
    // < 8: Month View
    let viewMode: 'DAY' | 'WEEK' | 'MONTH' = 'DAY';
    if (dayWidth < 8) viewMode = 'MONTH';
    else if (dayWidth < 24) viewMode = 'WEEK';

    // 1. Calculate time range
    const { minDate, maxDate, totalDays } = useMemo(() => {
        if (tasks.length === 0) {
            const now = new Date();
            // Default to start of current month to end of next month
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 2, 0); 
            const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
            return { minDate: start, maxDate: end, totalDays: Math.ceil(diff) };
        }
        
        let min = parseLocal(tasks[0].startDate).getTime();
        let max = parseLocal(tasks[0].dueDate).getTime();

        tasks.forEach(t => {
            const start = parseLocal(t.startDate).getTime();
            const end = parseLocal(t.dueDate).getTime();
            if (start < min) min = start;
            if (end > max) max = end;
        });

        // Snap to start of the month for cleaner Month View alignment
        const minD = new Date(min);
        minD.setDate(1); 
        
        // Snap to end of the month plus padding
        const maxD = new Date(max);
        maxD.setMonth(maxD.getMonth() + 1);
        maxD.setDate(0); // End of next month

        const diff = (maxD.getTime() - minD.getTime()) / (1000 * 60 * 60 * 24);
        return { minDate: minD, maxDate: maxD, totalDays: Math.ceil(diff) };
    }, [tasks]);

    // 2. Generate all dates
    const dates = useMemo(() => {
        const arr = [];
        const curr = new Date(minDate);
        for(let i=0; i<=totalDays; i++) {
            arr.push(new Date(curr));
            curr.setDate(curr.getDate() + 1);
        }
        return arr;
    }, [minDate, totalDays]);

    // 3. Generate groups
    const months = useMemo(() => {
        const ms: { date: Date, days: number }[] = [];
        if (dates.length === 0) return ms;

        let currentMonth = dates[0].getMonth();
        let count = 0;
        let startDate = dates[0];

        dates.forEach(d => {
            if (d.getMonth() === currentMonth) {
                count++;
            } else {
                ms.push({ date: startDate, days: count });
                currentMonth = d.getMonth();
                startDate = d;
                count = 1;
            }
        });
        if (count > 0) ms.push({ date: startDate, days: count });
        return ms;
    }, [dates]);

    const weeks = useMemo(() => {
        const ws: { date: Date, days: number }[] = [];
        if (dates.length === 0) return ws;

        let count = 0;
        let startDate = dates[0];

        dates.forEach((d, i) => {
            // New week starts on Monday
            if (d.getDay() === 1 && i > 0) {
                ws.push({ date: startDate, days: count });
                startDate = d;
                count = 1;
            } else {
                count++;
            }
        });
        if (count > 0) ws.push({ date: startDate, days: count });
        return ws;
    }, [dates]);

    // Dimensions
    const rowHeight = 44; 
    const headerHeight = 40; 
    const chartWidth = dates.length * dayWidth;
    const chartHeight = Math.max(tasks.length * rowHeight, 200); // Min height for empty state

    const getX = (dateStr: string) => {
        const d = parseLocal(dateStr);
        // Calculate difference in days strictly
        const diffTime = d.getTime() - minDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        return diffDays * dayWidth;
    };

    // Sort tasks for rows by start date
    const sortedTasks = [...tasks].sort((a,b) => parseLocal(a.startDate).getTime() - parseLocal(b.startDate).getTime());
    
    // Map task id to row index for drawing dependency lines
    const taskRowMap = useMemo(() => {
        const map: {[key:string]: number} = {};
        sortedTasks.forEach((t, i) => map[t.id] = i);
        return map;
    }, [sortedTasks]);

    const getViewModeLabel = () => {
        if (language === 'zh') {
            if (viewMode === 'DAY') return '日视图';
            if (viewMode === 'WEEK') return '周视图';
            return '月视图';
        }
        return viewMode + ' VIEW';
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Zoom Controls */}
            <div className="flex justify-between items-center">
                <div className="text-sm font-medium text-slate-500">
                    <span className="mr-2 text-slate-400">Zoom Level:</span>
                    <span className="text-slate-800 font-bold bg-slate-100 px-2 py-1 rounded text-xs">{getViewModeLabel()}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setDayWidth(Math.max(2, dayWidth - 5))} 
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors"
                        title="Zoom Out"
                    >
                        <ZoomOut size={16} />
                    </button>
                    <input 
                        type="range" 
                        min="2" 
                        max="60" 
                        value={dayWidth} 
                        onChange={(e) => setDayWidth(parseInt(e.target.value))} 
                        className="w-32 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <button 
                        onClick={() => setDayWidth(Math.min(60, dayWidth + 5))} 
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors"
                        title="Zoom In"
                    >
                        <ZoomIn size={16} />
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-inner">
                <div style={{ width: chartWidth, minWidth: '100%' }} className="relative">
                    {/* Header */}
                    <div className="flex border-b border-slate-100 bg-slate-50 sticky top-0 z-10 shadow-sm" style={{ height: headerHeight }}>
                        {viewMode === 'DAY' && (
                            // Daily Header
                            dates.map((d, i) => (
                                <div 
                                    key={i} 
                                    className="flex-shrink-0 border-r border-slate-200 text-[10px] text-slate-500 flex flex-col items-center justify-center font-medium bg-slate-50/80 backdrop-blur-sm"
                                    style={{ width: dayWidth }}
                                >
                                    <span className="font-bold text-slate-700">{d.getDate()}</span>
                                    {/* Show month name if wide enough */}
                                    {dayWidth > 35 && (
                                        <span className="text-[9px] text-slate-400 uppercase">
                                            {d.toLocaleDateString(locale, { month: 'short' })}
                                        </span>
                                    )}
                                </div>
                            ))
                        )}
                        
                        {viewMode === 'WEEK' && (
                            // Weekly Header
                            weeks.map((w, i) => {
                                const endDate = new Date(w.date);
                                endDate.setDate(endDate.getDate() + w.days - 1);
                                const weekNum = getWeekNumber(w.date);
                                
                                return (
                                    <div 
                                        key={i} 
                                        className="flex-shrink-0 border-r border-slate-200 text-[10px] text-slate-600 flex flex-col items-center justify-center font-medium bg-slate-50 px-1 text-center leading-tight"
                                        style={{ width: w.days * dayWidth }}
                                    >
                                        <span className="font-bold text-blue-600 mb-0.5">
                                            {language === 'zh' ? `第 ${weekNum} 周` : `Week ${weekNum}`}
                                        </span>
                                        <span className="text-[9px] text-slate-500 block">
                                             {w.date.toLocaleDateString(locale, { month: '2-digit', day: '2-digit' })} - {endDate.toLocaleDateString(locale, { month: '2-digit', day: '2-digit' })}
                                        </span>
                                    </div>
                                );
                            })
                        )}

                        {viewMode === 'MONTH' && (
                             // Monthly Header
                             months.map((m, i) => (
                                <div 
                                    key={i}
                                    className="flex-shrink-0 border-r border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden whitespace-nowrap px-2"
                                    style={{ width: m.days * dayWidth }}
                                >
                                   <div className="flex flex-col items-center justify-center leading-none">
                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                            {m.date.toLocaleDateString(locale, { month: 'short', year: 'numeric' })}
                                        </span>
                                   </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Grid Body */}
                    <div className="relative" style={{ height: chartHeight }}>
                        {/* Background Grid Lines */}
                        <div className="absolute inset-0 flex pointer-events-none">
                            {viewMode === 'DAY' && dates.map((_, i) => (
                                <div key={i} className="border-r border-slate-50 h-full flex-shrink-0" style={{ width: dayWidth }}></div>
                            ))}
                            {viewMode === 'WEEK' && weeks.map((w, i) => (
                                <div key={i} className="border-r border-slate-100 h-full flex-shrink-0" style={{ width: w.days * dayWidth }}></div>
                            ))}
                            {viewMode === 'MONTH' && months.map((m, i) => (
                                <div key={i} className="border-r border-slate-200 h-full flex-shrink-0" style={{ width: m.days * dayWidth }}></div>
                            ))}
                        </div>

                        {/* Dependency Lines (SVG Layer) */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                            {sortedTasks.map(task => 
                                task.dependencies?.map(depId => {
                                    const parentRowIndex = taskRowMap[depId];
                                    const currentRowIndex = taskRowMap[task.id];
                                    
                                    // Only draw if parent exists in this filtered view
                                    if (parentRowIndex === undefined) return null;

                                    const parentTask = sortedTasks.find(t => t.id === depId);
                                    if (!parentTask) return null;

                                    // Coordinates
                                    const startX = getX(parentTask.dueDate) + dayWidth; // End of parent
                                    const startY = (parentRowIndex * rowHeight) + (rowHeight / 2);
                                    
                                    const endX = getX(task.startDate);
                                    const endY = (currentRowIndex * rowHeight) + (rowHeight / 2);

                                    // Logic for lines
                                    const midX = startX + 10;
                                    
                                    return (
                                        <path 
                                            key={`${depId}-${task.id}`}
                                            d={`M ${startX - dayWidth} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`}
                                            fill="none"
                                            stroke="#cbd5e1"
                                            strokeWidth="1.5"
                                            strokeDasharray="3"
                                            markerEnd="url(#arrowhead)"
                                            className="opacity-75"
                                        />
                                    );
                                })
                            )}
                            <defs>
                                <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                    <polygon points="0 0, 6 2, 0 4" fill="#cbd5e1" />
                                </marker>
                            </defs>
                        </svg>

                        {/* Task Bars */}
                        {sortedTasks.map((task, idx) => {
                            const x = getX(task.startDate);
                            // Ensure at least 1 day width if start == due
                            const width = Math.max(getX(task.dueDate) - x + dayWidth, dayWidth); 
                            
                            return (
                                <div 
                                    key={task.id}
                                    className="absolute z-10 group"
                                    style={{
                                        top: idx * rowHeight + 8,
                                        left: x,
                                        width: width - 4, // slight gap
                                        height: rowHeight - 16
                                    }}
                                    onClick={() => onTaskClick(task.id)}
                                >
                                    <div className={`w-full h-full rounded-md shadow-sm border text-[10px] flex items-center px-2 cursor-pointer truncate transition-all hover:scale-[1.01] hover:shadow-md
                                        ${task.status === 'DONE' ? 'bg-green-100 border-green-300 text-green-800' : 
                                        task.status === 'IN_PROGRESS' ? 'bg-blue-100 border-blue-300 text-blue-800' :
                                        'bg-slate-100 border-slate-300 text-slate-700'}
                                    `}>
                                        {/* Show title if width is sufficient */}
                                        {width > 30 ? task.title : ''}
                                    </div>
                                    {/* Tooltip */}
                                    <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-20 whitespace-nowrap pointer-events-none">
                                        <div className="font-bold">{task.title}</div>
                                        <div className="opacity-80 flex items-center gap-2 mt-1">
                                            <span>{task.startDate}</span>
                                            <span>→</span>
                                            <span>{task.dueDate}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
