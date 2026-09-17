import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';

const Login = lazy(() => import('./components/Login'));
const Register = lazy(() => import('./components/Register'));
const TodoNotesApp = lazy(() => import('./components/TodoNotesApp'));
const FilesPage = lazy(() => import('./components/FilesPage'));

// Защищенный роут: если не залогинен — кидает на /login
const PrivateRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return null;
    return user ? children : <Navigate to="/login" />;
};

const PageFallback = () => (
    <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
);

function App() {
    return (
        <AuthProvider>
            <WebSocketProvider>
                <BrowserRouter>
                    <Suspense fallback={<PageFallback />}>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route
                                path="/dashboard"
                                element={
                                    <PrivateRoute>
                                        <TodoNotesApp />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/files"
                                element={
                                    <PrivateRoute>
                                        <FilesPage />
                                    </PrivateRoute>
                                }
                            />
                            <Route path="*" element={<Navigate to="/dashboard" />} />
                        </Routes>
                    </Suspense>
                </BrowserRouter>
            </WebSocketProvider>
        </AuthProvider>
    );
}

export default App;