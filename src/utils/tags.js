// Цветовые схемы для хештегов (градиенты) — общие для страницы заметок и страницы файлов.
export const TAG_COLORS = [
    'from-cyan-500/30 to-blue-500/30 border-cyan-400/40 text-cyan-300',
    'from-purple-500/30 to-pink-500/30 border-purple-400/40 text-purple-300',
    'from-emerald-500/30 to-teal-500/30 border-emerald-400/40 text-emerald-300',
    'from-amber-500/30 to-orange-500/30 border-amber-400/40 text-amber-300',
    'from-rose-500/30 to-red-500/30 border-rose-400/40 text-rose-300',
    'from-violet-500/30 to-indigo-500/30 border-violet-400/40 text-violet-300',
    'from-sky-500/30 to-cyan-500/30 border-sky-400/40 text-sky-300',
    'from-fuchsia-500/30 to-purple-500/30 border-fuchsia-400/40 text-fuchsia-300',
];

// Псевдо-случайный цвет для тега на основе имени (стабильный).
export const getTagColor = (tag) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
};