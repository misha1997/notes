import React, { useState, useEffect, forwardRef, useRef, useCallback, useMemo, memo } from 'react';
import { Trash2, Edit2, Save, X, Code, FileText, Hash, GripVertical, LogOut, Copy, Paperclip, Download, Sparkles, Plus, Check } from 'lucide-react';
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

// ============ RICH TEXT EDITOR COMPONENTS ============

// Парсинг markdown для отображения
const parseMarkdown = (text) => {
    if (!text) return [{ type: 'text', content: '' }];

    const parts = [];
    let lastIndex = 0;

    // Парсим code blocks ```...```
    const codeBlockRegex = /```(\n?)([\s\S]*?)```/g;
    const inlineCodeRegex = /`([^`]+)`/g;

    // Сначала ищем code blocks
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
        // Добавляем текст до блока
        if (match.index > lastIndex) {
            const beforeText = text.slice(lastIndex, match.index);
            // В тексте до блока ищем inline code
            parts.push(...parseInlineCode(beforeText));
        }
        // Добавляем code block
        parts.push({ type: 'code-block', content: match[2] });
        lastIndex = match.index + match[0].length;
    }

    // Добавляем оставшийся текст
    if (lastIndex < text.length) {
        parts.push(...parseInlineCode(text.slice(lastIndex)));
    }

    return parts.length ? parts : [{ type: 'text', content: text }];
};

// Парсинг inline code `...`
const parseInlineCode = (text) => {
    const parts = [];
    let lastIndex = 0;
    const inlineCodeRegex = /`([^`]+)`/g;

    let match;
    while ((match = inlineCodeRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                content: text.slice(lastIndex, match.index)
            });
        }
        parts.push({ type: 'inline-code', content: match[1] });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return parts.length ? parts : [{ type: 'text', content: text }];
};

// Компонент копируемого inline-кода
const CopyableInlineCode = memo(function CopyableInlineCode({ content }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            console.error('Не удалось скопировать', err);
        }
    }, [content]);

    return (
        <motion.code
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCopy}
            className={`px-2 py-0.5 rounded font-mono text-sm border cursor-pointer transition-colors select-none ${
                copied
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-cyan-300 border-cyan-500/20 hover:bg-slate-700 hover:border-cyan-400/40'
            }`}
            title="Кликните для копирования"
        >
            {content}
        </motion.code>
    );
});

// Компонент копируемого code block
const CopyableCodeBlock = memo(function CopyableCodeBlock({ content }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            console.error('Не удалось скопировать', err);
        }
    }, [content]);

    return (
        <div className="relative group my-1">
            <button
                onClick={handleCopy}
                className="absolute top-3 right-3 p-2 text-slate-500 hover:text-cyan-300 opacity-0 group-hover:opacity-100 transition-all"
                title="Копировать код"
            >
                {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
            </button>
            <pre className="text-cyan-100 whitespace-pre-wrap break-words font-mono text-sm bg-slate-950/80 p-4 m-0 rounded-xl border border-cyan-500/20 shadow-inner overflow-x-auto">
                {content}
            </pre>
        </div>
    );
});

// Компонент рендера markdown
const MarkdownRenderer = memo(function MarkdownRenderer({ content, onTagClick }) {
    const parts = parseMarkdown(content);

    // Фильтруем пустые части
    const filteredParts = parts.filter(part => part.content.trim() !== '');

    return (
        <div className="flex flex-col gap-1">
            {filteredParts.map((part, index) => {
                if (part.type === 'code-block') {
                    return (
                        <CopyableCodeBlock key={index} content={part.content} />
                    );
                }
                if (part.type === 'inline-code') {
                    return (
                        <CopyableInlineCode key={index} content={part.content} />
                    );
                }
                // Обычный текст с ссылками
                return (
                    <span key={index} className="text-slate-200 break-words leading-relaxed whitespace-pre-wrap">
                        {renderLinkedText(part.content)}
                    </span>
                );
            })}
        </div>
    );
});

// Тулбар для форматирования
const FormatToolbar = memo(function FormatToolbar({ textareaRef, onChange, content }) {
    const wrapSelection = (before, after = before) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.slice(start, end);

        const newText = content.slice(0, start) + before + selectedText + after + content.slice(end);
        onChange(newText);

        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + before.length + selectedText.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    const insertCodeBlock = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.slice(start, end);

        const codeBlock = selectedText
            ? `\`\`\`\n${selectedText}\n\`\`\``
            : `\`\`\`\n\n\`\`\``;

        const newText = content.slice(0, start) + codeBlock + content.slice(end);
        onChange(newText);

        setTimeout(() => {
            textarea.focus();
            const newCursorPos = selectedText
                ? start + codeBlock.length
                : start + 4;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    return (
        <div className="flex items-center gap-1.5">
            <button
                onClick={() => wrapSelection('`')}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800/80 text-slate-400 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/30 border border-transparent transition-all"
                title="Inline code"
            >
                <span className="font-mono text-sm font-bold">&lt;/&gt;</span>
            </button>
            <button
                onClick={insertCodeBlock}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800/80 text-slate-400 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/30 border border-transparent transition-all"
                title="Code block"
            >
                <Code size={16} />
            </button>
        </div>
    );
});

// Rich Text Editor компонент
const RichTextEditor = memo(function RichTextEditor({ content, onChange, placeholder = "Введите текст..." }) {
    const textareaRef = useRef(null);

    const autoSize = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
    }, []);

    useEffect(() => {
        autoSize();
    }, [content, autoSize]);

    return (
        <div className="relative bg-slate-900/50 rounded-xl border border-slate-700 focus-within:border-cyan-500/50 focus-within:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all overflow-hidden">
            {/* Тулбар */}
            <div className="flex items-center px-3 py-2 bg-slate-800/50 border-b border-slate-700/50">
                <FormatToolbar textareaRef={textareaRef} onChange={onChange} content={content} />
            </div>

            {/* Поле ввода */}
            <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => onChange(e.target.value)}
                onInput={autoSize}
                rows={3}
                placeholder={placeholder}
                className="w-full px-4 py-3 bg-transparent text-slate-100 placeholder-slate-600 focus:outline-none resize-y overflow-y-auto scrollbar-styled min-h-[100px]"
            />
        </div>
    );
});

