import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Путь к вашему контексту
import { LogIn, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import TelegramLogin from './TelegramLogin';

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
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-md">
                {/* Заголовок */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl sm:text-4xl font-semibold text-gray-100 mb-2 tracking-tight">С возвращением</h1>
                    <p className="text-gray-500">Войдите, чтобы продолжить</p>
                </div>

                <div className="bg-[#141414] rounded-xl sm:rounded-2xl p-5 sm:p-8 border border-[#2a2a2a] shadow-2xl">
                    {/* Вывод ошибки */}
                    {error && (
                        <div className="mb-6 p-4 bg-[#1f1f1f] border border-[#404040] rounded-xl flex items-center gap-3 text-gray-300 text-sm">
                            <AlertCircle size={18} className="shrink-0 text-red-400" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Поле Логин/Email */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Логин или Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="text"
                                    value={loginIdentifier}
                                    onChange={(e) => setLoginIdentifier(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 sm:py-3.5 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#404040] transition-colors min-h-[52px]"
                                    placeholder="Введите ваш логин"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Поле Пароль */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Пароль</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 sm:py-3.5 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#404040] transition-colors min-h-[52px]"
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Кнопка отправки */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gray-100 hover:bg-white disabled:bg-[#2a2a2a] disabled:text-gray-500 disabled:cursor-not-allowed text-gray-900 py-3.5 sm:py-4 rounded-xl font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4 min-h-[52px]"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <LogIn size={20} />
                                    Войти
                                </>
                            )}
                        </button>
                    </form>

                    {/* Ссылка на регистрацию */}
                    <div className="mt-8 space-y-6 border-t border-[#2a2a2a] pt-6">
                        <TelegramLogin />
                        <div className="text-center">
                            <p className="text-gray-500 text-sm">
                                Нет аккаунта?{' '}
                                <Link
                                    to="/register"
                                    className="text-gray-300 hover:text-gray-100 font-medium transition-colors"
                                >
                                    Зарегистрироваться
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>

                <p className="text-center text-gray-600 text-sm mt-8">
                    Notes &copy; {new Date().getFullYear()}
                </p>
            </div>
        </div>
    );
}
