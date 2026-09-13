import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);
    const subscribersRef = useRef(new Set());
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const isExplicitCloseRef = useRef(false);

    const getWsUrl = useCallback(() => {
        const token = localStorage.getItem('token');
        if (!token) return null;

        const apiUrl = process.env.REACT_APP_API_URL;
        let baseWsUrl = '';

        if (apiUrl) {
            try {
                const parsed = new URL(apiUrl, window.location.href);
                const proto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
                baseWsUrl = `${proto}//${parsed.host}/ws`;
            } catch {
                const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                baseWsUrl = `${proto}//${window.location.host}/ws`;
            }
        } else {
            const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            baseWsUrl = `${proto}//${window.location.host}/ws`;
        }

        return `${baseWsUrl}?token=${encodeURIComponent(token)}`;
    }, []);

    const notifySubscribers = useCallback((data) => {
        subscribersRef.current.forEach((cb) => {
            try {
                cb(data);
            } catch (err) {
                console.error('WebSocket subscriber error:', err);
            }
        });
    }, []);

    const connect = useCallback(() => {
        if (!user) return;

        const url = getWsUrl();
        if (!url) return;

        // Clean up previous socket if any
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        isExplicitCloseRef.current = false;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            const wasReconnect = reconnectAttemptsRef.current > 0;
            reconnectAttemptsRef.current = 0;

            if (wasReconnect) {
                notifySubscribers({ type: 'RECONNECTED' });
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                notifySubscribers(data);
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err);
            }
        };

        ws.onclose = (event) => {
            setIsConnected(false);
            wsRef.current = null;

            // If not logged out or explicitly closed, schedule reconnect
            if (!isExplicitCloseRef.current && user && event.code !== 4401 && event.code !== 4403) {
                const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
                reconnectAttemptsRef.current += 1;

                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }
                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, delay);
            }
        };

        ws.onerror = (err) => {
            // Error will trigger onclose which handles reconnection
            console.warn('WebSocket connection notice:', err);
        };
    }, [user, getWsUrl, notifySubscribers]);

    useEffect(() => {
        if (user) {
            connect();
        } else {
            isExplicitCloseRef.current = true;
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            reconnectAttemptsRef.current = 0;
            setIsConnected(false);
        }

        return () => {
            isExplicitCloseRef.current = true;
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            setIsConnected(false);
        };
    }, [user, connect]);

    const subscribe = useCallback((callback) => {
        subscribersRef.current.add(callback);
        return () => {
            subscribersRef.current.delete(callback);
        };
    }, []);

    return (
        <WebSocketContext.Provider value={{ isConnected, subscribe }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        return { isConnected: false, subscribe: () => () => {} };
    }
    return context;
};
