import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

// Google Icon SVG
const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
);

export default function GoogleLogin() {
    const { loginWithGoogle } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoaded, setGoogleLoaded] = useState(false);

    useEffect(() => {
        if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'your_google_client_id.apps.googleusercontent.com') {
            return;
        }

        // Load Google Sign-In API
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);

        script.onload = () => {
            if (window.google) {
                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: handleCredentialResponse,
                    auto_select: false,
                    cancel_on_tap_outside: true,
                });
                setGoogleLoaded(true);
            }
        };

        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, []);

    const handleCredentialResponse = async (response) => {
        setLoading(true);
        setError('');

        try {
            const result = await loginWithGoogle(response.credential);
            if (result.success) {
                navigate('/dashboard');
            } else {
                setError(result.error || 'Не удалось войти через Google');
            }
        } catch (err) {
            setError('Ошибка при авторизации');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleClick = () => {
        if (window.google && window.google.accounts && window.google.accounts.id) {
            window.google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    // Если One Tap не показался, используем стандартный flow
                    window.google.accounts.id.renderButton(
                        document.createElement('div'),
                        { theme: 'outline', size: 'large' }
                    );
                }
            });
        }
    };

    const isConfigured = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'your_google_client_id.apps.googleusercontent.com';

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-slate-500 justify-center">
                <span className="h-px flex-1 bg-slate-700/50" />
                <span>или</span>
                <span className="h-px flex-1 bg-slate-700/50" />
            </div>

            {!isConfigured ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-200 text-center space-y-2">
                    <p className="font-medium">Google OAuth не настроен</p>
                    <p className="text-xs text-amber-300/70">
                        1. Перейдите в <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="underline hover:text-amber-200">Google Cloud Console</a><br/>
                        2. Создайте проект → APIs & Services → Credentials<br/>
                        3. Create Credentials → OAuth client ID<br/>
                        4. Authorized JavaScript origins: http://localhost:3000<br/>
                        5. Скопируйте Client ID в файл .env
                    </p>
                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3"
                >
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleGoogleClick}
                        disabled={!googleLoaded || loading}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl
                            bg-slate-900/50 border border-slate-700 hover:border-cyan-500/50
                            text-slate-200 font-medium transition-all duration-300
                            hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:bg-slate-800/50
                            disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                <div className="p-1.5 bg-white rounded-full group-hover:shadow-lg group-hover:shadow-cyan-500/20 transition-all">
                                    <GoogleIcon />
                                </div>
                                <span>Войти через Google</span>
                            </>
                        )}
                    </motion.button>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm text-red-400 text-center bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2"
                        >
                            {error}
                        </motion.div>
                    )}
                </motion.div>
            )}
        </div>
    );
}
