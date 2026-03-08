import {
    Interaction,
    ChatInputCommandInteraction,
    ButtonInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    GuildMember,
    TextChannel,
    PermissionFlagsBits,
} from 'discord.js';
import { pool } from '../lib/db';
import { OWNER_ID, ROLE_NAMES } from '../config';
import { getAllServices } from '../lib/serviceStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOwner(userId: string): boolean {
    return userId === OWNER_ID;
}

const SP_LABEL: Record<number, string> = {
    1: '⚠️ SP-1 | Peringatan',
    2: '🔴 SP-2 | Denda',
    3: '💀 SP-3 | Kick & Blacklist',
};

// Cari channel marketplace milik seller berdasarkan seller_id di DB
async function findSellerChannels(guild: import('discord.js').Guild, sellerId: string): Promise<TextChannel[]> {
    const services = await getAllServices();
    const channels: TextChannel[] = [];
    for (const s of services) {
        if ((s as any).seller_id !== sellerId) continue;
        const chan = guild.channels.cache.find(c => c.name === s.name && c.isTextBased()) as TextChannel | undefined;
        if (chan) channels.push(chan);
    }
    return channels;
}

// Hide channel seller (SP1/SP2)
async function hideSellerChannels(guild: import('discord.js').Guild, sellerId: string): Promise<void> {
    const chans = await findSellerChannels(guild, sellerId);
    for (const chan of chans) {
        await chan.permissionOverwrites.edit(sellerId, { ViewChannel: false }).catch(() => {});
    }
}

// Restore channel seller
async function restoreSellerChannels(guild: import('discord.js').Guild, sellerId: string): Promise<void> {
    const chans = await findSellerChannels(guild, sellerId);
    for (const chan of chans) {
        await chan.permissionOverwrites.edit(sellerId, { ViewChannel: true }).catch(() => {});
    }
}

// ── /sp give — Owner input: @seller, level, alasan, [denda] ──────────────────
export async function handleSpGive(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isOwner(interaction.user.id)) {
        await interaction.reply({ content: '❌ Hanya Owner yang bisa memberikan SP.', ephemeral: true });
        return;
    }

    const target  = interaction.options.getUser('seller', true);
    const level   = interaction.options.getInteger('level', true) as 1 | 2 | 3;

    // SP1 & SP3: modal hanya alasan. SP2: alasan + denda
    const modal = new ModalBuilder()
        .setCustomId(`sp:give:${target.id}:${level}`)
        .setTitle(`${SP_LABEL[level]} — ${target.tag}`);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Alasan pemberian SP')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setPlaceholder('Contoh: Tidak merespon buyer selama 3 hari tanpa konfirmasi...')
        ),
    );

    if (level === 2) {
        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('denda')
                    .setLabel('Nominal denda (angka, dalam Rupiah)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('Contoh: 50000')
            ),
        );
    }

    await interaction.showModal(modal);
}

