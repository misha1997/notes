const API_URL = process.env.REACT_APP_API_URL;

const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

export const noteService = {
    // Получить все заметки
    async getAll() {
        const res = await fetch(`${API_URL}/notes`, { headers: getHeaders() });
        return res.ok ? res.json() : [];
    },
    // Создать заметку
    async create(noteData) {
        const res = await fetch(`${API_URL}/notes`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(noteData)
        });
        return res.json();
    },
    async reorder(noteIds) {
        await fetch(`${API_URL}/notes/reorder`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ noteIds })
        });
    },
    // Обновить заметку
    async update(id, noteData) {
        const res = await fetch(`${API_URL}/notes/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(noteData)
        });
        return res.json();
    },
    // Удалить заметку
    async delete(id) {
        await fetch(`${API_URL}/notes/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
    }
};

export const authService = {
    async login(login, password) {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });
        const data = await res.json();
        if (data.token) localStorage.setItem('token', data.token);
        return data;
    },
    logout() {
        localStorage.removeItem('token');
    }
};