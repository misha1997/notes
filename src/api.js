const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

const getAuthHeader = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

const handleForbidden = (res) => {
    if (res.status === 403) {
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') {
            window.location.assign('/login');
        }
    }
    return res;
};

export const noteService = {
    // Получить все заметки
    async getAll() {
        const res = handleForbidden(
            await fetch(`/api/notes`, { headers: getHeaders() })
        );
        return res.ok ? res.json() : [];
    },
    // Создать заметку
    async create(noteData) {
        const res = handleForbidden(await fetch(`/api/notes`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(noteData)
        }));
        return res.json();
    },
    async reorder(noteIds) {
        handleForbidden(await fetch(`/api/notes/reorder`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ noteIds })
        }));
    },
    // Обновить заметку
    async update(id, noteData) {
        const res = handleForbidden(await fetch(`/api/notes/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(noteData)
        }));
        return res.json();
    },
    async uploadAttachment(id, file) {
        const formData = new FormData();
        formData.append('file', file);
        const res = handleForbidden(await fetch(`/api/notes/${id}/attachments`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: formData
        }));
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
    },
    async deleteAttachment(noteId, attachmentId) {
        handleForbidden(await fetch(`/api/notes/${noteId}/attachments/${attachmentId}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        }));
    },
    // Удалить заметку
    async delete(id) {
        handleForbidden(await fetch(`/api/notes/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        }));
    }
};

export const authService = {
    async login(login, password) {
        const res = await fetch(`/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });
        const data = await res.json();
        if (data.token) localStorage.setItem('token', data.token);
        return data;
    },
    async telegramLogin(telegramData) {
        const res = await fetch(`/api/auth/telegram`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramData })
        });
        const data = await res.json();
        if (data.token) localStorage.setItem('token', data.token);
        return data;
    },
    logout() {
        localStorage.removeItem('token');
    }
};
