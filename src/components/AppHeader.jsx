import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, X, Save, Sparkles, StickyNote, Files } from 'lucide-react';
import { userService } from '../api';
import { useAuth } from '../context/AuthContext';

// Общий хедер приложения: навигация (заметки/файлы), счётчик и кнопки аккаунт/выход.
// Используется на страницах /dashboard и /files.
export default function AppHeader({ countText }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Модалка аккаунта (перенесена из TodoNotesApp)
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [accountEmail, setAccountEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [accountLoading, setAccountLoading] = useState(false);
    const [accountError, setAccountError] = useState('');
    const [accountSuccess, setAccountSuccess] = useState('');

    useEffect(() => {
        if (isAccountModalOpen && user) {
            setAccountEmail(user.email || '');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setAccountError('');
            setAccountSuccess('');
        }
    }, [isAccountModalOpen, user]);

    const handleAccountSave = async () => {
        setAccountError('');
        setAccountSuccess('');

        if (newPassword || confirmPassword) {
            if (!currentPassword) {
                setAccountError('Введите текущий пароль для изменения пароля');
                return;
            }
            if (newPassword !== confirmPassword) {
                setAccountError('Новый пароль и подтверждение не совпадают');
                return;
            }
            if (newPassword.length < 8) {
                setAccountError('Пароль должен содержать минимум 8 символов');
                return;
            }
            const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
            if (!passwordRegex.test(newPassword)) {
                setAccountError('Пароль должен содержать минимум одну букву и одну цифру');
                return;
            }
        }

        setAccountLoading(true);
        try {
            await userService.updateProfile({
                email: accountEmail,
                currentPassword: currentPassword || undefined,
                newPassword: newPassword || undefined
            });
            setAccountSuccess('Изменения сохранены');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            if (user) {
                user.email = accountEmail;
            }
        } catch (err) {
            setAccountError(err.message || 'Ошибка при сохранении');
        } finally {
            setAccountLoading(false);
        }
    };

    const navItem = (to, Icon, label, active) => (
        <Link
            to={to}
            title={label}
            className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
                active
                    ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40'
                    : 'bg-slate-800/50 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 border-slate-700 hover:border-cyan-500/30'
            }`}
        >
            <Icon size={20} />
        </Link>
    );

    return (
        <>
            {/* Top Toolbar */}
            <div className="flex flex-row items-center justify-between mb-4 sm:mb-6 gap-4">
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2">
                        {navItem('/dashboard', StickyNote, 'Заметки', location.pathname === '/dashboard')}
                        {navItem('/files', Files, 'Файлы', location.pathname === '/files')}
                    </div>
                    <span className="text-slate-400 text-sm font-medium">{countText}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsAccountModalOpen(true)}
                        className="p-2.5 rounded-xl bg-slate-800/50 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 border border-slate-700 hover:border-cyan-500/30 transition-all"
                        title="Аккаунт"
                    >
                        <User size={18} />
                    </button>
                    <button
                        onClick={handleLogout}
                        className="p-2.5 rounded-xl bg-slate-800/50 text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/30 transition-all"
                        title="Выйти"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>

            {/* Mobile Bottom Navigation - Using Portal to avoid transform issues from motion.div parent */}
            {createPortal(
                <div className="fixed bottom-0 left-0 right-0 sm:hidden bg-slate-900/80 backdrop-blur-xl border-t border-slate-700/50 z-50">
                    <div className="flex items-center justify-around p-2 mb-safe">
                        <Link
                            to="/dashboard"
                            className={`flex flex-col items-center justify-center w-full py-2 rounded-xl transition-all ${
                                location.pathname === '/dashboard'
                                    ? 'text-cyan-400'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                            }`}
                        >
                            <StickyNote size={20} className="mb-1" />
                            <span className="text-[10px] font-medium uppercase tracking-wider">Заметки</span>
                        </Link>
                        <Link
                            to="/files"
                            className={`flex flex-col items-center justify-center w-full py-2 rounded-xl transition-all ${
                                location.pathname === '/files'
                                    ? 'text-cyan-400'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                            }`}
                        >
                            <Files size={20} className="mb-1" />
                            <span className="text-[10px] font-medium uppercase tracking-wider">Файлы</span>
                        </Link>
                    </div>
                </div>,
                document.body
            )}

            {/* Account Modal */}
            {createPortal(
                <AnimatePresence>
                    {isAccountModalOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                        onClick={() => setIsAccountModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="glass rounded-2xl p-6 w-full max-w-md border border-slate-700/50 neon-shadow"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-cyan-500/10 rounded-xl">
                                        <User className="text-cyan-400" size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-semibold text-slate-100">Аккаунт</h2>
                                        <p className="text-sm text-slate-500">{user?.username}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsAccountModalOpen(false)}
                                    className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-xl transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {accountError && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm"
                                >
                                    {accountError}
                                </motion.div>
                            )}

                            {accountSuccess && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm"
                                >
                                    {accountSuccess}
                                </motion.div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1.5">Email</label>
                                    <input
                                        type="email"
                                        value={accountEmail}
                                        onChange={(e) => setAccountEmail(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                                        placeholder="your@email.com"
                                    />
                                </div>

                                <div className="pt-4 border-t border-slate-700/50">
                                    <p className="text-sm text-slate-400 mb-3">Изменить пароль (необязательно)</p>

                                    <div className="space-y-3">
                                        <div>
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                                                placeholder="Текущий пароль"
                                            />
                                        </div>

                                        <div>
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                                                placeholder="Новый пароль"
                                            />
                                        </div>

                                        <div>
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                                                placeholder="Подтвердите новый пароль"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setIsAccountModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={handleAccountSave}
                                    disabled={accountLoading}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:from-cyan-400 hover:to-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {accountLoading ? (
                                        <>
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                            >
                                                <Sparkles size={16} />
                                            </motion.div>
                                            Сохранение...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            Сохранить
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>,
            document.body
        )}
        </>
    );
}