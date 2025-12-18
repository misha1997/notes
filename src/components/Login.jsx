import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Путь к вашему контексту
import { LogIn, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

export default function Login() {
    const [loginIdentifier, setLoginIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Базовая валидация
        if (!loginIdentifier.trim() || !password.trim()) {
            setError('Пожалуйста, заполните все поля');
            setLoading(false);
            return;
        }

        try {
            const result = await login(loginIdentifier, password);

            if (result.success) {
                navigate('/dashboard'); // Перенаправляем на главную после входа
            } else {
                setError(result.error || 'Неверное имя пользователя или пароль');
            }
        } catch (err) {
            setError('Ошибка соединения с сервером');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                {/* Заголовок */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">С возвращением!</h1>
                    <p className="text-purple-200/70">Войдите, чтобы управлять своими заметками</p>
                </div>

                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
                    {/* Вывод ошибки */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 text-sm animate-shake">
                            <AlertCircle size={18} className="shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Поле Логин/Email */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 ml-1">Логин или Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    value={loginIdentifier}
                                    onChange={(e) => setLoginIdentifier(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                    placeholder="Введите ваш логин"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Поле Пароль */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 ml-1">Пароль</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Кнопка отправки */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800/50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-bold shadow-lg shadow-purple-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={22} />
                            ) : (
                                <>
                                    <LogIn size={22} />
                                    Войти в систему
                                </>
                            )}
                        </button>
                    </form>

                    {/* Ссылка на регистрацию */}
                    <div className="mt-8 text-center border-t border-white/10 pt-6">
                        <p className="text-gray-400">
                            Впервые здесь?{' '}
                            <Link
                                to="/register"
                                className="text-purple-400 hover:text-purple-300 font-semibold transition-colors underline-offset-4 hover:underline"
                            >
                                Создать аккаунт
                            </Link>
                        </p>
                    </div>
                </div>

                <p className="text-center text-gray-500 text-sm mt-8">
                    MyNotes App &copy; {new Date().getFullYear()}
                </p>
            </div>
        </div>
    );
}