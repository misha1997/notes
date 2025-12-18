import React, { useState, useEffect } from 'react';
import { Search, Trash2, Edit2, Save, X, Code, FileText, Hash, GripVertical, LogOut } from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { noteService } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function TodoNotesApp() {
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState([]);
    const [searchText, setSearchText] = useState('');

    const { logout, user } = useAuth(); // Получаем функцию выхода и данные юзера
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Состояния для верхней формы (создание)
    const [newNoteType, setNewNoteType] = useState('text');
    const [hashtagInput, setHashtagInput] = useState('');
    const [currentHashtags, setCurrentHashtags] = useState([]);

    // Состояния для редактирования
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [editType, setEditType] = useState('text');
    const [editHashtags, setEditHashtags] = useState([]);
    const [editHashtagInput, setEditHashtagInput] = useState('');

    useEffect(() => {
        loadNotes();
    }, []);

    const loadNotes = async () => {
        setLoading(true);
        const data = await noteService.getAll();
        setNotes(data);
        setLoading(false);
    };

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
                const noteToAdd = {
                    ...savedNote,
                    timestamp: savedNote.timestamp || new Date().toISOString()
                };

                setNotes([noteToAdd, ...notes]);
                setSearchText('');
                setCurrentHashtags([]);
            } catch (err) {
                console.error("Ошибка при добавлении:", err);
            }
        }
    };

    const startEdit = (note) => {
        setEditingId(note.id);
        setEditContent(note.content);
        setEditType(note.type);
        setEditHashtags(note.hashtags || []);
        setEditHashtagInput('');
    };

    const saveEdit = async () => {
        const updatedData = {
            content: editContent,
            type: editType,
            hashtags: editHashtags
        };

        await noteService.update(editingId, updatedData);

        // Обновляем локальный стейт, чтобы не перезагружать всё
        setNotes(notes.map(note =>
            note.id === editingId
                ? { ...note, ...updatedData }
                : note
        ));
        setEditingId(null);
    };

    const deleteNote = async (id) => {
        await noteService.delete(id);
        setNotes(notes.filter(n => n.id !== id));
    };

    const filteredNotes = notes.filter(note => {
        const matchesText = note.content.toLowerCase().includes(searchText.toLowerCase());
        const matchesHashtag = note.hashtags && note.hashtags.some(tag =>
            tag.toLowerCase().includes(searchText.toLowerCase())
        );
        return matchesText || matchesHashtag;
    });

    const formatDate = (dateString) => {
        if (!dateString) return "";

        const date = new Date(dateString);

        // Проверка на валидность даты
        if (isNaN(date.getTime())) {
            return dateString; // возвращаем как есть, если это не дата
        }

        return new Intl.DateTimeFormat('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

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
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && !editingId && addNote()}
                                placeholder="Введите текст или поиск..."
                                className="w-full pl-12 pr-4 py-4 bg-white/20 border border-white/30 rounded-2xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
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
                            {filteredNotes.map(note => (
                                <Reorder.Item
                                    key={note.id}
                                    value={note}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 hover:border-purple-400 transition-colors group relative"
                                >
                                    <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1">
                                        <GripVertical className="text-gray-400" size={20} />
                                    </div>

                                    {editingId === note.id ? (
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
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                className={`w-full p-4 bg-black/30 border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px] ${editType === 'code' ? 'font-mono text-sm' : ''}`}
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
                                                    <span className="text-xs text-gray-400">{formatDate(note.timestamp)}</span>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                    <button onClick={() => startEdit(note)} className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-full transition-colors" title="Редактировать">
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button onClick={() => deleteNote(note.id)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-full transition-colors" title="Удалить">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                            <pre className={`text-white whitespace-pre-wrap break-words ${note.type === 'code' ? 'font-mono text-sm bg-black/20 p-3 rounded-lg border border-white/5' : ''}`}>{note.content}</pre>
                                            {
                                                note.hashtags.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2 mt-4">
                                                        {note.hashtags?.map(tag => (
                                                            <span key={tag} onClick={() => setSearchText(tag)} className="px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/50 rounded-full text-xs text-purple-200 cursor-pointer transition-colors">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : ''
                                            }
                                        </div>
                                    )}
                                </Reorder.Item>
                            ))}
                        </AnimatePresence>
                    </Reorder.Group>
                </motion.div>
            </div>
        </div>
    );
}