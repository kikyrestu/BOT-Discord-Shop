/**
 * Dynamic bot configuration — semua nilai ini bisa diubah owner via /config
 * disimpan di tabel bot_state dengan prefix "cfg_"
 */
import { pool } from './db';

export interface BotConfig {
    agency_name:        string;  // Nama agency di footer embed
    promo_cooldown_h:   number;  // Cooldown share server (jam)
    loyalty_threshold:  number;  // Order ke-N untuk dapat voucher
    loyalty_points:     number;  // Poin per order
    voucher_discount:   string;  // Teks diskon voucher (e.g. "10%")
}

const DEFAULTS: BotConfig = {
    agency_name:       'Maheswara Agency',
    promo_cooldown_h:  6,
    loyalty_threshold: 5,
    loyalty_points:    10,
    voucher_discount:  '10%',
};

// In-memory cache supaya tidak query DB terus
let cache: BotConfig | null = null;

export async function getBotConfig(): Promise<BotConfig> {
    if (cache) return cache;

    const { rows } = await pool.query(
        `SELECT key, value FROM bot_state WHERE key LIKE 'cfg_%'`
    );

    const cfg = { ...DEFAULTS };
    for (const row of rows) {
        const k = row.key.replace('cfg_', '') as keyof BotConfig;
        if (k in DEFAULTS) {
            const def = DEFAULTS[k];
            (cfg as any)[k] = typeof def === 'number' ? Number(row.value) : row.value;
        }
    }

    cache = cfg;
    return cfg;
}

export async function setBotConfig(key: keyof BotConfig, value: string): Promise<void> {
    await pool.query(
        `INSERT INTO bot_state(key, value) VALUES($1, $2)
         ON CONFLICT(key) DO UPDATE SET value = $2`,
        [`cfg_${key}`, value]
    );
    cache = null; // invalidate cache
}

export function invalidateBotConfigCache(): void {
    cache = null;
}
