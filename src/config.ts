import 'dotenv/config';

export const TOKEN        = process.env.TOKEN    ?? 'TOKEN_BOT_LU_DISINI';
export const OWNER_ID     = process.env.OWNER_ID ?? 'ID_DISCORD_LU_DISINI';

export interface Service {
    id:        string;
    name:      string;
    color:     string;
    emoji:     string;
    title:     string;
    desc:      string;
    stack:     string[];
    features:  string[];
    price:     string;
    eta:       string;
    thumbnail: string; // URL gambar/banner, kosongkan '' kalau belum ada
}

// Data default — hanya dipakai untuk seed pertama kali data/services.json
// Setelah itu semua perubahan lewat /product edit di Discord
export const DEFAULT_SERVICES: Service[] = [
    {
        id:       'web',
        name:     '🌐-web-development',
        color:    '#00fbff',
        emoji:    '🌐',
        title:    'Web Development',
        desc:     'Pembuatan website profesional & modern sesuai kebutuhan bisnis atau personal lu.',
        stack:    ['Next.js', 'React', 'Laravel', 'Tailwind CSS', 'MySQL'],
        features: [
            'Responsive & Mobile-Friendly',
            'SEO Optimized',
            'Source Code Full (no lock-in)',
            'Free Revisi 3x',
            'Deployment Included',
        ],
        price:     'Mulai Rp 150.000',
        eta:       '3 – 14 hari',
        thumbnail: '',
    },
    {
        id:       'fitur',
        name:     '⚡-fitur-samp',
        color:    '#ffcc00',
        emoji:    '⚡',
        title:    'Fitur GTA SA:MP',
        desc:     'Scripting fitur custom untuk server GTA SA:MP lu, dari sistem sederhana sampai yang kompleks.',
        stack:    ['PAWN', 'MySQL', 'SA:MP Plugin', 'sscanf', 'y_hooks'],
        features: [
            'Fitur sesuai request',
            'Anti-bug & clean code',
            'Support install & testing',
            'Free patch bug 7 hari',
            'Private source (opsional)',
        ],
        price:     'Mulai Rp 25.000',
        eta:       '1 – 7 hari',
        thumbnail: '',
    },
    {
        id:       'mapping',
        name:     '🗺️-mapping-samp',
        color:    '#ff00ff',
        emoji:    '🗺️',
        title:    'Mapping SA:MP',
        desc:     'Custom interior & exterior mapping untuk server SA:MP lu, detail dan siap pakai.',
        stack:    ['MTA Map Editor', 'Texture Studio', 'PAWNO', 'CreateObject/DynamicObject'],
        features: [
            'Interior & Exterior custom',
            'Optimized object count',
            'Format streamer & static',
            'Preview screenshot included',
            'Free minor edit 3x',
        ],
        price:     'Mulai Rp 20.000',
        eta:       '1 – 5 hari',
        thumbnail: '',
    },
    {
        id:       'bot',
        name:     '🤖-discord-bot',
        color:    '#5865F2',
        emoji:    '🤖',
        title:    'Discord Bot',
        desc:     'Bot Discord custom dengan logic matang, dari utility sederhana sampai sistem penuh seperti bot ini.',
        stack:    ['TypeScript', 'discord.js', 'Node.js', 'SQLite / JSON'],
        features: [
            'Fitur sesuai kebutuhan',
            'Slash commands + buttons',
            'Hosting setup guide',
            'Source code full',
            'Free revisi logika 2x',
        ],
        price:     'Mulai Rp 50.000',
        eta:       '2 – 10 hari',
        thumbnail: '',
    },
];

// Setiap kelipatan ini, customer dapat reward
export const LOYALTY_THRESHOLD = 5;

// Semua nama role dipusat di sini biar konsisten
export const ROLE_NAMES = {
    OWNER:    '👑 Owner',
    ADMIN:    '🛡️ Admin',
    SELLER:   '💼 Seller',
    CUSTOMER: '🛒 Customer',
    LOYAL:    '⭐ Loyal Customer',
};
