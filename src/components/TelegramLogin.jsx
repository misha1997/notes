import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const botName = process.env.REACT_APP_TELEGRAM_BOT_NAME;

export default function TelegramLogin() {
    const { loginWithTelegram } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!botName) return;

        window.handleTelegramAuth = async (user) => {
            setError('');
            setLoading(true);
            try {
                const res = await loginWithTelegram(user);
                if (res.success) {
                    navigate('/dashboard');
                } else {
                    setError(res.error || 'Не удалось войти через Telegram');
                }
            } finally {
                setLoading(false);
            }
        };

        const container = document.getElementById('tg-login-container');
        if (!container) return;

        // Очищаем на всякий случай
        container.innerHTML = '';
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', botName);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-userpic', 'false');
        script.setAttribute('data-request-access', 'write');
        script.setAttribute('data-onauth', 'handleTelegramAuth');
        script.async = true;
        container.appendChild(script);

        return () => {
            if (container) container.innerHTML = '';
        };
    }, []);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-purple-200/80 justify-center">
                <span className="h-px w-8 bg-white/20" />
                <span>или</span>
                <span className="h-px w-8 bg-white/20" />
            </div>
            {!botName ? (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    Укажите REACT_APP_TELEGRAM_BOT_NAME в .env и перезапустите dev‑сервер.
                </div>
            ) : (
                <div className="rounded-2xl border border-purple-500/40 bg-purple-500/10 px-4 py-3 shadow-lg shadow-purple-900/30">
                    <p className="text-center text-sm text-purple-100 mb-2 font-semibold">Войти через Telegram</p>
                    <div className="flex flex-col items-center gap-2">
                        <div id="tg-login-container" />
                        {loading && (
                            <div className="flex items-center gap-2 text-sm text-purple-100">
                                <Loader2 className="animate-spin" size={16} />
                                Подтверждение через Telegram...
                            </div>
                        )}
                        {error && <div className="text-sm text-red-300 text-center">{error}</div>}
                    </div>
                </div>
            )}
        </div>
    );
}

