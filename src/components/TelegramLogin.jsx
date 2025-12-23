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
        // Обрабатываем возврат с параметрами Telegram OAuth (бот)
        const params = new URLSearchParams(window.location.search);
        if (params.get('tg_redirect') === '1' && params.get('hash')) {
            const data = {};
            params.forEach((value, key) => {
                data[key] = value;
            });
            setLoading(true);
            setError('');
            (async () => {
                const res = await loginWithTelegram(data);
                if (res.success) {
                    navigate('/dashboard');
                } else {
                    setError(res.error || 'Не удалось войти через Telegram');
                }
                setLoading(false);
                // Чистим query-параметры, чтобы не повторять логин при обновлении
                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState(null, '', cleanUrl);
            })();
        }
    }, [loginWithTelegram, navigate]);

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
                <div className="rounded-2xl border border-purple-500/40 bg-purple-500/10 px-4 py-4 shadow-lg shadow-purple-900/30 space-y-3">
                    <p className="text-center text-sm text-purple-100 font-semibold">Войти через Telegram</p>
                    <div className="flex flex-col items-center gap-3">
                        <a
                            href={`https://oauth.telegram.org/auth?bot=${botName}&origin=${encodeURIComponent(window.location.origin)}&return_to=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?tg_redirect=1`)}&embed=0&request_access=write`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-sm text-white font-semibold transition-colors"
                        >
                            Открыть Telegram
                        </a>
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

