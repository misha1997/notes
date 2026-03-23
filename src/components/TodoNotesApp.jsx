import React, { useState, useEffect, forwardRef, useRef, useCallback, useMemo, useDeferredValue, memo } from 'react';
import { Search, Trash2, Edit2, Save, X, Code, FileText, Hash, GripVertical, LogOut, Copy, Paperclip, Download, Sparkles, Plus } from 'lucide-react';
import { motion, Reorder, AnimatePresence, useDragControls } from 'framer-motion';
import { noteService } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Цветовые схемы для хештегов (градиенты)
const TAG_COLORS = [
    'from-cyan-500/30 to-blue-500/30 border-cyan-400/40 text-cyan-300',
    'from-purple-500/30 to-pink-500/30 border-purple-400/40 text-purple-300',
    'from-emerald-500/30 to-teal-500/30 border-emerald-400/40 text-emerald-300',
    'from-amber-500/30 to-orange-500/30 border-amber-400/40 text-amber-300',
    'from-rose-500/30 to-red-500/30 border-rose-400/40 text-rose-300',
    'from-violet-500/30 to-indigo-500/30 border-violet-400/40 text-violet-300',
    'from-sky-500/30 to-cyan-500/30 border-sky-400/40 text-sky-300',
    'from-fuchsia-500/30 to-purple-500/30 border-fuchsia-400/40 text-fuchsia-300',
];

// Функция получения цвета для тега (псевдо-случайное на основе имени)
const getTagColor = (tag) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
};

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
                    className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 break-all transition-colors"
                >
                    {part.value}
                </a>
            );
        }
        return <span key={`text-${index}`}>{part.value}</span>;
    });

// Компонент облака хештегов с подсказками
const HashtagCloud = memo(function HashtagCloud({
    availableTags,
    currentTags,
    inputValue,
    onTagClick,
    maxVisible = 3
}) {
    const filteredTags = useMemo(() => {
        const input = inputValue.trim().toLowerCase();
        if (!input) return []; // Не показываем, если нет ввода
        return availableTags
            .filter(tag => !currentTags.includes(tag))
            .filter(tag => tag.toLowerCase().includes(input))
            .slice(0, maxVisible);
    }, [availableTags, currentTags, inputValue, maxVisible]);

    if (filteredTags.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2 mt-2"
        >
            <AnimatePresence mode="popLayout">
                {filteredTags.map((tag) => (
                    <motion.button
                        key={tag}
                        layout
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onTagClick(tag)}
                        className={`px-3 py-1.5 bg-gradient-to-r ${getTagColor(tag)} border rounded-full text-sm font-medium transition-all hover:shadow-lg hover:shadow-cyan-500/20 group`}
                    >
                        <span className="flex items-center gap-1.5">
                            <Plus size={14} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                            {tag}
                        </span>
                    </motion.button>
                ))}
            </AnimatePresence>
        </motion.div>
    );
});

