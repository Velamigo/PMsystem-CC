import { useState, useEffect } from 'react';
import { getPendingUsers, approveUser, rejectUser, getAllUsers, resetUserPassword, changeUsername, type User } from '../services/auth';
import { Key, User as UserIcon, X, CheckCircle, AlertCircle } from 'lucide-react';

interface AdminPanelProps {
  onClose: () => void;
  onUpdateCurrentUser?: (user: User) => void;
}

export default function AdminPanel({ onClose, onUpdateCurrentUser }: AdminPanelProps) {
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Password reset modal
  const [passwordModal, setPasswordModal] = useState<{ userId: string; userName: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Username change modal
  const [usernameModal, setUsernameModal] = useState<{ userId: string; currentName: string } | null>(null);
  const [newUsername, setNewUsername] = useState('');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

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
      showToast('用户已通过');
    }
  };

  const handleReject = async (userId: string) => {
    const success = await rejectUser(userId);
    if (success) {
      await loadData();
      showToast('用户已拒绝');
    }
  };

  const handleResetPassword = async () => {
    if (!passwordModal || !newPassword.trim()) return;
    const { success, error } = await resetUserPassword(passwordModal.userId, newPassword);
    if (success) {
      showToast(`已重置 ${passwordModal.userName} 的密码`);
      setPasswordModal(null);
      setNewPassword('');
    } else {
      showToast(error || '重置失败', 'error');
    }
  };

  const handleChangeUsername = async () => {
    if (!usernameModal || !newUsername.trim()) return;
    const { success, error } = await changeUsername(usernameModal.userId, newUsername);
    if (success) {
      showToast('用户名已修改');
      setUsernameModal(null);
      setNewUsername('');
      await loadData();
      // If changing own username, update current user
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (currentUser.id === usernameModal.userId && onUpdateCurrentUser) {
        const updatedUser = { ...currentUser, name: newUsername };
        onUpdateCurrentUser(updatedUser);
      }
    } else {
      showToast(error || '修改失败', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      approved: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      rejected: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      approved: '已通过',
      pending: '待审批',
      rejected: '已拒绝',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || ''}`}>
        {labels[status] || status}
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
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className={`px-6 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {toast.msg}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">人员管理</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            <X size={24} />
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
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <UserIcon size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">
                        注册于 {new Date(user.created_at).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getRoleBadge(user.role)}
                    {getStatusBadge(user.status)}
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => { setUsernameModal({ userId: user.id, currentName: user.name }); setNewUsername(user.name); }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="修改用户名"
                      >
                        <UserIcon size={16} />
                      </button>
                      <button
                        onClick={() => { setPasswordModal({ userId: user.id, userName: user.name }); setNewPassword(''); }}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title="重置密码"
                      >
                        <Key size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Password Reset Modal */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">重置密码</h3>
              <button onClick={() => { setPasswordModal(null); setNewPassword(''); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              为用户 <span className="font-medium text-gray-900">{passwordModal.userName}</span> 设置新密码
            </p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              placeholder="输入新密码（至少6位）"
              onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setPasswordModal(null); setNewPassword(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleResetPassword}
                disabled={newPassword.length < 6}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Username Change Modal */}
      {usernameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">修改用户名</h3>
              <button onClick={() => { setUsernameModal(null); setNewUsername(''); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              将 <span className="font-medium text-gray-900">{usernameModal.currentName}</span> 改为：
            </p>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              placeholder="输入新用户名"
              onKeyDown={(e) => e.key === 'Enter' && handleChangeUsername()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setUsernameModal(null); setNewUsername(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleChangeUsername}
                disabled={newUsername.trim().length < 2 || newUsername === usernameModal.currentName}
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
}
