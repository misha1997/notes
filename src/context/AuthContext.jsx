import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../api';

const AuthContext = createContext(null);
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            setUser({ loggedIn: true });
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        const data = await authService.login(username, password);
        if (data.token) {
            setUser(data.user);
            return { success: true };
        }
        return { success: false, error: data.error };
    };

    const loginWithTelegram = async (telegramData) => {
        const data = await authService.telegramLogin(telegramData);
        if (data.token) {
            setUser(data.user);
            return { success: true };
        }
        return { success: false, error: data.error };
    };

    const register = async (username, email, password) => {
        const res = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('token', data.token);
            setUser(data.user);
            return { success: true };
        }
        return { success: false, error: data.error };
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading, loginWithTelegram }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);