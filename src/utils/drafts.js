const DRAFT_NEW_KEY = 'notes_draft_new';
const DRAFT_EDITS_KEY = 'notes_draft_edits';
const DRAFT_ACTIVE_EDIT_ID_KEY = 'notes_draft_active_edit_id';

const safeGetStorage = (key) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        console.warn(`Failed to parse draft from localStorage [${key}]:`, e);
        return null;
    }
};

const safeSetStorage = (key, data) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn(`Failed to save draft to localStorage [${key}]:`, e);
    }
};

const safeRemoveStorage = (key) => {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.warn(`Failed to remove draft from localStorage [${key}]:`, e);
    }
};

let newDraftTimer = null;
let pendingNewDraft = null;

export const flushNewDraft = () => {
    if (newDraftTimer) {
        clearTimeout(newDraftTimer);
        newDraftTimer = null;
    }
    if (pendingNewDraft) {
        const { content, hashtags } = pendingNewDraft;
        const trimmed = content.trim();
        if (!trimmed && (!hashtags || hashtags.length === 0)) {
            safeRemoveStorage(DRAFT_NEW_KEY);
        } else {
            safeSetStorage(DRAFT_NEW_KEY, {
                content,
                hashtags: hashtags || [],
                updatedAt: Date.now()
            });
        }
        pendingNewDraft = null;
    }
};

let editDraftTimer = null;
let pendingEditDraft = null;

export const flushEditDraft = () => {
    if (editDraftTimer) {
        clearTimeout(editDraftTimer);
        editDraftTimer = null;
    }
    if (pendingEditDraft) {
        const { noteId, content, hashtags } = pendingEditDraft;
        const all = getAllEditDrafts();
        all[String(noteId)] = {
            noteId,
            content,
            hashtags: hashtags || [],
            updatedAt: Date.now()
        };
        safeSetStorage(DRAFT_EDITS_KEY, all);
        safeSetStorage(DRAFT_ACTIVE_EDIT_ID_KEY, noteId);
        pendingEditDraft = null;
    }
};

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        flushNewDraft();
        flushEditDraft();
    });
}

// ============ NEW NOTE DRAFT ============

export const saveNewNoteDraft = ({ content = '', hashtags = [] }) => {
    pendingNewDraft = { content, hashtags };
    if (newDraftTimer) {
        clearTimeout(newDraftTimer);
    }
    newDraftTimer = setTimeout(() => {
        flushNewDraft();
    }, 300);
};

export const getNewNoteDraft = () => {
    flushNewDraft();
    const draft = safeGetStorage(DRAFT_NEW_KEY);
    if (!draft) return null;
    if (!draft.content?.trim() && (!draft.hashtags || draft.hashtags.length === 0)) {
        return null;
    }
    return draft;
};

export const clearNewNoteDraft = () => {
    if (newDraftTimer) {
        clearTimeout(newDraftTimer);
        newDraftTimer = null;
    }
    pendingNewDraft = null;
    safeRemoveStorage(DRAFT_NEW_KEY);
};

// ============ EDIT NOTE DRAFTS ============

export const getAllEditDrafts = () => {
    if (pendingEditDraft) {
        const { noteId, content, hashtags } = pendingEditDraft;
        const drafts = safeGetStorage(DRAFT_EDITS_KEY) || {};
        drafts[String(noteId)] = {
            noteId,
            content,
            hashtags: hashtags || [],
            updatedAt: Date.now()
        };
        return drafts;
    }
    const drafts = safeGetStorage(DRAFT_EDITS_KEY);
    return drafts && typeof drafts === 'object' ? drafts : {};
};

export const getEditDraft = (noteId) => {
    if (!noteId) return null;
    if (pendingEditDraft && String(pendingEditDraft.noteId) === String(noteId)) {
        return {
            noteId,
            content: pendingEditDraft.content,
            hashtags: pendingEditDraft.hashtags || [],
            updatedAt: Date.now()
        };
    }
    const all = getAllEditDrafts();
    return all[String(noteId)] || null;
};

export const hasEditDraft = (noteId) => {
    return Boolean(getEditDraft(noteId));
};

export const saveEditDraft = (noteId, { content = '', hashtags = [] }) => {
    if (!noteId) return;
    pendingEditDraft = { noteId, content, hashtags };
    if (editDraftTimer) {
        clearTimeout(editDraftTimer);
    }
    editDraftTimer = setTimeout(() => {
        flushEditDraft();
    }, 300);
};

export const clearEditDraft = (noteId) => {
    if (!noteId) return;
    if (editDraftTimer) {
        clearTimeout(editDraftTimer);
        editDraftTimer = null;
    }
    if (pendingEditDraft && String(pendingEditDraft.noteId) === String(noteId)) {
        pendingEditDraft = null;
    }
    const all = getAllEditDrafts();
    if (all[String(noteId)]) {
        delete all[String(noteId)];
        safeSetStorage(DRAFT_EDITS_KEY, all);
    }
    const activeId = safeGetStorage(DRAFT_ACTIVE_EDIT_ID_KEY);
    if (String(activeId) === String(noteId)) {
        safeRemoveStorage(DRAFT_ACTIVE_EDIT_ID_KEY);
    }
};

export const getActiveEditDraftId = () => {
    if (pendingEditDraft) {
        return pendingEditDraft.noteId;
    }
    return safeGetStorage(DRAFT_ACTIVE_EDIT_ID_KEY);
};

export const setActiveEditDraftId = (noteId) => {
    if (noteId) {
        safeSetStorage(DRAFT_ACTIVE_EDIT_ID_KEY, noteId);
    } else {
        safeRemoveStorage(DRAFT_ACTIVE_EDIT_ID_KEY);
    }
};

export const clearActiveEditDraftId = () => {
    safeRemoveStorage(DRAFT_ACTIVE_EDIT_ID_KEY);
};