export async function handleSpGiveModal(interaction: Interaction): Promise<void> {
    if (!interaction.isModalSubmit() || !interaction.guild) return;
    if (!interaction.customId.startsWith('sp:give:')) return;

    const parts    = interaction.customId.split(':'); // ['sp','give','<userId>','<level>']
    const sellerId = parts[2];
    const level    = parseInt(parts[3]) as 1 | 2 | 3;
    const reason   = interaction.fields.getTextInputValue('reason').trim();
    const denda    = level === 2 ? parseInt(interaction.fields.getTextInputValue('denda').trim() || '0') : 0;

    if (!isOwner(interaction.user.id)) {
        await interaction.reply({ content: '❌', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: false });

    // Simpan ke DB
    const hiddenUntil = level === 1
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null; // SP2 = tidak ada batas waktu otomatis, sampai denda dibayar. SP3 = permanen

    await pool.query(
        `INSERT INTO seller_sp (seller_id, sp_level, reason, denda_amount, hidden_until)
         VALUES ($1, $2, $3, $4, $5)`,
        [sellerId, level, reason, denda, hiddenUntil]
    );

    const guild = interaction.guild;

    if (level === 1) {
        // SP1: sembunyikan channel 7 hari
        await hideSellerChannels(guild, sellerId);
        const embed = new EmbedBuilder()
            .setTitle('⚠️ SP-1 Diberikan')
            .setColor('#FF6600')
            .addFields(
                { name: 'Seller', value: `<@${sellerId}>`, inline: true },
                { name: 'Level',  value: 'SP-1', inline: true },
                { name: 'Durasi', value: '7 hari channel tersembunyi', inline: true },
                { name: 'Alasan', value: reason, inline: false },
            )
            .setTimestamp();
        // DM seller
        const sellerUser = await guild.client.users.fetch(sellerId).catch(() => null);
        if (sellerUser) {
            await sellerUser.send({ embeds: [new EmbedBuilder()
                .setTitle('⚠️ Kamu Mendapat Surat Peringatan (SP-1)')
                .setColor('#FF6600')
                .setDescription(
                    `**Alasan:** ${reason}\n\n` +
                    `Channel lapakmu **disembunyikan selama 7 hari**.\n` +
                    `Setelah 7 hari, channel akan otomatis kembali terlihat.`
                )
                .setTimestamp()
            ]}).catch(() => {});
        }
        await interaction.editReply({ embeds: [embed] });

    } else if (level === 2) {
        // SP2: sembunyikan channel sampai denda dibayar
        await hideSellerChannels(guild, sellerId);
        const embed = new EmbedBuilder()
            .setTitle('🔴 SP-2 Diberikan')
            .setColor('#FF0000')
            .addFields(
                { name: 'Seller',     value: `<@${sellerId}>`, inline: true },
                { name: 'Level',      value: 'SP-2', inline: true },
                { name: 'Denda',      value: `Rp ${denda.toLocaleString('id-ID')}`, inline: true },
                { name: 'Alasan',     value: reason, inline: false },
                { name: 'Status',     value: '🔒 Channel tersembunyi sampai denda dibayar', inline: false },
            )
            .setTimestamp();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`sp:confirm_denda:${sellerId}`)
                .setLabel('✅ Konfirmasi Denda Sudah Dibayar')
                .setStyle(ButtonStyle.Success),
        );
        const sellerUser = await guild.client.users.fetch(sellerId).catch(() => null);
        if (sellerUser) {
            await sellerUser.send({ embeds: [new EmbedBuilder()
                .setTitle('🔴 Kamu Mendapat SP-2 — Denda')
                .setColor('#FF0000')
                .setDescription(
                    `**Alasan:** ${reason}\n\n` +
                    `**Denda:** Rp ${denda.toLocaleString('id-ID')}\n\n` +
                    `Channel lapakmu **tersembunyi sampai denda dilunasi**.\n` +
                    `Setelah bayar, hubungi Owner untuk konfirmasi.`
                )
                .setTimestamp()
            ]}).catch(() => {});
        }
        await interaction.editReply({ embeds: [embed], components: [row] });

    } else if (level === 3) {
        // SP3: kick + blacklist
        const member = await guild.members.fetch(sellerId).catch(() => null);
        const embed = new EmbedBuilder()
            .setTitle('💀 SP-3 — Kick & Blacklist')
            .setColor('#8B0000')
            .addFields(
                { name: 'Seller', value: `<@${sellerId}>`, inline: true },
                { name: 'Level',  value: 'SP-3', inline: true },
                { name: 'Alasan', value: reason, inline: false },
            )
            .setTimestamp();

        // Blacklist
        await pool.query(
            `INSERT INTO blacklist (user_id, reason, added_by) VALUES ($1, $2, $3)
             ON CONFLICT (user_id) DO UPDATE SET reason = $2, added_by = $3`,
            [sellerId, `[SP-3] ${reason}`, interaction.user.id]
        );

        // DM sebelum kick
        const sellerUser = await guild.client.users.fetch(sellerId).catch(() => null);
        if (sellerUser) {
            await sellerUser.send({ embeds: [new EmbedBuilder()
                .setTitle('💀 Kamu Mendapat SP-3 — Dikeluarkan dari Server')
                .setColor('#8B0000')
                .setDescription(
                    `**Alasan:** ${reason}\n\n` +
                    `Kamu telah dikeluarkan dari server dan masuk blacklist.\n` +
                    `Hubungi admin jika kamu merasa ini adalah kesalahan.`
                )
                .setTimestamp()
            ]}).catch(() => {});
        }

        if (member) await member.kick(`SP-3: ${reason}`).catch(() => {});

        await interaction.editReply({ embeds: [embed] });
    }
}

