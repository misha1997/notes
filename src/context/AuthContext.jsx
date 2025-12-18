import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../api'; // тот сервис, что мы обсуждали ранее

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // При загрузке проверяем, есть ли токен в localStorage
        const token = localStorage.getItem('token');
        if (token) {
            // Можно добавить запрос к /api/auth/me для проверки валидности
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

    const register = async (username, email, password) => {
        const res = await fetch(`/auth/register`, {
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
        <AuthContext.Provider value={{ user, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);