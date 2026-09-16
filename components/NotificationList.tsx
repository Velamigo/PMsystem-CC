
import React from 'react';
import { AppNotification } from '../types';
import { Bell, Check, Info, UserPlus, Clock, DownloadCloud } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface NotificationListProps {
  notifications: AppNotification[];
  onMarkRead: (notification: AppNotification) => void;
  onClose: () => void;
}

export const NotificationList: React.FC<NotificationListProps> = ({ notifications, onMarkRead, onClose }) => {
  const { t } = useLanguage();

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'DEADLINE': return <Clock size={16} className="text-amber-500" />;
      case 'STATUS_CHANGE': return <Check size={16} className="text-green-500" />;
      case 'ASSIGNMENT': return <UserPlus size={16} className="text-blue-500" />;
      case 'BACKUP': return <DownloadCloud size={16} className="text-purple-500" />;
      default: return <Info size={16} className="text-slate-500" />;
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 animate-fade-in overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="font-bold text-slate-800">{t.notifications}</h3>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-800">{t.close}</button>
      </div>
      
      <div className="max-h-[400px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400 flex flex-col items-center">
            <Bell size={24} className="mb-2 opacity-20" />
            <p className="text-sm">{t.noNotifications}</p>
          </div>
        ) : (
          <div>
            {notifications.map(n => (
              <div 
                key={n.id} 
                className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${n.read ? 'opacity-60' : 'bg-blue-50/30'}`}
                onClick={() => onMarkRead(n)}
              >
                <div className="flex gap-3">
                  <div className="mt-1 flex-shrink-0 bg-white p-1.5 rounded-full shadow-sm border border-slate-100">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                       <p className={`text-sm ${n.read ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}>{n.title}</p>
                       {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                    </div>
                    <p className="text-xs text-slate-500 mb-2 leading-relaxed">{n.message}</p>
                    {n.type === 'BACKUP' && !n.read && (
                        <div className="mb-2 text-xs font-bold text-purple-600">
                            Click to download file
                        </div>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
