const api = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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
    async getAll({ offset = 0, limit = 25 } = {}) {
        const res = handleForbidden(
            await fetch(`${api}/api/notes?offset=${offset}&limit=${limit}`, { headers: getHeaders() })
        );
        if (!res.ok) return { notes: [], hasMore: false };
        const data = await res.json();
        if (Array.isArray(data)) {
            return { notes: data, hasMore: false };
        }
        return data;
    },

    async getCount() {
        const res = handleForbidden(
            await fetch(`${api}/api/notes/count`, { headers: getHeaders() })
        );
        if (!res.ok) return { total: 0 };
        return res.json();
    },

    async create(noteData) {
        const res = handleForbidden(await fetch(`${api}/api/notes`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(noteData)
        }));
        return res.json();
    },

    async reorder(noteIds) {
        handleForbidden(await fetch(`${api}/api/notes/reorder`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ noteIds })
        }));
    },

    async update(id, noteData) {
        const res = handleForbidden(await fetch(`${api}/api/notes/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(noteData)
        }));
        return res.json();
    },

    async uploadAttachment(id, file) {
        const formData = new FormData();
        formData.append('file', file);
        const res = handleForbidden(await fetch(`${api}/api/notes/${id}/attachments`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: formData
        }));
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
    },

    async deleteAttachment(noteId, attachmentId) {
        handleForbidden(await fetch(`${api}/api/notes/${noteId}/attachments/${attachmentId}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        }));
    },

    async delete(id) {
        handleForbidden(await fetch(`${api}/api/notes/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        }));
    }
};

export const userService = {
    async getProfile() {
        const res = handleForbidden(await fetch(`${api}/api/user/profile`, { headers: getHeaders() }));
        if (!res.ok) throw new Error('Failed to load profile');
        return res.json();
    },

    async updateProfile({ email, currentPassword, newPassword }) {
        const res = handleForbidden(await fetch(`${api}/api/user/profile`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ email, currentPassword, newPassword })
        }));
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to update profile');
        }
        return res.json();
    }
};

export const authService = {
    async login(login, password) {
        const res = await fetch(`${api}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });
        const data = await res.json();
        if (data.token) localStorage.setItem('token', data.token);
        return data;
    },

    async googleLogin(googleToken) {
        const res = await fetch(`${api}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: googleToken })
        });
        const data = await res.json();
        if (data.token) localStorage.setItem('token', data.token);
        return data;
    },

    logout() {
        localStorage.removeItem('token');
    }
};

export const tagService = {
    async getClickCounts() {
        const res = handleForbidden(await fetch(`${api}/api/tags/clicks`, { headers: getHeaders() }));
        if (!res.ok) return {};
        return res.json();
    },

    async recordClick(tag) {
        const res = handleForbidden(await fetch(`${api}/api/tags/click`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ tag })
        }));
        if (!res.ok) return { click_count: 0 };
        return res.json();
    }
};
