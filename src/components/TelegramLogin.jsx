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
                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState(null, '', cleanUrl);
            })();
        }
    }, [loginWithTelegram, navigate]);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 justify-center">
                <span className="h-px w-8 bg-[#2a2a2a]" />
                <span>или</span>
                <span className="h-px w-8 bg-[#2a2a2a]" />
            </div>
            {!botName ? (
                <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-gray-500">
                    Укажите REACT_APP_TELEGRAM_BOT_NAME в .env
                </div>
            ) : (
                <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-4 space-y-3">
                    <p className="text-center text-sm text-gray-300 font-medium">Войти через Telegram</p>
                    <div className="flex flex-col items-center gap-3">
                        <a
                            href={`https://oauth.telegram.org/auth?bot=${botName}&origin=${encodeURIComponent(window.location.origin)}&return_to=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?tg_redirect=1`)}&embed=0&request_access=write`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center px-4 py-3 rounded-lg bg-[#0088cc] hover:bg-[#0099dd] text-sm text-white font-medium transition-colors"
                        >
                            Открыть Telegram
                        </a>
                        {loading && (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <Loader2 className="animate-spin" size={16} />
                                Подтверждение...
                            </div>
                        )}
                        {error && <div className="text-sm text-red-400 text-center">{error}</div>}
                    </div>
                </div>
            )}
        </div>
    );
}
