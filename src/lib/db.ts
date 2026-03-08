import 'dotenv/config';
import { Pool } from 'pg';
import { DEFAULT_SERVICES } from '../config';

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
});

export async function initDB(): Promise<void> {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS bot_state (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS customer_loyalty (
            user_id     TEXT    PRIMARY KEY,
            order_count INTEGER NOT NULL DEFAULT 0,
            points      INTEGER NOT NULL DEFAULT 0,
            vouchers    JSONB   NOT NULL DEFAULT '[]'::jsonb
        );

        CREATE TABLE IF NOT EXISTS services (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            color       TEXT NOT NULL,
            emoji       TEXT NOT NULL,
            title       TEXT NOT NULL,
            description TEXT NOT NULL,
            stack       JSONB NOT NULL DEFAULT '[]'::jsonb,
            features    JSONB NOT NULL DEFAULT '[]'::jsonb,
            price       TEXT NOT NULL DEFAULT '',
            eta         TEXT NOT NULL DEFAULT '',
            thumbnail   TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS escrow (
            id            TEXT PRIMARY KEY,
            buyer_id      TEXT NOT NULL,
            seller_id     TEXT NOT NULL,
            amount        TEXT NOT NULL,
            description   TEXT NOT NULL,
            channel_id    TEXT NOT NULL,
            status        TEXT NOT NULL DEFAULT 'pending',
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS reviews (
            id            SERIAL PRIMARY KEY,
            order_channel TEXT NOT NULL,
            reviewer_id   TEXT NOT NULL,
            service_id    TEXT NOT NULL,
            rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
            comment       TEXT NOT NULL DEFAULT '',
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS promo_cooldown (
            user_id     TEXT PRIMARY KEY,
            last_posted TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS payment_methods (
            seller_id  TEXT PRIMARY KEY,
            methods    JSONB NOT NULL DEFAULT '[]'::jsonb,
            message_id TEXT DEFAULT NULL
        );

        CREATE TABLE IF NOT EXISTS orders (
            id           TEXT PRIMARY KEY,
            invoice_no   TEXT NOT NULL UNIQUE,
            buyer_id     TEXT NOT NULL,
            service_id   TEXT NOT NULL,
            channel_name TEXT NOT NULL,
            status       TEXT NOT NULL DEFAULT 'open',
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS blacklist (
            user_id   TEXT PRIMARY KEY,
            reason    TEXT NOT NULL DEFAULT 'Tidak ada alasan',
            added_by  TEXT NOT NULL,
            added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    // Migrate: tambah kolom baru kalau belum ada
    await pool.query(`
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_id          TEXT    DEFAULT NULL;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_confirmed  BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE services ADD COLUMN IF NOT EXISTS seller_id        TEXT    DEFAULT NULL;
    `).catch(() => {});

    await pool.query(`
        CREATE TABLE IF NOT EXISTS seller_sp (
            id            SERIAL PRIMARY KEY,
            seller_id     TEXT        NOT NULL,
            sp_level      INTEGER     NOT NULL CHECK (sp_level IN (1, 2, 3)),
            reason        TEXT        NOT NULL,
            denda_amount  INTEGER     NOT NULL DEFAULT 0,
            denda_paid    BOOLEAN     NOT NULL DEFAULT FALSE,
            hidden_until  TIMESTAMPTZ,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `).catch(() => {});

    // Seed default services kalau tabel masih kosong
    const { rowCount } = await pool.query('SELECT 1 FROM services LIMIT 1');
    if (!rowCount || rowCount === 0) {
        for (const s of DEFAULT_SERVICES) {
            await pool.query(
                `INSERT INTO services(id, name, color, emoji, title, description, stack, features, price, eta, thumbnail)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                 ON CONFLICT(id) DO NOTHING`,
                [s.id, s.name, s.color, s.emoji, s.title, s.desc,
                 JSON.stringify(s.stack), JSON.stringify(s.features),
                 s.price, s.eta, s.thumbnail]
            );
        }
        console.log('✅ Default services seeded ke database!');
    }

    console.log('✅ Database ready!');
}
