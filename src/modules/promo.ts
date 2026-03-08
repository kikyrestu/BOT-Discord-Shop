import { Message, EmbedBuilder } from 'discord.js';
import { pool } from '../lib/db';
import { getBotConfig } from '../lib/botConfig';

// Nama channel yang diizinkan untuk share server
export const PROMO_CHANNEL_NAME = '🎮-share-server-samp';

export async function handlePromoMessage(message: Message): Promise<void> {
    if (message.author.bot) return;
    if (!message.guild)     return;
    if (message.channel.type !== 0) return; // hanya TextChannel (type 0)
    if (!('name' in message.channel)) return;
    if (message.channel.name !== PROMO_CHANNEL_NAME) return;

    // Cek cooldown dari DB
    const cfg = await getBotConfig();
    const PROMO_COOLDOWN_MS = cfg.promo_cooldown_h * 60 * 60 * 1000;

    const { rows } = await pool.query(
        `SELECT last_posted FROM promo_cooldown WHERE user_id = $1`,
        [message.author.id]
    );

    if (rows[0]) {
        const elapsed = Date.now() - new Date(rows[0].last_posted).getTime();
        if (elapsed < PROMO_COOLDOWN_MS) {
            const remaining = Math.ceil((PROMO_COOLDOWN_MS - elapsed) / 60000);
            await message.delete().catch(() => {});
            const warn = await message.channel.send({
                content: `${message.author} ⏳ Kamu baru saja posting! Tunggu **${remaining} menit** lagi (cooldown: ${cfg.promo_cooldown_h} jam).`,
            });
            setTimeout(() => warn.delete().catch(() => {}), 10000);
            return;
        }
    }

    // Post valid — update cooldown
    await pool.query(
        `INSERT INTO promo_cooldown(user_id, last_posted) VALUES($1, NOW())
         ON CONFLICT(user_id) DO UPDATE SET last_posted = NOW()`,
        [message.author.id]
    );

    // Auto-react ✅ sebagai tanda post valid
    await message.react('✅').catch(() => {});
}