// ============ END RICH TEXT EDITOR ============

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
        editContent,
        editHashtags,
        editHashtagInput,
        setEditContent,
        setEditHashtags,
        setEditHashtagInput,
        startEdit,
        deleteNote,
        saveEdit,
        formatDate,
        setEditingId,
        addHashtagEdit,
        toggleFilterTag,
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

    const handleCopy = useCallback(async () => {
        const text = editContent || note.content;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            console.error('Не удалось скопировать текст', err);
        }
    }, [note, editContent]);

    const formattedDate = useMemo(() => formatDate(note.timestamp), [formatDate, note.timestamp]);

    // Проверяем есть ли код в заметке
    const hasCode = useMemo(() => {
        const content = isEditing ? editContent : note.content;
        return content?.includes('```') || content?.includes('`');;
    }, [isEditing, editContent, note.content]);

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
                        <RichTextEditor content={editContent} onChange={setEditContent} />

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
                                <div className={`p-2 rounded-lg ${hasCode ? 'bg-cyan-500/10 text-cyan-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                    {hasCode ? <Code size={16} /> : <FileText size={16} />}
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
                                <button
                                    onClick={handleCopy}
                                    className="p-2 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 rounded-lg transition-colors"
                                    title="Скопировать"
                                >
                                    <Copy size={18} />
                                </button>
                                <button onClick={() => startEdit(note)} className="p-2 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 rounded-lg transition-colors" title="Редактировать">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => deleteNote(note.id)} className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors" title="Удалить">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                        <MarkdownRenderer content={note.content} />

                        {note.hashtags?.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mt-4">
                                {note.hashtags?.map(tag => (
                                    <motion.span
                                        key={tag}
                                        whileHover={{ scale: 1.05 }}
                                        onClick={() => toggleFilterTag(tag)}
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
    const loadMoreRef = useRef(null);
    const pageSize = 25;

    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Содержимое новой заметки
    const [newNoteContent, setNewNoteContent] = useState('');
    const [hashtagInput, setHashtagInput] = useState('');
    const [currentHashtags, setCurrentHashtags] = useState([]);
    const [newFiles, setNewFiles] = useState([]);

    // Фильтрация по хештегам
    const [selectedFilterTags, setSelectedFilterTags] = useState([]);

    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState('');
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
        if (newNoteContent.trim()) {
            const newNoteData = {
                content: newNoteContent,
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
                setNewNoteContent('');
                setCurrentHashtags([]);
                setNewFiles([]);
            } catch (err) {
                console.error("Ошибка при добавлении:", err);
            }
        }
    };

    const startEdit = useCallback((note) => {
        setEditingId(note.id);
        setEditContent(note.content || '');
        setEditHashtags(note.hashtags || []);
        setEditHashtagInput('');
        setEditAttachments(note.attachments || []);
        setNewEditFiles([]);
        setAttachmentsToRemove([]);
    }, []);

    const saveEdit = async () => {
        const updatedData = {
            content: editContent,
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

        // Фильтр по тексту в поле ввода заметки (поиск)
        const needle = newNoteContent.trim().toLowerCase();
        if (needle) {
            filtered = filtered.filter(note => {
                const matchesText = note.content?.toLowerCase().includes(needle);
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
    }, [notes, newNoteContent, selectedFilterTags]);

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
                            <RichTextEditor content={newNoteContent} onChange={setNewNoteContent} />

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

                            {newNoteContent.trim() && !editingId && (
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
                                            editContent={isEditing ? editContent : ''}
                                            editHashtags={isEditing ? editHashtags : EMPTY_ARRAY}
                                            editHashtagInput={isEditing ? editHashtagInput : ''}
                                            setEditContent={setEditContent}
                                            setEditHashtags={setEditHashtags}
                                            setEditHashtagInput={setEditHashtagInput}
                                            startEdit={startEdit}
                                            deleteNote={deleteNote}
                                            saveEdit={isEditing ? saveEdit : undefined}
                                            formatDate={formatDate}
                                            setEditingId={setEditingId}
                                            addHashtagEdit={isEditing ? addHashtagEdit : undefined}
                                            toggleFilterTag={toggleFilterTag}
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
