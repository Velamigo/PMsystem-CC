
import React, { useState, useMemo } from 'react';
import { Project } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface CalendarViewProps {
  projects: Project[];
  onSelectTask: (projectId: string, taskId: string) => void;
}

type ViewType = 'MONTH' | 'WEEK';

// Copied consistency logic from Dashboard to ensure same colors for same projects
const PROJECT_THEMES = [
  { pill: 'bg-blue-100 text-blue-800 border-blue-200', text: 'text-blue-900' },
  { pill: 'bg-emerald-100 text-emerald-800 border-emerald-200', text: 'text-emerald-900' },
  { pill: 'bg-amber-100 text-amber-800 border-amber-200', text: 'text-amber-900' },
  { pill: 'bg-purple-100 text-purple-800 border-purple-200', text: 'text-purple-900' },
  { pill: 'bg-rose-100 text-rose-800 border-rose-200', text: 'text-rose-900' },
  { pill: 'bg-cyan-100 text-cyan-800 border-cyan-200', text: 'text-cyan-900' },
  { pill: 'bg-indigo-100 text-indigo-800 border-indigo-200', text: 'text-indigo-900' },
  { pill: 'bg-orange-100 text-orange-800 border-orange-200', text: 'text-orange-900' },
];

const getProjectTheme = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PROJECT_THEMES.length;
  return PROJECT_THEMES[index];
};

export const CalendarView: React.FC<CalendarViewProps> = ({ projects, onSelectTask }) => {
  const { t } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>('MONTH');

  // Helper to normalize date for comparison
  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const events = useMemo(() => {
    const items: Array<{
      id: string;
      projectId: string; // for navigation
      projectName: string;
      title: string;
      date: Date;
      type: 'TASK' | 'MILESTONE';
      color: string;
    }> = [];

    projects.forEach(p => {
      const theme = getProjectTheme(p.id);

      p.tasks.forEach(t => {
        items.push({
          id: t.id,
          projectId: p.id,
          projectName: p.name,
          title: t.title,
          date: new Date(t.dueDate),
          type: 'TASK',
          color: theme.pill
        });
      });
      p.milestones.forEach(m => {
        items.push({
          id: m.id,
          projectId: p.id,
          projectName: p.name,
          title: m.title,
          date: new Date(m.date),
          type: 'MILESTONE',
          color: 'bg-slate-100 text-slate-800 border-slate-200' // Milestones keep neutral or gold color
        });
      });
    });
    return items;
  }, [projects]);

  const renderCalendarGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Determine start and end dates for the grid
    let startDate: Date, endDate: Date;
    
    if (viewType === 'MONTH') {
      const firstDayOfMonth = new Date(year, month, 1);
      // Monday Start Logic:
      // JS getDay(): Sun=0, Mon=1 ... Sat=6
      // We want Mon=0 ... Sun=6
      // Formula: (day + 6) % 7
      const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
      
      startDate = new Date(year, month, 1 - startingDayOfWeek);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 41); // 6 weeks * 7 days = 42 cells
    } else {
      // Week view (Starts on Monday)
      const currentDayOfWeek = (currentDate.getDay() + 6) % 7;
      startDate = new Date(currentDate);
      startDate.setDate(currentDate.getDate() - currentDayOfWeek);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    }

    const days = [];
    let day = new Date(startDate);

    while (day <= endDate) {
      days.push(new Date(day));
      day.setDate(day.getDate() + 1);
    }

    // Monday Start Header
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header Days */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {weekDays.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>
        
        {/* Days Grid */}
        <div className={`grid grid-cols-7 ${viewType === 'MONTH' ? 'auto-rows-[120px]' : 'auto-rows-[400px]'}`}>
          {days.map((d, idx) => {
            const isToday = isSameDay(d, new Date());
            const isCurrentMonth = d.getMonth() === month;
            const dayEvents = events.filter(e => isSameDay(e.date, d));

            return (
              <div 
                key={idx} 
                className={`border-b border-r border-slate-100 p-2 relative group hover:bg-slate-50 transition-colors ${!isCurrentMonth && viewType === 'MONTH' ? 'bg-slate-50/50 text-slate-400' : 'bg-white'}`}
              >
                <div className={`text-sm font-medium mb-1 ${isToday ? 'bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : 'text-slate-700'}`}>
                  {d.getDate()}
                </div>
                
                <div className="space-y-1 overflow-y-auto max-h-[90px]">
                  {dayEvents.map(event => (
                    <button
                      key={`${event.type}-${event.id}`}
                      onClick={() => event.type === 'TASK' && onSelectTask(event.projectId, event.id)}
                      className={`w-full text-left px-2 py-1 rounded text-[10px] font-medium border truncate transition-opacity hover:opacity-80 ${event.color} ${event.type === 'TASK' ? 'cursor-pointer' : 'cursor-default'}`}
                      title={`${event.projectName}: ${event.title}`}
                    >
                      {event.type === 'MILESTONE' && '★ '}
                      {event.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">{t.calendar}</h1>
        </div>
        
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <div className="flex bg-white rounded-lg border border-slate-200 p-1">
            <button 
              onClick={() => setViewType('MONTH')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewType === 'MONTH' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t.month}
            </button>
            <button 
              onClick={() => setViewType('WEEK')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewType === 'WEEK' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t.week}
            </button>
          </div>
          
          <div className="flex items-center bg-white rounded-lg border border-slate-200 p-1">
            <button 
              onClick={() => {
                const newDate = new Date(currentDate);
                viewType === 'MONTH' ? newDate.setMonth(newDate.getMonth() - 1) : newDate.setDate(newDate.getDate() - 7);
                setCurrentDate(newDate);
              }}
              className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="w-40 text-center text-sm font-bold text-slate-700">
              {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
            <button 
              onClick={() => {
                const newDate = new Date(currentDate);
                viewType === 'MONTH' ? newDate.setMonth(newDate.getMonth() + 1) : newDate.setDate(newDate.getDate() + 7);
                setCurrentDate(newDate);
              }}
              className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {renderCalendarGrid()}
    </div>
  );
};
