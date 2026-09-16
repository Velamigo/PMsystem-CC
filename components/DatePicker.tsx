
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface DatePickerProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    className?: string;
    placeholder?: string;
    small?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({ label, value, onChange, required, className, placeholder, small }) => {
    const { language } = useLanguage();
    const [show, setShow] = useState(false);
    const [viewDate, setViewDate] = useState(() => value ? new Date(value) : new Date());
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShow(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (value) {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                setViewDate(d);
            }
        }
    }, [value]);

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const handlePrevMonth = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const handleSelectDate = (day: number) => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const mStr = String(month + 1).padStart(2, '0');
        const dStr = String(day).padStart(2, '0');
        onChange(`${year}-${mStr}-${dStr}`);
        setShow(false);
    };

    const renderCalendar = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        
        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="w-8 h-8"></div>);
        }
        
        const currentSelected = value ? new Date(value) : null;
        const today = new Date();

        for (let d = 1; d <= daysInMonth; d++) {
            const isSelected = currentSelected && currentSelected.getDate() === d && currentSelected.getMonth() === month && currentSelected.getFullYear() === year;
            const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
            
            days.push(
                <button
                    key={d}
                    type="button"
                    onClick={(e) => { e.preventDefault(); handleSelectDate(d); }}
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-all duration-200
                        ${isSelected 
                            ? 'bg-blue-600 text-white font-bold shadow-md scale-110' 
                            : isToday 
                                ? 'text-blue-600 font-bold bg-blue-50 border border-blue-100'
                                : 'text-slate-700 hover:bg-slate-100 hover:text-blue-600'
                        }
                    `}
                >
                    {d}
                </button>
            );
        }
        return days;
    };

    const weekDays = language === 'zh' 
        ? ['日', '一', '二', '三', '四', '五', '六']
        : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const monthNames = language === 'zh'
        ? ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
        : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Dynamic classes based on 'small' prop
    const inputClasses = small 
        ? "w-full bg-white border border-slate-300 rounded-lg py-1.5 pl-8 pr-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-slate-700 font-medium group-hover:border-blue-400 transition-colors h-[34px]"
        : "w-full bg-white border border-slate-300 rounded-lg px-4 py-2 pl-10 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-slate-700 font-medium group-hover:border-blue-400 transition-colors";

    const iconSize = small ? 14 : 18;
    const iconPos = small ? "left-2.5" : "left-3";

    return (
        <div className={`relative ${className || ''}`} ref={containerRef}>
            {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
            <div 
                className="relative cursor-pointer group"
                onClick={() => setShow(!show)}
            >
                <input
                    type="text"
                    readOnly
                    required={required}
                    value={value}
                    className={inputClasses}
                    placeholder={placeholder || "YYYY-MM-DD"}
                />
                <Calendar size={iconSize} className={`absolute ${iconPos} top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors`} />
            </div>

            {show && (
                <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-[60] w-72 animate-fade-in origin-top-right">
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition-colors"><ChevronLeft size={20}/></button>
                        <span className="font-bold text-slate-800 text-sm">
                            {language === 'zh' 
                                ? `${viewDate.getFullYear()}年 ${monthNames[viewDate.getMonth()]}` 
                                : `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`
                            }
                        </span>
                        <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition-colors"><ChevronRight size={20}/></button>
                    </div>
                    
                    <div className="grid grid-cols-7 mb-2">
                        {weekDays.map(d => (
                            <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase">{d}</div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1 justify-items-center">
                        {renderCalendar()}
                    </div>
                </div>
            )}
        </div>
    );
};