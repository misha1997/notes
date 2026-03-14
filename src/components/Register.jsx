import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, User, Mail, Lock, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import TelegramLogin from './TelegramLogin';

export default function Register() {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { register } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validateForm = () => {
        if (!formData.username.trim() || !formData.email.trim() || !formData.password || !formData.confirmPassword) {
            setError('Все поля обязательны для заполнения');
            return false;
        }
        if (formData.username.length < 3) {
            setError('Имя пользователя должно быть не менее 3 символов');
            return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Введите корректный адрес электронной почты');
            return false;
        }
        if (formData.password.length < 6) {
            setError('Пароль должен содержать минимум 6 символов');
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Пароли не совпадают');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) return;

        setLoading(true);
        try {
            const result = await register(formData.username, formData.email, formData.password);

            if (result.success) {
                navigate('/dashboard');
            } else {
                setError(result.error || 'Ошибка при регистрации');
            }
        } catch (err) {
            setError('Не удалось связаться с сервером');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl sm:text-4xl font-semibold text-gray-100 mb-2 tracking-tight">Создать аккаунт</h1>
                    <p className="text-gray-500">Зарегистрируйтесь, чтобы начать</p>
                </div>

                <div className="bg-[#141414] rounded-xl sm:rounded-2xl p-5 sm:p-8 border border-[#2a2a2a] shadow-2xl">
                    {error && (
                        <div className="mb-6 p-3 sm:p-4 bg-[#1f1f1f] border border-[#404040] rounded-lg flex items-center gap-3 text-gray-300 text-sm">
                            <AlertCircle size={18} className="shrink-0 text-red-400" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Имя пользователя */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Имя пользователя</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    className="w-full pl-11 pr-4 py-3 sm:py-3.5 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg sm:rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#404040] transition-colors min-h-[48px] sm:min-h-[52px]"
                                    placeholder="username"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full pl-11 pr-4 py-3 sm:py-3.5 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg sm:rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#404040] transition-colors min-h-[48px] sm:min-h-[52px]"
                                    placeholder="email@example.com"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Пароль */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Пароль</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full pl-11 pr-4 py-3 sm:py-3.5 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg sm:rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#404040] transition-colors min-h-[48px] sm:min-h-[52px]"
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Подтверждение пароля */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Повторите пароль</label>
                            <div className="relative">
                                <CheckCircle2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="w-full pl-11 pr-4 py-3 sm:py-3.5 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg sm:rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#404040] transition-colors min-h-[48px] sm:min-h-[52px]"
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gray-100 hover:bg-white disabled:bg-[#2a2a2a] disabled:text-gray-500 disabled:cursor-not-allowed text-gray-900 py-3.5 sm:py-4 rounded-lg sm:rounded-xl font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-6 min-h-[52px]"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <UserPlus size={20} />
                                    Зарегистрироваться
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 space-y-6 border-t border-[#2a2a2a] pt-6">
                        <TelegramLogin />
                        <div className="text-center">
                            <p className="text-gray-500 text-sm">
                                Уже есть аккаунт?{' '}
                                <Link
                                    to="/login"
                                    className="text-gray-300 hover:text-gray-100 font-medium transition-colors"
                                >
                                    Войти
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
