import React, { useState, useEffect, forwardRef, useRef, useCallback, useMemo, useDeferredValue, memo } from 'react';
import { Search, Trash2, Edit2, Save, X, Code, FileText, Hash, GripVertical, LogOut, Copy, Paperclip, Download } from 'lucide-react';
import { motion, Reorder, AnimatePresence, useDragControls } from 'framer-motion';
import { noteService } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const urlRegex = /https?:\/\/[^\s]+/g;
const apiBase = import.meta.env.VITE_API_URL || '';
const apiOrigin = apiBase.replace(/\/api\/?$/, '');
const EMPTY_ARRAY = [];

const getAttachmentUrl = (att) => {
    if (!apiOrigin) return att.url;
    return `${apiOrigin}/download/${encodeURIComponent(att.filename)}`;
};

const splitTextWithLinks = (text) => {
    if (!text) return [{ type: 'text', value: '' }];
    const parts = [];
    let lastIndex = 0;
    for (const match of text.matchAll(urlRegex)) {
        const start = match.index ?? 0;
        if (start > lastIndex) {
            parts.push({ type: 'text', value: text.slice(lastIndex, start) });
        }
        let url = match[0];
        let trailing = '';
        const trailingMatch = url.match(/[),.!?]+$/);
        if (trailingMatch) {
            trailing = trailingMatch[0];
            url = url.slice(0, -trailing.length);
        }
        if (url) {
            parts.push({ type: 'link', value: url });
        }
        if (trailing) {
            parts.push({ type: 'text', value: trailing });
        }
        lastIndex = start + match[0].length;
    }
    if (lastIndex < text.length) {
        parts.push({ type: 'text', value: text.slice(lastIndex) });
    }
    return parts.length ? parts : [{ type: 'text', value: text }];
};

const renderLinkedText = (text) =>
    splitTextWithLinks(text).map((part, index) => {
        if (part.type === 'link') {
            return (
                <a
                    key={`link-${index}`}
                    href={part.value}
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-300 underline underline-offset-2 hover:text-purple-200 break-all"
                >
                    {part.value}
                </a>
            );
        }
        return <span key={`text-${index}`}>{part.value}</span>;
    });

