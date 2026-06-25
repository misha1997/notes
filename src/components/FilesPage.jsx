import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Files, FileText, Image, Video, Music, Code, File, Download, Search, X, Paperclip, Hash, TrendingUp, ArrowDownAZ, StickyNote, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { attachmentService, tagService } from '../api';
import AppHeader from './AppHeader';
import { getAttachmentUrl, getAttachmentFileUrl, formatFileSize, getFileIconName } from '../utils/attachments';
import { getTagColor } from '../utils/tags';

const FILE_ICONS = {
    Image,
    Video,
    Music,
    FileText,
    Code,
    File
};

export default function FilesPage() {
    const [files, setFiles] = useState([]);
    const [totalFiles, setTotalFiles] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(0);
    const [searchText, setSearchText] = useState('');

    // Лайтбокс для просмотра картинок на сайте
    const [lightboxId, setLightboxId] = useState(null);

    // Теги файлов и фильтр (как в заметках)
    const [fileTags, setFileTags] = useState([]); // [{ tag, count }] — count по файлам
    const [tagClickCounts, setTagClickCounts] = useState({});
    const [tagSearch, setTagSearch] = useState('');
    const [tagSort, setTagSort] = useState('popularity'); // 'popularity' | 'name'
    const [selectedFilterTags, setSelectedFilterTags] = useState([]);

    const loadMoreRef = useRef(null);
    const pageSize = 25;

    const refreshFileTags = useCallback(async () => {
        try {
            const [tags, clicks] = await Promise.all([
                tagService.getFileTags(),
                tagService.getClickCounts()
            ]);
            setFileTags(tags);
            setTagClickCounts(clicks || {});
        } catch (err) {
            console.error('Failed to load file tags:', err);
        }
    }, []);

    const loadFiles = useCallback(async () => {
        setLoading(true);
        const [{ attachments: data, hasMore: more }, { total }] = await Promise.all([
            attachmentService.getAll({ offset: 0, limit: pageSize }),
            attachmentService.getCount()
        ]);
        setFiles(data);
        setTotalFiles(total);
        setHasMore(more);
        setPage(1);
        setLoading(false);
        refreshFileTags();
    }, [pageSize, refreshFileTags]);

    const loadMore = useCallback(async () => {
        if (loading || loadingMore || !hasMore) return;
        setLoadingMore(true);
        const { attachments: data, hasMore: more } = await attachmentService.getAll({
            offset: page * pageSize,
            limit: pageSize
        });
        if (data.length) {
            setFiles(prev => [...prev, ...data]);
            setPage(prev => prev + 1);
        }
        setHasMore(more);
        setLoadingMore(false);
    }, [loading, loadingMore, hasMore, page, pageSize]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

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

    const toggleFilterTag = (tag) => {
        setSelectedFilterTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const clearFilterTags = () => setSelectedFilterTags([]);

    // Список тегов с поиском и сортировкой (как uniqueHashtags в TodoNotesApp)
    const visibleFileTags = useMemo(() => {
        const query = tagSearch.trim().toLowerCase().replace(/^#/, '');
        const filtered = query
            ? fileTags.filter(h => h.tag.toLowerCase().replace(/^#/, '').includes(query))
            : fileTags;
        return [...filtered].sort((a, b) => {
            if (tagSort === 'name') {
                return a.tag.localeCompare(b.tag);
            }
            // По популярности: клики → кол-во файлов → алфавит
            const clickA = tagClickCounts[a.tag] || 0;
            const clickB = tagClickCounts[b.tag] || 0;
            if (clickB !== clickA) return clickB - clickA;
            if (b.count !== a.count) return b.count - a.count;
            return a.tag.localeCompare(b.tag);
        });
    }, [fileTags, tagClickCounts, tagSearch, tagSort]);

    const search = searchText.trim().toLowerCase().replace(/^#/, '');
    const filteredFiles = files.filter((f) => {
        const name = (f.originalName || f.filename || '').toLowerCase();
        const tags = (f.hashtags || []).map(t => t.toLowerCase().replace(/^#/, ''));
        const matchesSearch = !search || name.includes(search) || tags.some(t => t.includes(search));
        const matchesTags = selectedFilterTags.length === 0 || selectedFilterTags.every(t => (f.hashtags || []).includes(t));
        return matchesSearch && matchesTags;
    });

    const isFiltering = search || selectedFilterTags.length > 0;
    const countText = isFiltering
        ? `${filteredFiles.length} из ${totalFiles} файлов`
        : `${totalFiles} файлов`;

    // Картинки в текущей выборке — для навигации в лайтбоксе
    const imageFiles = useMemo(
        () => filteredFiles.filter(f => (f.mimeType || '').startsWith('image/')),
        [filteredFiles]
    );
    const lightboxIndex = lightboxId !== null ? imageFiles.findIndex(f => f.id === lightboxId) : -1;
    const lightboxFile = lightboxIndex >= 0 ? imageFiles[lightboxIndex] : null;

    const openLightbox = (file) => setLightboxId(file.id);
    const closeLightbox = () => setLightboxId(null);
    const showPrev = () => {
        if (imageFiles.length <= 1) return;
        const prev = (lightboxIndex - 1 + imageFiles.length) % imageFiles.length;
        setLightboxId(imageFiles[prev].id);
    };
    const showNext = () => {
        if (imageFiles.length <= 1) return;
        const next = (lightboxIndex + 1) % imageFiles.length;
        setLightboxId(imageFiles[next].id);
    };

    // Клавиатура: Esc — закрыть, ←/→ — навигация
    useEffect(() => {
        if (lightboxId === null) return;
        const onKey = (e) => {
            if (e.key === 'Escape') closeLightbox();
            else if (e.key === 'ArrowLeft') showPrev();
            else if (e.key === 'ArrowRight') showNext();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightboxId, lightboxIndex, imageFiles]);

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
                        <AppHeader countText={countText} />

                        {/* Поиск по имени файла */}
                        <div className="relative mb-6">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Поиск по имени файла или тегу..."
                                className="w-full pl-10 pr-10 py-2.5 bg-slate-900/50 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                            />
                            {searchText && (
                                <button
                                    onClick={() => setSearchText('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Список файлов */}
                        {loading ? (
                            <div className="flex items-center justify-center py-20 text-slate-500">
                                <Files size={32} className="animate-pulse" />
                            </div>
                        ) : filteredFiles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                                <Paperclip size={36} />
                                <p className="text-sm">
                                    {isFiltering ? 'Ничего не найдено' : 'Нет загруженных файлов'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                <AnimatePresence mode="popLayout">
                                    {filteredFiles.map((file, index) => {
                                        const Icon = FILE_ICONS[getFileIconName(file.mimeType)] || File;
                                        const fileUrl = getAttachmentUrl(file);
                                        const previewUrl = getAttachmentFileUrl(file);
                                        const isImage = (file.mimeType || '').startsWith('image/');
                                        const baseName = file.originalName || file.filename || '';
                                        const dot = baseName.lastIndexOf('.');
                                        const ext = dot > 0 ? baseName.slice(dot + 1).toUpperCase().slice(0, 6) : '';
                                        return (
                                            <motion.div
                                                key={file.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ delay: Math.min(index * 0.02, 0.2) }}
                                                className="glass rounded-2xl border border-slate-700/50 p-4 flex flex-col gap-3 relative hover:border-cyan-500/30 transition-all"
                                            >
                                                {/* Ссылка на заметку — слева вверху */}
                                                {file.noteId && (
                                                    <Link
                                                        to={`/dashboard?note=${file.noteId}`}
                                                        title="Перейти к заметке"
                                                        className="absolute top-2 left-2 z-10 p-2 rounded-lg bg-slate-900/70 border border-slate-700/60 text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/15 hover:border-cyan-500/40 backdrop-blur-sm transition-all"
                                                    >
                                                        <StickyNote size={16} />
                                                    </Link>
                                                )}

                                                {/* Иконка скачивания — справа вверху */}
                                                <a
                                                    href={fileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title="Скачать"
                                                    className="absolute top-2 right-2 z-10 p-2 rounded-lg bg-slate-900/70 border border-slate-700/60 text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/15 hover:border-cyan-500/40 backdrop-blur-sm transition-all"
                                                >
                                                    <Download size={16} />
                                                </a>

                                                {/* Обложка: превью для картинок, крупная иконка — для остальных */}
                                                {isImage ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openLightbox(file)}
                                                        className="group relative block w-full rounded-xl overflow-hidden mb-1 cursor-zoom-in"
                                                        title="Просмотр"
                                                    >
                                                        <img
                                                            src={previewUrl}
                                                            alt={file.originalName || file.filename}
                                                            loading="lazy"
                                                            className="w-full h-44 object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                                        />
                                                        <span className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-900/70 border border-slate-700/60 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <ZoomIn size={16} />
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <a
                                                        href={previewUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="relative flex items-center justify-center h-44 rounded-xl mb-1 bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/40 hover:border-cyan-500/40 transition-colors group overflow-hidden"
                                                        title="Открыть файл"
                                                    >
                                                        <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 group-hover:bg-cyan-500/15 group-hover:scale-105 transition-all">
                                                            <Icon className="text-cyan-400" size={40} />
                                                        </div>
                                                        {ext && (
                                                            <span className="absolute bottom-2 left-2 text-[10px] font-semibold tracking-wider uppercase px-2 py-1 rounded-md bg-slate-900/70 text-slate-300 border border-slate-700/60">
                                                                {ext}
                                                            </span>
                                                        )}
                                                    </a>
                                                )}

                                                {/* Имя / размер — всегда под обложкой */}
                                                <div className="min-w-0 pr-8 -mt-1">
                                                    <p className="text-sm text-slate-200 break-words leading-snug">
                                                        {file.originalName || file.filename}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                                        <span>{formatFileSize(file.size)}</span>
                                                        {file.mimeType && (
                                                            <span className="truncate">{file.mimeType}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {file.hashtags?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {file.hashtags.map(tag => (
                                                            <span
                                                                key={tag}
                                                                onClick={() => toggleFilterTag(tag)}
                                                                className={`px-2 py-0.5 bg-gradient-to-r ${getTagColor(tag)} border rounded-full text-xs cursor-pointer transition-all hover:shadow-lg hover:shadow-cyan-500/10`}
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        )}

                        {hasMore && !isFiltering && <div ref={loadMoreRef} className="h-6" />}
                    </motion.div>
                </div>

                {/* Sidebar with Hashtags — как в заметках (desktop only) */}
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
                                <span className="text-sm text-slate-500 font-normal">({fileTags.length})</span>
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

                        {/* Search & Sort Controls */}
                        <div className="mb-4 flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                <input
                                    type="text"
                                    value={tagSearch}
                                    onChange={(e) => setTagSearch(e.target.value)}
                                    placeholder="Поиск тегов..."
                                    className="w-full pl-9 pr-8 py-2 text-sm rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 focus:bg-slate-800/70 transition-all"
                                />
                                {tagSearch && (
                                    <button
                                        onClick={() => setTagSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-all"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <div className="flex rounded-xl bg-slate-800/40 border border-slate-700/50 p-0.5">
                                <button
                                    onClick={() => setTagSort('popularity')}
                                    title="По популярности"
                                    className={`p-2 rounded-lg transition-all ${
                                        tagSort === 'popularity'
                                            ? 'bg-cyan-500/20 text-cyan-300'
                                            : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    <TrendingUp size={16} />
                                </button>
                                <button
                                    onClick={() => setTagSort('name')}
                                    title="По названию"
                                    className={`p-2 rounded-lg transition-all ${
                                        tagSort === 'name'
                                            ? 'bg-cyan-500/20 text-cyan-300'
                                            : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    <ArrowDownAZ size={16} />
                                </button>
                            </div>
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
                                    Найдено: <span className="text-cyan-400 font-medium">{filteredFiles.length}</span> из {totalFiles} файлов
                                </p>
                            </div>
                        )}

                        {/* Tags List with Scroll */}
                        <div className="flex-1 overflow-y-auto scrollbar-styled -mx-2 px-2">
                            {visibleFileTags.length > 0 ? (
                                <div className="space-y-2">
                                    {visibleFileTags.map(({ tag, count }) => {
                                        const isSelected = selectedFilterTags.includes(tag);
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
                                        {tagSearch ? (
                                            <Search size={24} className="text-slate-600" />
                                        ) : (
                                            <Hash size={24} className="text-slate-600" />
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        {tagSearch ? 'Ничего не найдено' : 'Нет тегов'}
                                    </p>
                                    <p className="text-xs text-slate-600 mt-1">
                                        {tagSearch ? 'Попробуйте другой запрос' : 'Добавьте теги к заметкам'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.aside>
            </div>

            {/* Лайтбокс просмотра изображений */}
            <AnimatePresence>
                {lightboxFile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={closeLightbox}
                    >
                        {/* Закрыть */}
                        <button
                            onClick={closeLightbox}
                            className="absolute top-4 right-4 p-2.5 rounded-xl bg-slate-900/70 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                            title="Закрыть (Esc)"
                        >
                            <X size={22} />
                        </button>

                        {/* Назад */}
                        {imageFiles.length > 1 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); showPrev(); }}
                                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-slate-900/70 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                                title="Предыдущая (←)"
                            >
                                <ChevronLeft size={26} />
                            </button>
                        )}

                        {/* Вперёд */}
                        {imageFiles.length > 1 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); showNext(); }}
                                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-slate-900/70 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                                title="Следующая (→)"
                            >
                                <ChevronRight size={26} />
                            </button>
                        )}

                        {/* Изображение */}
                        <motion.div
                            key={lightboxFile.id}
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="relative max-w-[92vw] max-h-[82vh] flex flex-col items-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={getAttachmentFileUrl(lightboxFile)}
                                alt={lightboxFile.originalName || lightboxFile.filename}
                                className="max-w-[92vw] max-h-[78vh] object-contain rounded-xl shadow-2xl"
                            />
                            <div className="mt-3 flex items-center gap-3 text-sm text-slate-300">
                                <span className="truncate max-w-[60vw]">{lightboxFile.originalName || lightboxFile.filename}</span>
                                <span className="text-slate-500">{formatFileSize(lightboxFile.size)}</span>
                                {imageFiles.length > 1 && (
                                    <span className="text-slate-500">{lightboxIndex + 1} / {imageFiles.length}</span>
                                )}
                                <a
                                    href={getAttachmentUrl(lightboxFile)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700/60 text-slate-300 hover:text-cyan-300 hover:bg-cyan-500/15 transition-all"
                                >
                                    <Download size={15} />
                                    Скачать
                                </a>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}