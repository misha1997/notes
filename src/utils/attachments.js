// Общие утилиты для вложений — используются на странице заметок и на странице файлов.

// Берём базовый API-адрес из того же env, что и api.js — REACT_APP_API_URL.
// В dev: http://localhost:3001 → строим абсолютные URL на бэкенд (фронт :3000, бэкенд :3001).
// В prod (Docker/nginx): пустая строка → ОТНОСИТЕЛЬНЫЕ пути /download/.. и /uploads/..
// Относительный путь наследует протокол и хост страницы, поэтому не возникает
// mixed-content (http-картинка на https-странице) и CSP img-src 'self' пропускает её.
// Раньше использовался import.meta.env.VITE_API_URL — это Vite-переменная, в CRA она
// всегда undefined, и в прод URL строился через абсолютный att.url от бэкенда
// (http://host/... даже за внешним https-прокси) — из-за этого превью не грузились.
const apiBase = process.env.REACT_APP_API_URL ?? '';
const apiOrigin = apiBase.replace(/\/api\/?$/, '');

// URL для скачивания файла (через /download — отдаёт attachment + X-Accel-Redirect).
export const getAttachmentUrl = (att) => {
    const filename = encodeURIComponent(att.filename);
    if (!apiOrigin) return `/download/${filename}`;
    return `${apiOrigin}/download/${filename}`;
};

// URL для INLINE-просмотра (превью картинки в <img>, лайтбокс).
// /download отдаёт application/octet-stream + Content-Disposition: attachment —
// браузер такое в <img> не рендерит. Поэтому используем статический /uploads,
// который express.static отдаёт с правильным Content-Type по расширению
// (в dev напрямую с :3001, в prod через nginx location /uploads/ → бэкенд).
export const getAttachmentFileUrl = (att) => {
    const filename = encodeURIComponent(att.filename);
    if (!apiOrigin) return `/uploads/${filename}`;
    return `${apiOrigin}/uploads/${filename}`;
};

// Человекочитаемый размер файла.
export const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

// Иконка по MIME-типу (возвращает имя для выбора компонента lucide).
export const getFileIconName = (mimeType = '') => {
    if (mimeType.startsWith('image/')) return 'Image';
    if (mimeType.startsWith('video/')) return 'Video';
    if (mimeType.startsWith('audio/')) return 'Music';
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('msword') || mimeType.includes('officedocument')) return 'FileText';
    if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('xml') || mimeType.startsWith('text/')) return 'Code';
    return 'File';
};