const DraggableNote = memo(forwardRef(function DraggableNote(
    {
        note,
        isEditing,
        editType,
        editContent,
        editHashtags,
        editHashtagInput,
        setEditType,
        setEditContent,
        setEditHashtags,
        setEditHashtagInput,
        startEdit,
        deleteNote,
        saveEdit,
        formatDate,
        setEditingId,
        addHashtagEdit,
        setSearchText,
        formatFileSize,
        editAttachments,
        newEditFiles,
        removeExistingAttachment,
        removeNewEditFile,
        handleEditFilesChange
    },
    ref
) {
    const dragControls = useDragControls();
    const [copied, setCopied] = useState(false);
    const editAreaRef = useRef(null);

    const autoSizeEdit = useCallback(() => {
        const el = editAreaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
    }, []);

    useEffect(() => {
        if (isEditing) autoSizeEdit();
    }, [isEditing, editContent, autoSizeEdit]);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(note.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            console.error('Не удалось скопировать текст', err);
        }
    }, [note.content]);

    const formattedDate = useMemo(() => formatDate(note.timestamp), [formatDate, note.timestamp]);
    const renderedBody = useMemo(() => {
        if (note.type === 'code') {
            return (
                <pre className="text-white whitespace-pre-wrap break-words font-mono text-sm bg-black/20 p-3 rounded-lg border border-white/5">
                    {note.content}
                </pre>
            );
        }
        return <div className="text-white whitespace-pre-wrap break-words">{renderLinkedText(note.content)}</div>;
    }, [note.type, note.content]);

    return (
        <Reorder.Item
            key={note.id}
            value={note}
            dragListener={false}
            dragControls={dragControls}
            ref={ref}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 hover:border-purple-400 transition-colors group relative"
        >
            <div
                className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1"
                onPointerDown={(e) => {
                    e.preventDefault();
                    dragControls.start(e);
                }}
            >
                <GripVertical className="text-gray-400" size={20} />
            </div>

            {isEditing ? (
                <div className="space-y-4 ml-6">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setEditType('text')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${editType === 'text' ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-300'}`}
                        >
                            <FileText size={14} /> Текст
                        </button>
                        <button
                            onClick={() => setEditType('code')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${editType === 'code' ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-300'}`}
                        >
                            <Code size={14} /> Код
                        </button>
                    </div>

                    <textarea
                        ref={editAreaRef}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onInput={autoSizeEdit}
                        rows={1}
                        className={`w-full p-4 bg-black/30 border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px] max-h-[260px] resize-y overflow-y-auto scrollbar-styled ${editType === 'code' ? 'font-mono text-sm' : ''}`}
                    />

                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative w-[180px]">
                            <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                value={editHashtagInput}
                                onChange={(e) => setEditHashtagInput(e.target.value)}
                                onKeyPress={addHashtagEdit}
                                placeholder="Тег..."
                                className="w-full pl-8 pr-3 py-1.5 bg-black/30 border border-white/30 rounded-lg text-sm text-white focus:outline-none"
                            />
                        </div>
                        {editHashtags.map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600/50 border border-blue-400/60 rounded-full text-xs text-white">
                                {tag}
                                <button onClick={() => setEditHashtags(editHashtags.filter(t => t !== tag))}><X size={12} /></button>
                            </span>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-purple-100">
                            <Paperclip size={14} />
                            <span>Вложения</span>
                        </div>
                        {editAttachments.length > 0 && (
                            <div className="space-y-1">
                                {editAttachments.map(att => (
                                    <div key={att.id} className="flex items-center justify-between bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                                        <a href={getAttachmentUrl(att)} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-purple-200">
                                            <Download size={14} />
                                            <span>{att.originalName || att.filename}</span>
                                            <span className="text-xs text-gray-300">{formatFileSize(att.size)}</span>
                                        </a>
                                        <button onClick={() => removeExistingAttachment(att.id)} className="text-red-300 hover:text-red-200">
                                            Удалить
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {newEditFiles.length > 0 && (
                            <div className="space-y-1">
                                {newEditFiles.map(file => (
                                    <div key={file.name} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-sm text-white">
                                        <span>{file.name}</span>
                                        <button onClick={() => removeNewEditFile(file.name)} className="text-red-300 hover:text-red-200">
                                            Удалить
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <input
                            type="file"
                            multiple
                            onChange={handleEditFilesChange}
                            className="text-sm text-white file:mr-3 file:rounded-md file:border-none file:bg-purple-600 file:px-3 file:py-1 file:text-white hover:file:bg-purple-700"
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button onClick={saveEdit} className="bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg text-white text-sm flex items-center gap-2 transition-colors">
                            <Save size={14} /> Сохранить
                        </button>
                        <button onClick={() => setEditingId(null)} className="bg-gray-600 hover:bg-gray-700 px-3 py-1.5 rounded-lg text-white text-sm flex items-center gap-2 transition-colors">
                            <X size={14} /> Отмена
                        </button>
                    </div>
                </div>
            ) : (
                <div className="ml-6">
                        <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {note.type === 'code' ? <Code size={16} className="text-purple-400" /> : <FileText size={16} className="text-blue-400" />}
                            <span className="text-xs text-gray-400">{formattedDate}</span>
                        </div>
                        <div className="relative flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <AnimatePresence>
                                {copied && (
                                    <motion.span
                                        initial={{ opacity: 0, y: -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={{ duration: 0.18 }}
                                        className="absolute right-0 -top-7 text-xs text-purple-50 bg-purple-600/70 px-2 py-1 rounded-full shadow-lg backdrop-blur-sm"
                                    >
                                        Скопировано
                                    </motion.span>
                                )}
                            </AnimatePresence>
                            {note.type === 'code' && (
                                <button
                                    onClick={handleCopy}
                                    className="p-2 hover:bg-purple-500/20 text-purple-200 rounded-full transition-colors"
                                    title={copied ? "Скопировано" : "Скопировать код"}
                                >
                                    <Copy size={18} />
                                </button>
                            )}
                            <button onClick={() => startEdit(note)} className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-full transition-colors" title="Редактировать">
                                <Edit2 size={18} />
                            </button>
                            <button onClick={() => deleteNote(note.id)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-full transition-colors" title="Удалить">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                    {renderedBody}
                    {note.hashtags?.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-4">
                            {note.hashtags?.map(tag => (
                                <span key={tag} onClick={() => setSearchText(tag)} className="px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/50 rounded-full text-xs text-purple-200 cursor-pointer transition-colors">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    ) : null}
                    {note.attachments?.length > 0 ? (
                        <div className="mt-4 space-y-2">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-purple-200/90">
                                <Paperclip size={14} />
                                <span>Файлы ({note.attachments.length})</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {note.attachments.map(att => (
                                    <a
                                        key={att.id}
                                        href={getAttachmentUrl(att)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="group flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white transition-colors hover:border-purple-400/60 hover:bg-purple-600/10"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Download size={14} className="text-purple-200" />
                                            <span className="truncate">{att.originalName || att.filename}</span>
                                        </div>
                                        <span className="text-xs text-gray-300 group-hover:text-purple-100">{formatFileSize(att.size)}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            )}
        </Reorder.Item>
    );
}));
DraggableNote.displayName = 'DraggableNote';

export default function TodoNotesApp() {
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchText, setSearchText] = useState('');
    const inputRef = useRef(null);
    const loadMoreRef = useRef(null);
    const pageSize = 25;

    const { logout, user } = useAuth(); // Получаем функцию выхода и данные юзера
    const navigate = useNavigate();
    const deferredSearchText = useDeferredValue(searchText);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Состояния для верхней формы (создание)
    const [newNoteType, setNewNoteType] = useState('text');
    const [hashtagInput, setHashtagInput] = useState('');
    const [currentHashtags, setCurrentHashtags] = useState([]);
    const [newFiles, setNewFiles] = useState([]);

    // Состояния для редактирования
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [editType, setEditType] = useState('text');
    const [editHashtags, setEditHashtags] = useState([]);
    const [editHashtagInput, setEditHashtagInput] = useState('');
    const [editAttachments, setEditAttachments] = useState([]);
    const [newEditFiles, setNewEditFiles] = useState([]);
    const [attachmentsToRemove, setAttachmentsToRemove] = useState([]);

    const loadNotes = useCallback(async () => {
        setLoading(true);
        const { notes: data, hasMore: more } = await noteService.getAll({ offset: 0, limit: pageSize });
        setNotes(data);
        setHasMore(more);
        setPage(1);
        setLoading(false);
    }, [pageSize]);

    const loadMore = useCallback(async () => {
        if (loading || loadingMore || !hasMore) return;
        setLoadingMore(true);
        const { notes: data, hasMore: more } = await noteService.getAll({
            offset: page * pageSize,
            limit: pageSize
        });
        if (data.length) {
            setNotes(prev => [...prev, ...data]);
            setPage(prev => prev + 1);
        }
        setHasMore(more);
        setLoadingMore(false);
    }, [loading, loadingMore, hasMore, page, pageSize]);

    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    useEffect(() => {
        const target = loadMoreRef.current;
        if (!target || !hasMore) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) loadMore();
            },
            { rootMargin: '200px' }
        );
        observer.observe(target);
        return () => observer.disconnect();
    }, [loadMore, hasMore]);

    const autoSizeInput = () => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
    };

    useEffect(() => {
        autoSizeInput();
    }, [searchText]);

    const addHashtagMain = (e) => {
        if (e.key === 'Enter' && hashtagInput.trim()) {
            const tag = hashtagInput.startsWith('#') ? hashtagInput : `#${hashtagInput}`;
            if (!currentHashtags.includes(tag)) {
                setCurrentHashtags([...currentHashtags, tag]);
            }
            setHashtagInput('');
        }
    };

    const addHashtagEdit = (e) => {
        if (e.key === 'Enter' && editHashtagInput.trim()) {
            const tag = editHashtagInput.startsWith('#') ? editHashtagInput : `#${editHashtagInput}`;
            if (!editHashtags.includes(tag)) {
                setEditHashtags([...editHashtags, tag]);
            }
            setEditHashtagInput('');
        }
    };

    const handleNewFilesChange = useCallback((e) => {
        const incoming = Array.from(e.target.files || []);
        setNewFiles(prev => {
            const existingKeys = new Set(prev.map(f => `${f.name}-${f.size}-${f.lastModified}`));
            const merged = [...prev];
            for (const file of incoming) {
                const key = `${file.name}-${file.size}-${file.lastModified}`;
                if (!existingKeys.has(key)) {
                    existingKeys.add(key);
                    merged.push(file);
                }
            }
            return merged;
        });
        e.target.value = '';
    }, []);

    const removeNewFile = (name) => {
        setNewFiles(newFiles.filter(f => f.name !== name));
    };

    const handleEditFilesChange = (e) => {
        const incoming = Array.from(e.target.files || []);
        setNewEditFiles(prev => {
            const existingKeys = new Set(prev.map(f => `${f.name}-${f.size}-${f.lastModified}`));
            const merged = [...prev];
            for (const file of incoming) {
                const key = `${file.name}-${file.size}-${file.lastModified}`;
                if (!existingKeys.has(key)) {
                    existingKeys.add(key);
                    merged.push(file);
                }
            }
            return merged;
        });
        e.target.value = '';
    };

    const removeNewEditFile = (name) => {
        setNewEditFiles(newEditFiles.filter(f => f.name !== name));
    };

    const removeExistingAttachment = (id) => {
        setAttachmentsToRemove([...attachmentsToRemove, id]);
        setEditAttachments(editAttachments.filter(att => att.id !== id));
    };

    const addNote = async () => {
        if (searchText.trim()) {
            const newNoteData = {
                content: searchText,
                type: newNoteType,
                hashtags: currentHashtags
            };

            try {
                const savedNote = await noteService.create(newNoteData);

                // Важно: проверяем, что сервер вернул дату. 
                // Если сервер не возвращает timestamp сразу, используем ISO формат:
                const noteId = savedNote.id;
                let attachments = [];

                if (noteId && newFiles.length) {
                    const uploads = [];
                    for (const file of newFiles) {
                        uploads.push(noteService.uploadAttachment(noteId, file));
                    }
                    attachments = await Promise.all(uploads);
                }

                const noteToAdd = {
                    ...savedNote,
                    timestamp: savedNote.timestamp || new Date().toISOString(),
                    attachments
                };

                setNotes([noteToAdd, ...notes]);
                setSearchText('');
                setCurrentHashtags([]);
                setNewFiles([]);
            } catch (err) {
                console.error("Ошибка при добавлении:", err);
            }
        }
    };

    const startEdit = useCallback((note) => {
        setEditingId(note.id);
        setEditContent(note.content);
        setEditType(note.type);
        setEditHashtags(note.hashtags || []);
        setEditHashtagInput('');
        setEditAttachments(note.attachments || []);
        setNewEditFiles([]);
        setAttachmentsToRemove([]);
    }, []);

    const saveEdit = async () => {
        const updatedData = {
            content: editContent,
            type: editType,
            hashtags: editHashtags
        };

        await noteService.update(editingId, updatedData);

        let finalAttachments = [...editAttachments];

        if (attachmentsToRemove.length) {
            for (const id of attachmentsToRemove) {
                await noteService.deleteAttachment(editingId, id);
            }
            finalAttachments = finalAttachments.filter(att => !attachmentsToRemove.includes(att.id));
        }

        if (newEditFiles.length) {
            const uploads = [];
            for (const file of newEditFiles) {
                uploads.push(noteService.uploadAttachment(editingId, file));
            }
            const uploaded = await Promise.all(uploads);
            finalAttachments = [...finalAttachments, ...uploaded];
        }

        // Обновляем локальный стейт, чтобы не перезагружать всё
        setNotes(notes.map(note =>
            note.id === editingId
                ? { ...note, ...updatedData, attachments: finalAttachments }
                : note
        ));
        setEditingId(null);
        setNewEditFiles([]);
        setAttachmentsToRemove([]);
        setEditAttachments([]);
    };

    const deleteNote = useCallback(async (id) => {
        await noteService.delete(id);
        setNotes(prev => prev.filter(n => n.id !== id));
    }, []);

    const filteredNotes = useMemo(() => {
        const needle = deferredSearchText.trim().toLowerCase();
        if (!needle) return notes;
        return notes.filter(note => {
            const matchesText = note.content.toLowerCase().includes(needle);
            const matchesHashtag = note.hashtags && note.hashtags.some(tag =>
                tag.toLowerCase().includes(needle)
            );
            return matchesText || matchesHashtag;
        });
    }, [notes, deferredSearchText]);

    const dateFormatter = useMemo(() => new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }), []);

    const formatDate = useCallback((dateString) => {
        if (!dateString) return "";

        const date = new Date(dateString);

        // Проверка на валидность даты
        if (isNaN(date.getTime())) {
            return dateString; // возвращаем как есть, если это не дата
        }

        return dateFormatter.format(date);
    }, [dateFormatter]);

    const formatFileSize = useCallback((bytes) => {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        const value = bytes / Math.pow(1024, i);
        return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
    }, []);

    const handleReorder = async (newOrder) => {
        // 1. Сначала обновляем локальный стейт для мгновенного отклика UI
        setNotes(newOrder);

        // 2. Отправляем новый порядок на бэкенд
        try {
            const noteIds = newOrder.map(note => note.id);
            await noteService.reorder(noteIds);
        } catch (err) {
            console.error("Не удалось сохранить порядок", err);
        }
    };

    if (loading) return <div className="text-white text-center mt-20">Загрузка...</div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
            <div className="max-w-4xl mx-auto relative">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20 mt-12"
                >
                    <div className='flex items-center justify-between mb-8'>
                        <h1 className="text-2xl font-bold text-white text-center">📝 Мои Заметки</h1>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-xl border border-red-500/20 transition-all hover:scale-105 active:scale-95"
                                title="Выйти из аккаунта"
                            >
                                <LogOut size={18} />
                                <span className="font-medium">Выйти</span>
                            </button>
                        </div>
                    </div>

                    {/* ВЕРХНЯЯ ПАНЕЛЬ */}
                    <div className="space-y-4 mb-8">
                        <div className="flex gap-2 mb-3">
                            <button onClick={() => setNewNoteType('text')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${newNoteType === 'text' ? 'bg-purple-600 text-white scale-105' : 'bg-white/10 text-gray-300'}`}>
                                <FileText size={16} /> Текст
                            </button>
                            <button onClick={() => setNewNoteType('code')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${newNoteType === 'code' ? 'bg-purple-600 text-white scale-105' : 'bg-white/10 text-gray-300'}`}>
                                <Code size={16} /> Код
                            </button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-4 top-4 text-gray-400" size={20} />
                            <textarea
                                ref={inputRef}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.ctrlKey && !editingId) {
                                        e.preventDefault();
                                        addNote();
                                    }
                                }}
                                onInput={autoSizeInput}
                                rows={1}
                                placeholder="Введите текст или поиск... (Ctrl + Enter — добавить)"
                                className="w-full pl-12 pr-4 py-4 bg-white/20 border border-white/30 rounded-2xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all min-h-[48px] max-h-[240px] resize-y overflow-y-auto scrollbar-styled"
                            />
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative w-[200px]">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    value={hashtagInput}
                                    onChange={(e) => setHashtagInput(e.target.value)}
                                    onKeyPress={addHashtagMain}
                                    placeholder="Хештег..."
                                    className="w-full pl-9 pr-3 py-2 bg-white/20 border border-white/30 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                            <AnimatePresence>
                                {currentHashtags.map((tag) => (
                                    <motion.span
                                        key={tag}
                                        initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/50 border border-purple-400/60 rounded-full text-sm text-white"
                                    >
                                        {tag}
                                        <button onClick={() => setCurrentHashtags(currentHashtags.filter(t => t !== tag))}><X size={14} /></button>
                                    </motion.span>
                                ))}
                            </AnimatePresence>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-purple-100">
                                <Paperclip size={16} />
                                <span>Прикрепить файлы</span>
                            </div>
                            {newFiles.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {newFiles.map(file => (
                                        <span key={file.name} className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-sm text-white">
                                            {file.name}
                                            <button onClick={() => removeNewFile(file.name)} className="text-red-200 hover:text-red-100">
                                                <X size={14} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <input
                                type="file"
                                multiple
                                onChange={handleNewFilesChange}
                                className="text-sm text-white file:mr-3 file:rounded-md file:border-none file:bg-purple-600 file:px-3 file:py-1 file:text-white hover:file:bg-purple-700"
                            />
                        </div>

                        {searchText && !editingId && (
                            <motion.button
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                onClick={addNote}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-2xl font-medium shadow-lg"
                            >
                                Добавить заметку
                            </motion.button>
                        )}
                    </div>

                    {/* СПИСОК ЗАМЕТОК */}
                    <Reorder.Group axis="y" values={notes} onReorder={handleReorder} className="space-y-4">
                        <AnimatePresence mode="popLayout">
                            {filteredNotes.map(note => {
                                const isEditing = editingId === note.id;
                                return (
                                    <DraggableNote
                                        key={note.id}
                                        note={note}
                                        isEditing={isEditing}
                                        editType={isEditing ? editType : 'text'}
                                        editContent={isEditing ? editContent : ''}
                                        editHashtags={isEditing ? editHashtags : EMPTY_ARRAY}
                                        editHashtagInput={isEditing ? editHashtagInput : ''}
                                        setEditType={setEditType}
                                        setEditContent={setEditContent}
                                        setEditHashtags={setEditHashtags}
                                        setEditHashtagInput={setEditHashtagInput}
                                        startEdit={startEdit}
                                        deleteNote={deleteNote}
                                        saveEdit={isEditing ? saveEdit : undefined}
                                        formatDate={formatDate}
                                        setEditingId={setEditingId}
                                        addHashtagEdit={isEditing ? addHashtagEdit : undefined}
                                        setSearchText={setSearchText}
                                        formatFileSize={formatFileSize}
                                        editAttachments={isEditing ? editAttachments : EMPTY_ARRAY}
                                        newEditFiles={isEditing ? newEditFiles : EMPTY_ARRAY}
                                        removeExistingAttachment={isEditing ? removeExistingAttachment : undefined}
                                        removeNewEditFile={isEditing ? removeNewEditFile : undefined}
                                        handleEditFilesChange={isEditing ? handleEditFilesChange : undefined}
                                    />
                                );
                            })}
                        </AnimatePresence>
                    </Reorder.Group>
                    {hasMore && <div ref={loadMoreRef} className="h-6" />}
                    {loadingMore && (
                        <div className="text-center text-sm text-purple-100 py-4">Loading more...</div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