// ── Konfirmasi denda sudah dibayar (Owner klik tombol) ────────────────────────
export async function handleSpConfirmDenda(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isOwner(interaction.user.id)) {
        await interaction.reply({ content: '❌ Hanya Owner yang bisa konfirmasi denda.', ephemeral: true });
        return;
    }

    const sellerId = interaction.customId.replace('sp:confirm_denda:', '');

    // Update DB: denda paid
    await pool.query(
        `UPDATE seller_sp SET denda_paid = TRUE
         WHERE seller_id = $1 AND sp_level = 2 AND denda_paid = FALSE`,
        [sellerId]
    );

    // Restore channel
    await restoreSellerChannels(interaction.guild, sellerId);

    await interaction.update({
        embeds: [EmbedBuilder.from(interaction.message.embeds[0])
            .setDescription('✅ Denda dikonfirmasi. Channel seller sudah dipulihkan.')
            .setColor('#00FF88')
        ],
        components: [],
    });

    // DM seller
    const sellerUser = await interaction.guild.client.users.fetch(sellerId).catch(() => null);
    if (sellerUser) {
        await sellerUser.send('✅ Denda SP-2 kamu sudah dikonfirmasi oleh Owner. Channel lapakmu sudah dibuka kembali!').catch(() => {});
    }
}

// ── /sp list ─────────────────────────────────────────────────────────────────
export async function handleSpList(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isOwner(interaction.user.id)) {
        await interaction.reply({ content: '❌ Hanya Owner yang bisa melihat daftar SP.', ephemeral: true });
        return;
    }

    const target = interaction.options.getUser('seller');
    const query  = target
        ? `SELECT * FROM seller_sp WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 20`
        : `SELECT * FROM seller_sp ORDER BY created_at DESC LIMIT 20`;
    const params = target ? [target.id] : [];

    const { rows } = await pool.query(query, params);

    if (rows.length === 0) {
        await interaction.reply({ content: '✅ Tidak ada catatan SP.', ephemeral: true });
        return;
    }

    const lines = rows.map((r: any) => {
        const status = r.sp_level === 2
            ? (r.denda_paid ? '✅ Lunas' : `💰 Belum bayar Rp ${parseInt(r.denda_amount).toLocaleString('id-ID')}`)
            : '';
        const hiddenInfo = r.hidden_until ? ` · buka: <t:${Math.floor(new Date(r.hidden_until).getTime() / 1000)}:R>` : '';
        return `**${SP_LABEL[r.sp_level]}** — <@${r.seller_id}>\n└ ${r.reason}${hiddenInfo}${status ? ' · ' + status : ''} · <t:${Math.floor(new Date(r.created_at).getTime() / 1000)}:d>`;
    });

    await interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle('📋 Catatan SP Seller')
            .setColor('#FF6600')
            .setDescription(lines.join('\n\n'))
            .setTimestamp()
        ],
        ephemeral: true,
    });
}

// ── Auto-restore SP1 yang sudah expired (panggil saat bot ready) ──────────────
export async function checkExpiredSP(client: import('discord.js').Client): Promise<void> {
    const { rows } = await pool.query(
        `SELECT * FROM seller_sp WHERE sp_level = 1 AND denda_paid = FALSE AND hidden_until IS NOT NULL AND hidden_until <= NOW()`
    );

    for (const row of rows) {
        for (const guild of client.guilds.cache.values()) {
            await restoreSellerChannels(guild, row.seller_id);
        }
        // Mark as paid/resolved so it's not processed again
        await pool.query('UPDATE seller_sp SET denda_paid = TRUE WHERE id = $1', [row.id]);
        const sellerUser = await client.users.fetch(row.seller_id).catch(() => null);
        if (sellerUser) {
            await sellerUser.send('✅ Masa SP-1 kamu sudah berakhir. Channel lapakmu sudah dibuka kembali!').catch(() => {});
        }
    }
}
