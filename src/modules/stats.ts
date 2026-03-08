import { Guild, ChannelType, PermissionFlagsBits, VoiceChannel } from 'discord.js';
import { pool } from '../lib/db';

async function getStatChanId(key: string): Promise<string | null> {
    const { rows } = await pool.query('SELECT value FROM bot_state WHERE key = $1', [key]);
    return rows[0]?.value ?? null;
}

async function saveStatChanId(key: string, id: string): Promise<void> {
    await pool.query(
        `INSERT INTO bot_state(key, value) VALUES($1, $2)
         ON CONFLICT(key) DO UPDATE SET value = $2`,
        [key, id]
    );
}

// Dipanggil dari setup.ts saat setup awal — buat 2 voice channel stats
export async function createStatChannels(guild: Guild, categoryId: string): Promise<void> {
    const denyConnect = [{ id: guild.id, deny: [PermissionFlagsBits.Connect] }];

    const memberChan = await guild.channels.create({
        name: `👥 Members: ${guild.memberCount}`,
        type: ChannelType.GuildVoice,
        parent: categoryId,
        permissionOverwrites: denyConnect,
    });
    await saveStatChanId('stat_member_chan_id', memberChan.id);

    const { rows } = await pool.query(
        'SELECT COUNT(DISTINCT buyer_id)::int AS cnt FROM orders'
    );
    const buyerCount: number = rows[0]?.cnt ?? 0;

    const buyerChan = await guild.channels.create({
        name: `🛒 Buyers: ${buyerCount}`,
        type: ChannelType.GuildVoice,
        parent: categoryId,
        permissionOverwrites: denyConnect,
    });
    await saveStatChanId('stat_buyer_chan_id', buyerChan.id);
}

// Update voice channel nama member count
export async function updateMemberStat(guild: Guild): Promise<void> {
    try {
        const chanId = await getStatChanId('stat_member_chan_id');
        if (!chanId) return;

        const chan = (guild.channels.cache.get(chanId) ??
            await guild.channels.fetch(chanId).catch(() => null)) as VoiceChannel | null;
        if (!chan) return;

        const newName = `👥 Members: ${guild.memberCount}`;
        if (chan.name !== newName) await chan.setName(newName).catch(() => {});
    } catch {}
}

// Update voice channel nama buyer count — dipanggil setiap ada order baru
export async function updateBuyerStat(guild: Guild): Promise<void> {
    try {
        const chanId = await getStatChanId('stat_buyer_chan_id');
        if (!chanId) return;

        const chan = (guild.channels.cache.get(chanId) ??
            await guild.channels.fetch(chanId).catch(() => null)) as VoiceChannel | null;
        if (!chan) return;

        const { rows } = await pool.query(
            'SELECT COUNT(DISTINCT buyer_id)::int AS cnt FROM orders'
        );
        const count: number = rows[0]?.cnt ?? 0;
        const newName = `🛒 Buyers: ${count}`;
        if (chan.name !== newName) await chan.setName(newName).catch(() => {});
    } catch {}
}
