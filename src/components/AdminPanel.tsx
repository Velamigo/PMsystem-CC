import { useState, useEffect } from 'react';
import { getPendingUsers, approveUser, rejectUser, getAllUsers, type User } from '../services/auth';

interface AdminPanelProps {
  onClose: () => void;
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [pending, all] = await Promise.all([
      getPendingUsers(),
      getAllUsers(),
    ]);
    setPendingUsers(pending);
    setAllUsers(all);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (userId: string) => {
    const success = await approveUser(userId);
    if (success) {
      await loadData();
    }
  };

  const handleReject = async (userId: string) => {
    const success = await rejectUser(userId);
    if (success) {
      await loadData();
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      approved: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      rejected: 'bg-red-100 text-red-700',
    };
    const labels = {
      approved: '已通过',
      pending: '待审批',
      rejected: '已拒绝',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
        {role === 'admin' ? '管理员' : '用户'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">用户管理</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-3 font-medium ${activeTab === 'pending' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            待审批 ({pendingUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-3 font-medium ${activeTab === 'all' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            所有用户 ({allUsers.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : activeTab === 'pending' ? (
            pendingUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">暂无待审批用户</div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">
                        注册于 {new Date(user.created_at).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(user.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                      >
                        通过
                      </button>
                      <button
                        onClick={() => handleReject(user.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-3">
              {allUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">
                      注册于 {new Date(user.created_at).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getRoleBadge(user.role)}
                    {getStatusBadge(user.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