// Компонент отображения выбранных хештегов с цветами
const SelectedHashtags = memo(function SelectedHashtags({ tags, onRemove }) {
    return (
        <AnimatePresence mode="popLayout">
            {tags.map((tag) => (
                <motion.span
                    key={tag}
                    layout
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    whileHover={{ scale: 1.02 }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r ${getTagColor(tag)} border rounded-full text-sm`}
                >
                    {tag}
                    <button
                        onClick={() => onRemove(tag)}
                        className="opacity-70 hover:opacity-100 hover:bg-white/10 rounded-full p-0.5 transition-all"
                    >
                        <X size={14} />
                    </button>
                </motion.span>
            ))}
        </AnimatePresence>
    );
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
        handleEditFilesChange,
        uniqueHashtags
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
                <pre className="text-cyan-100 whitespace-pre-wrap break-words font-mono text-sm bg-slate-950/80 p-4 rounded-xl border border-cyan-500/20 shadow-inner overflow-x-auto">
                    {note.content}
                </pre>
            );
        }
        return <div className="text-slate-200 whitespace-pre-wrap break-words leading-relaxed">{renderLinkedText(note.content)}</div>;
    }, [note.type, note.content]);

    return (
        <Reorder.Item
            key={note.id}
            value={note}
            dragListener={false}
            dragControls={dragControls}
            ref={ref}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="group relative"
        >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative glass rounded-2xl p-5 border border-slate-700/50 hover:border-cyan-500/30 transition-all duration-300 card-hover">
                <div
                    className="absolute left-3 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onPointerDown={(e) => {
                        e.preventDefault();
                        dragControls.start(e);
                    }}
                >
                    <GripVertical className="text-slate-500" size={20} />
                </div>

                {isEditing ? (
                    <div className="space-y-4 ml-8">
                        <div className="flex gap-3">
                            <button
                                onClick={() => setEditType('text')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${editType === 'text' ? 'btn-gradient text-white' : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-cyan-500/50'}`}
                            >
                                <FileText size={16} /> Текст
                            </button>
                            <button
                                onClick={() => setEditType('code')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${editType === 'code' ? 'btn-gradient text-white' : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-cyan-500/50'}`}
                            >
                                <Code size={16} /> Код
                            </button>
                        </div>

                        <textarea
                            ref={editAreaRef}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onInput={autoSizeEdit}
                            rows={1}
                            className={`w-full p-4 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)] min-h-[100px] max-h-[300px] resize-y overflow-y-auto scrollbar-styled transition-all ${editType === 'code' ? 'font-mono text-sm' : ''}`}
                        />

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="relative">
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                    <input
                                        type="text"
                                        value={editHashtagInput}
                                        onChange={(e) => setEditHashtagInput(e.target.value)}
                                        onKeyPress={addHashtagEdit}
                                        placeholder="Добавить тег..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-all"
                                    />
                                </div>
                                <SelectedHashtags
                                    tags={editHashtags}
                                    onRemove={(tag) => setEditHashtags(editHashtags.filter(t => t !== tag))}
                                />
                            </div>
                            <HashtagCloud
                                availableTags={uniqueHashtags}
                                currentTags={editHashtags}
                                inputValue={editHashtagInput}
                                onTagClick={(tag) => {
                                    if (!editHashtags.includes(tag)) {
                                        setEditHashtags([...editHashtags, tag]);
                                        setEditHashtagInput('');
                                    }
                                }}
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <Paperclip size={16} />
                                <span>Вложения</span>
                            </div>
                            {editAttachments.length > 0 && (
                                <div className="space-y-2">
                                    {editAttachments.map(att => (
                                        <div key={att.id} className="flex items-center justify-between glass rounded-xl px-4 py-3 text-sm text-slate-300 border border-slate-700/50">
                                            <a href={getAttachmentUrl(att)} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-cyan-300 min-w-0">
                                                <Download size={16} className="text-cyan-500" />
                                                <span className="truncate">{att.originalName || att.filename}</span>
                                                <span className="text-xs text-slate-500">{formatFileSize(att.size)}</span>
                                            </a>
                                            <button onClick={() => removeExistingAttachment(att.id)} className="text-slate-500 hover:text-red-400 flex-shrink-0 ml-2">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {newEditFiles.length > 0 && (
                                <div className="space-y-2">
                                    {newEditFiles.map(file => (
                                        <div key={file.name} className="flex items-center justify-between bg-slate-800/50 rounded-xl px-4 py-2.5 text-sm text-slate-300">
                                            <span className="truncate">{file.name}</span>
                                            <button onClick={() => removeNewEditFile(file.name)} className="text-slate-500 hover:text-red-400">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30 cursor-pointer transition-all">
                                <Plus size={16} />
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
                            <button onClick={saveEdit} className="btn-gradient px-6 py-2.5 rounded-xl text-white text-sm font-medium flex items-center gap-2 transition-all">
                                <Save size={16} /> Сохранить
                            </button>
                            <button onClick={() => setEditingId(null)} className="px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700 transition-all">
                                <X size={16} /> Отмена
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="ml-8">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${note.type === 'code' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                    {note.type === 'code' ? <Code size={16} /> : <FileText size={16} />}
                                </div>
                                <span className="text-xs text-slate-500 font-medium">{formattedDate}</span>
                            </div>
                            <div className="relative flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <AnimatePresence>
                                    {copied && (
                                        <motion.span
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute right-0 -top-8 text-xs text-cyan-300 bg-slate-900/90 border border-cyan-500/30 px-3 py-1 rounded-full"
                                        >
                                            Скопировано
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                                {note.type === 'code' && (
                                    <button
                                        onClick={handleCopy}
                                        className="p-2 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 rounded-lg transition-colors"
                                        title={copied ? "Скопировано" : "Скопировать код"}
                                    >
                                        <Copy size={18} />
                                    </button>
                                )}
                                <button onClick={() => startEdit(note)} className="p-2 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 rounded-lg transition-colors" title="Редактировать">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => deleteNote(note.id)} className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors" title="Удалить">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="text-slate-200 leading-relaxed">{renderedBody}</div>

                        {note.hashtags?.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mt-4">
                                {note.hashtags?.map(tag => (
                                    <motion.span
                                        key={tag}
                                        whileHover={{ scale: 1.05 }}
                                        onClick={() => setSearchText(tag)}
                                        className={`px-3 py-1 bg-gradient-to-r ${getTagColor(tag)} border rounded-full text-sm cursor-pointer transition-all hover:shadow-lg hover:shadow-cyan-500/10`}
                                    >
                                        {tag}
                                    </motion.span>
                                ))}
                            </div>
                        ) : null}

                        {note.attachments?.length > 0 ? (
                            <div className="mt-4 space-y-2">
                                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
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
                                            className="group flex items-center justify-between rounded-xl glass border border-slate-700/50 px-4 py-3 text-sm text-slate-300 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Download size={16} className="text-cyan-500" />
                                                <span className="truncate">{att.originalName || att.filename}</span>
                                            </div>
                                            <span className="text-xs text-slate-500">{formatFileSize(att.size)}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
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

    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const deferredSearchText = useDeferredValue(searchText);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const [newNoteType, setNewNoteType] = useState('text');
    const [hashtagInput, setHashtagInput] = useState('');
    const [currentHashtags, setCurrentHashtags] = useState([]);
    const [newFiles, setNewFiles] = useState([]);

    // Фильтрация по хештегам
    const [selectedFilterTags, setSelectedFilterTags] = useState([]);

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
            const existingKeys = new Set(prev.map(f => `${f.name}-${f.size}-${file.lastModified}`));
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

    // Уникальные хештеги для сайдбара
    const uniqueHashtags = useMemo(() => {
        const tags = new Set();
        notes.forEach(note => {
            if (note.hashtags?.length) {
                note.hashtags.forEach(tag => tags.add(tag));
            }
        });
        return Array.from(tags).sort();
    }, [notes]);

    // Фильтрация заметок
    const filteredNotes = useMemo(() => {
        let filtered = notes;

        // Фильтр по поисковому запросу
        const needle = deferredSearchText.trim().toLowerCase();
        if (needle) {
            filtered = filtered.filter(note => {
                const matchesText = note.content.toLowerCase().includes(needle);
                const matchesHashtag = note.hashtags && note.hashtags.some(tag =>
                    tag.toLowerCase().includes(needle)
                );
                return matchesText || matchesHashtag;
            });
        }

        // Фильтр по выбранным хештегам
        if (selectedFilterTags.length > 0) {
            filtered = filtered.filter(note =>
                selectedFilterTags.every(tag =>
                    note.hashtags && note.hashtags.includes(tag)
                )
            );
        }

        return filtered;
    }, [notes, deferredSearchText, selectedFilterTags]);

    const toggleFilterTag = (tag) => {
        setSelectedFilterTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    };

    const clearFilterTags = () => {
        setSelectedFilterTags([]);
    };

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
        if (isNaN(date.getTime())) {
            return dateString;
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
        setNotes(newOrder);
        try {
            const noteIds = newOrder.map(note => note.id);
            await noteService.reorder(noteIds);
        } catch (err) {
            console.error("Не удалось сохранить порядок", err);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
                <Sparkles className="text-cyan-400" size={40} />
            </motion.div>
        </div>
    );

    return (
        <div className="min-h-screen p-4 sm:p-8">
            <div className="max-w-7xl mx-auto flex gap-6">
                {/* Main Content */}
                <div className="flex-1 min-w-0 order-1">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass rounded-3xl p-6 sm:p-8 border border-slate-700/50 neon-shadow"
                    >
                        {/* Toolbar */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-cyan-500/10 rounded-xl">
                                    <Sparkles className="text-cyan-400" size={20} />
                                </div>
                                <span className="text-slate-400 text-sm">{filteredNotes.length} заметок</span>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/30 transition-all"
                            >
                                <LogOut size={18} />
                                <span>Выйти</span>
                            </button>
                        </div>

                        {/* Create Note Form */}
                        <div className="space-y-4 mb-8">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setNewNoteType('text')}
                                    className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${newNoteType === 'text' ? 'btn-gradient text-white' : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-cyan-500/30'}`}
                                >
                                    <FileText size={18} /> Текст
                                </button>
                                <button
                                    onClick={() => setNewNoteType('code')}
                                    className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${newNoteType === 'code' ? 'btn-gradient text-white' : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-cyan-500/30'}`}
                                >
                                    <Code size={18} /> Код
                                </button>
                            </div>

                            <div className="relative group">
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
                                    placeholder="Введите текст заметки... (Ctrl + Enter — добавить)"
                                    className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_30px_rgba(6,182,212,0.15)] min-h-[60px] max-h-[240px] resize-y overflow-y-auto scrollbar-styled text-base transition-all"
                                />
                                <Search className="absolute right-4 top-4 text-slate-600" size={20} />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                        <input
                                            type="text"
                                            value={hashtagInput}
                                            onChange={(e) => setHashtagInput(e.target.value)}
                                            onKeyPress={addHashtagMain}
                                            placeholder="Добавить тег..."
                                            className="w-full sm:w-auto pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                                        />
                                    </div>
                                    <SelectedHashtags
                                        tags={currentHashtags}
                                        onRemove={(tag) => setCurrentHashtags(currentHashtags.filter(t => t !== tag))}
                                    />
                                </div>
                                <HashtagCloud
                                    availableTags={uniqueHashtags}
                                    currentTags={currentHashtags}
                                    inputValue={hashtagInput}
                                    onTagClick={(tag) => {
                                        if (!currentHashtags.includes(tag)) {
                                            setCurrentHashtags([...currentHashtags, tag]);
                                            setHashtagInput('');
                                        }
                                    }}
                                />
                            </div>

                            {newFiles.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {newFiles.map(file => (
                                        <span key={file.name} className="flex items-center gap-2 glass rounded-xl px-3 py-2 text-sm text-slate-300 border border-slate-700/50">
                                            <Paperclip size={14} className="text-cyan-500" />
                                            <span className="truncate max-w-[200px]">{file.name}</span>
                                            <button onClick={() => removeNewFile(file.name)} className="text-slate-500 hover:text-red-400">
                                                <X size={14} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center gap-4">
                                <label className="inline-flex items-center gap-2 px-4 py-2.5 glass rounded-xl text-sm text-slate-400 hover:text-cyan-300 border border-slate-700/50 hover:border-cyan-500/30 cursor-pointer transition-all">
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

                            {searchText && !editingId && (
                                <motion.button
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={addNote}
                                    className="w-full btn-gradient py-4 rounded-2xl font-semibold text-white shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
                                >
                                    <Plus size={20} />
                                    Добавить заметку
                                </motion.button>
                            )}
                        </div>

                        {/* Notes List */}
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
                                            uniqueHashtags={uniqueHashtags}
                                        />
                                    );
                                })}
                            </AnimatePresence>
                        </Reorder.Group>

                        {hasMore && <div ref={loadMoreRef} className="h-6" />}
                        {loadingMore && (
                            <div className="text-center text-sm text-slate-500 py-4 flex items-center justify-center gap-2">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                                    <Sparkles size={16} className="text-cyan-400" />
                                </motion.div>
                                Загрузка...
                            </div>
                        )}
                    </motion.div>

                    {/* Footer */}
                    <p className="text-center text-slate-600 text-sm mt-8">
                        Notes App &copy; {new Date().getFullYear()}
                    </p>
                </div>{/* Close main content */}

                {/* Sidebar with Hashtags - Desktop only, Right Side */}
                <motion.aside
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="hidden lg:block w-72 flex-shrink-0 order-2"
                >
                    <div className="glass p-5 sticky top-8 max-h-[calc(100vh-4rem)] overflow-hidden rounded-3xl flex flex-col border border-slate-700/50 neon-shadow">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/50">
                            <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                                <div className="p-1.5 bg-cyan-500/10 rounded-lg">
                                    <Hash size={16} className="text-cyan-400" />
                                </div>
                                <span>Теги</span>
                                <span className="text-sm text-slate-500 font-normal">({uniqueHashtags.length})</span>
                            </h2>
                            {selectedFilterTags.length > 0 && (
                                <button
                                    onClick={clearFilterTags}
                                    className="text-xs px-2 py-1 rounded-lg bg-slate-800/50 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                                >
                                    Сбросить
                                </button>
                            )}
                        </div>

                        {/* Selected Tags Display */}
                        {selectedFilterTags.length > 0 && (
                            <div className="mb-4 p-3 bg-cyan-500/5 rounded-xl border border-cyan-500/20">
                                <p className="text-xs text-slate-500 mb-2">Активные фильтры:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedFilterTags.map(tag => (
                                        <motion.span
                                            key={tag}
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r ${getTagColor(tag)} border rounded-lg text-xs`}
                                        >
                                            {tag}
                                            <button
                                                onClick={() => toggleFilterTag(tag)}
                                                className="opacity-70 hover:opacity-100 hover:bg-white/10 rounded p-0.5 ml-0.5 transition-all"
                                            >
                                                <X size={12} />
                                            </button>
                                        </motion.span>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Найдено: <span className="text-cyan-400 font-medium">{filteredNotes.length}</span> заметок
                                </p>
                            </div>
                        )}

                        {/* Tags List with Scroll */}
                        <div className="flex-1 overflow-y-auto scrollbar-styled -mx-2 px-2">
                            {uniqueHashtags.length > 0 ? (
                                <div className="space-y-2">
                                    {uniqueHashtags.map(tag => {
                                        const isSelected = selectedFilterTags.includes(tag);
                                        const count = notes.filter(n => n.hashtags?.includes(tag)).length;
                                        return (
                                            <button
                                                key={tag}
                                                onClick={() => toggleFilterTag(tag)}
                                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group border ${
                                                    isSelected
                                                        ? `bg-gradient-to-r ${getTagColor(tag)} shadow-lg shadow-cyan-500/10`
                                                        : 'bg-slate-800/30 border-transparent text-slate-400 hover:bg-slate-800/60 hover:border-slate-600'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Hash size={14} className={`shrink-0 ${isSelected ? 'opacity-100' : 'text-slate-500 group-hover:text-slate-400'}`} />
                                                    <span className="truncate">{tag}</span>
                                                </div>
                                                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                                                    isSelected
                                                        ? 'bg-white/20'
                                                        : 'bg-slate-700/50 text-slate-500'
                                                }`}>
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="p-3 bg-slate-800/30 rounded-xl inline-block mb-3">
                                        <Hash size={24} className="text-slate-600" />
                                    </div>
                                    <p className="text-sm text-slate-500">Нет тегов</p>
                                    <p className="text-xs text-slate-600 mt-1">Добавьте теги к заметкам</p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.aside>
            </div>{/* Close flex container */}
        </div>
    );
}
