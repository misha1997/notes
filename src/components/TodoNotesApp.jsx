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
                    className="text-gray-300 underline underline-offset-2 hover:text-gray-100 break-all"
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
                <pre className="text-gray-200 whitespace-pre-wrap break-words font-mono text-sm bg-[#0f0f0f] p-3 rounded-lg border border-[#2a2a2a]">
                    {note.content}
                </pre>
            );
        }
        return <div className="text-gray-200 whitespace-pre-wrap break-words">{renderLinkedText(note.content)}</div>;
    }, [note.type, note.content]);

    return (
        <Reorder.Item
            key={note.id}
            value={note}
            dragListener={false}
            dragControls={dragControls}
            ref={ref}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#1a1a1a] rounded-xl p-4 sm:p-5 border border-[#2a2a2a] hover:border-[#404040] transition-colors group relative"
        >
            <div
                className="absolute left-2 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing p-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                onPointerDown={(e) => {
                    e.preventDefault();
                    dragControls.start(e);
                }}
            >
                <GripVertical className="text-[#666666]" size={20} />
            </div>

            {isEditing ? (
                <div className="space-y-4 ml-6 sm:ml-8">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setEditType('text')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all min-h-[40px] ${editType === 'text' ? 'bg-gray-200 text-gray-900 font-medium' : 'bg-[#262626] text-gray-400 border border-[#404040]'}`}
                        >
                            <FileText size={14} /> Текст
                        </button>
                        <button
                            onClick={() => setEditType('code')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all min-h-[40px] ${editType === 'code' ? 'bg-gray-200 text-gray-900 font-medium' : 'bg-[#262626] text-gray-400 border border-[#404040]'}`}
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
                        className={`w-full p-4 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-gray-100 focus:outline-none focus:border-[#404040] min-h-[100px] max-h-[260px] resize-y overflow-y-auto scrollbar-styled ${editType === 'code' ? 'font-mono text-sm' : ''}`}
                    />

                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative w-full sm:w-[180px]">
                            <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                            <input
                                type="text"
                                value={editHashtagInput}
                                onChange={(e) => setEditHashtagInput(e.target.value)}
                                onKeyPress={addHashtagEdit}
                                placeholder="Добавить тег..."
                                className="w-full pl-8 pr-3 py-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#404040] min-h-[40px]"
                            />
                        </div>
                        {editHashtags.map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#262626] border border-[#404040] rounded-full text-xs text-gray-300">
                                {tag}
                                <button onClick={() => setEditHashtags(editHashtags.filter(t => t !== tag))} className="text-gray-500 hover:text-gray-300">
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Paperclip size={14} />
                            <span>Вложения</span>
                        </div>
                        {editAttachments.length > 0 && (
                            <div className="space-y-2">
                                {editAttachments.map(att => (
                                    <div key={att.id} className="flex items-center justify-between bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-gray-200">
                                        <a href={getAttachmentUrl(att)} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-gray-100 min-w-0">
                                            <Download size={14} className="flex-shrink-0" />
                                            <span className="truncate">{att.originalName || att.filename}</span>
                                            <span className="text-xs text-gray-500 flex-shrink-0">{formatFileSize(att.size)}</span>
                                        </a>
                                        <button onClick={() => removeExistingAttachment(att.id)} className="text-gray-500 hover:text-red-400 flex-shrink-0 ml-2">
                                            Удалить
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {newEditFiles.length > 0 && (
                            <div className="space-y-2">
                                {newEditFiles.map(file => (
                                    <div key={file.name} className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-300">
                                        <span className="truncate">{file.name}</span>
                                        <button onClick={() => removeNewEditFile(file.name)} className="text-gray-500 hover:text-red-400 flex-shrink-0">
                                            Удалить
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:border-[#404040] cursor-pointer transition-colors">
                            <span>Выбрать файл</span>
                            <input
                                type="file"
                                multiple
                                onChange={handleEditFilesChange}
                                className="hidden"
                            />
                        </label>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button onClick={saveEdit} className="bg-gray-100 hover:bg-white text-gray-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors min-h-[44px]">
                            <Save size={14} /> Сохранить
                        </button>
                        <button onClick={() => setEditingId(null)} className="bg-transparent hover:bg-[#262626] text-gray-400 hover:text-gray-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors border border-[#404040] min-h-[44px]">
                            <X size={14} /> Отмена
                        </button>
                    </div>
                </div>
            ) : (
                <div className="ml-6 sm:ml-8">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            {note.type === 'code' ? <Code size={16} className="text-gray-500" /> : <FileText size={16} className="text-gray-500" />}
                            <span className="text-xs text-gray-500">{formattedDate}</span>
                        </div>
                        <div className="relative flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200">
                            <AnimatePresence>
                                {copied && (
                                    <motion.span
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 -top-6 text-xs text-gray-300 bg-[#262626] px-2 py-0.5 rounded"
                                    >
                                        Скопировано
                                    </motion.span>
                                )}
                            </AnimatePresence>
                            {note.type === 'code' && (
                                <button
                                    onClick={handleCopy}
                                    className="p-2.5 sm:p-2 hover:bg-[#262626] text-gray-400 hover:text-gray-200 rounded-lg transition-colors"
                                    title={copied ? "Скопировано" : "Скопировать код"}
                                >
                                    <Copy size={18} />
                                </button>
                            )}
                            <button onClick={() => startEdit(note)} className="p-2.5 sm:p-2 hover:bg-[#262626] text-gray-400 hover:text-gray-200 rounded-lg transition-colors" title="Редактировать">
                                <Edit2 size={18} />
                            </button>
                            <button onClick={() => deleteNote(note.id)} className="p-2.5 sm:p-2 hover:bg-[#262626] text-gray-400 hover:text-red-400 rounded-lg transition-colors" title="Удалить">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                    <div className="text-gray-200 leading-relaxed">{renderedBody}</div>

                    {note.hashtags?.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-4">
                            {note.hashtags?.map(tag => (
                                <span key={tag} onClick={() => setSearchText(tag)} className="px-2.5 py-1 bg-[#262626] border border-[#404040] rounded-full text-xs text-gray-300 cursor-pointer hover:bg-[#2a2a2a] hover:border-[#525252] transition-colors">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    ) : null}

                    {note.attachments?.length > 0 ? (
                        <div className="mt-4 space-y-2">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Paperclip size={14} />
                                <span>Вложения ({note.attachments.length})</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {note.attachments.map(att => (
                                    <a
                                        key={att.id}
                                        href={getAttachmentUrl(att)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="group flex items-center justify-between rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-[#404040] hover:bg-[#141414]"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Download size={14} className="text-gray-500 flex-shrink-0" />
                                            <span className="truncate">{att.originalName || att.filename}</span>
                                        </div>
                                        <span className="text-xs text-gray-500 flex-shrink-0">{formatFileSize(att.size)}</span>
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
        <div className="min-h-screen bg-[#0a0a0a] p-3 sm:p-6">
            <div className="max-w-3xl mx-auto relative">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#141414] rounded-none sm:rounded-xl shadow-none sm:shadow-2xl p-3 sm:p-6 border-0 sm:border border-[#2a2a2a] mt-0 sm:mt-8"
                >
                    <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6'>
                        <h1 className="text-xl sm:text-2xl font-semibold text-gray-100 tracking-tight">Мои заметки</h1>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button
                                onClick={handleLogout}
                                className="flex items-center justify-center gap-2 bg-transparent hover:bg-[#1f1f1f] text-gray-400 hover:text-gray-200 px-4 py-2.5 sm:py-2 rounded-lg border border-[#2a2a2a] hover:border-[#404040] transition-colors active:bg-[#1a1a1a] w-full sm:w-auto text-sm sm:text-base min-h-[44px]"
                                title="Выйти из аккаунта"
                            >
                                <LogOut size={18} />
                                <span className="font-medium">Выйти</span>
                            </button>
                        </div>
                    </div>

                    {/* ВЕРХНЯЯ ПАНЕЛЬ */}
                    <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                        <div className="flex gap-2">
                            <button onClick={() => setNewNoteType('text')} className={`flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg transition-all text-sm sm:text-base min-h-[44px] flex-1 sm:flex-none ${newNoteType === 'text' ? 'bg-gray-200 text-gray-900 font-medium' : 'bg-[#1f1f1f] text-gray-400 border border-[#2a2a2a] hover:border-[#404040]'}`}>
                                <FileText size={16} /> Текст
                            </button>
                            <button onClick={() => setNewNoteType('code')} className={`flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg transition-all text-sm sm:text-base min-h-[44px] flex-1 sm:flex-none ${newNoteType === 'code' ? 'bg-gray-200 text-gray-900 font-medium' : 'bg-[#1f1f1f] text-gray-400 border border-[#2a2a2a] hover:border-[#404040]'}`}>
                                <Code size={16} /> Код
                            </button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 sm:left-4 top-4 sm:top-4 text-gray-500" size={18} />
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
                                placeholder="Введите текст заметки..."
                                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3.5 sm:py-4 bg-[#1a1a1a] border border-[#2a2a2a] focus:border-[#525252] rounded-lg sm:rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none transition-colors min-h-[56px] sm:min-h-[48px] max-h-[200px] resize-y overflow-y-auto scrollbar-styled text-base"
                            />
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative w-full sm:w-[180px]">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                                <input
                                    type="text"
                                    value={hashtagInput}
                                    onChange={(e) => setHashtagInput(e.target.value)}
                                    onKeyPress={addHashtagMain}
                                    placeholder="Тег (Enter)"
                                    className="w-full pl-9 pr-3 py-2.5 sm:py-2 bg-[#1a1a1a] border border-[#2a2a2a] focus:border-[#525252] rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none transition-colors min-h-[44px]"
                                />
                            </div>
                            <AnimatePresence>
                                {currentHashtags.map((tag) => (
                                    <motion.span
                                        key={tag}
                                        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#262626] border border-[#404040] rounded-full text-xs sm:text-sm text-gray-300"
                                    >
                                        {tag}
                                        <button onClick={() => setCurrentHashtags(currentHashtags.filter(t => t !== tag))} className="text-gray-500 hover:text-gray-300">
                                            <X size={14} />
                                        </button>
                                    </motion.span>
                                ))}
                            </AnimatePresence>
                        </div>

                        <div className="space-y-2">
                            {newFiles.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {newFiles.map(file => (
                                        <span key={file.name} className="flex items-center justify-between gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-300">
                                            <span className="truncate max-w-[200px]">{file.name}</span>
                                            <button onClick={() => removeNewFile(file.name)} className="text-gray-500 hover:text-red-400 flex-shrink-0">
                                                <X size={14} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-400 cursor-pointer transition-colors">
                                    <Paperclip size={16} />
                                    <span>Прикрепить файл</span>
                                    <input
                                        type="file"
                                        multiple
                                        onChange={handleNewFilesChange}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                        </div>

                        {searchText && !editingId && (
                            <motion.button
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                onClick={addNote}
                                className="w-full bg-gray-100 hover:bg-white text-gray-900 py-3.5 sm:py-3 rounded-lg sm:rounded-xl font-medium transition-colors text-base min-h-[52px]"
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
