// Общие утилиты для вложений — используются на странице заметок и на странице файлов.

// Базовый API-адрес для построения прямых ссылок на скачивание.
// В сборке CRA import.meta.env.VITE_API_URL не задан → apiBase = '' → используется att.url, отданный бэкендом.
const apiBase = (import.meta && import.meta.env && import.meta.env.VITE_API_URL) || '';
const apiOrigin = apiBase.replace(/\/api\/?$/, '');

// Возвращает URL для скачивания файла. Если apiOrigin задан (сборка с явным API URL),
// строит ссылку от него, иначе берёт абсолютный url из ответа бэкенда.
export const getAttachmentUrl = (att) => {
    if (!apiOrigin) return att.url;
    return `${apiOrigin}/download/${encodeURIComponent(att.filename)}`;
};

// Возвращает URL для INLINE-просмотра (превью картинок в <img>).
// /download отдаёт application/octet-stream + attachment и пустое тело без nginx —
// браузер такое в <img> не рендерит. Поэтому используем статический /uploads,
// который express.static отдаёт с правильным Content-Type по расширению
// (в dev напрямую, в prod через nginx location /uploads/).
export const getAttachmentFileUrl = (att) => {
    if (!apiOrigin) return (att.url && att.url.replace('/download/', '/uploads/')) || att.url;
    return `${apiOrigin}/uploads/${encodeURIComponent(att.filename)}`;
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