import {
    ChatInputCommandInteraction,
    ButtonInteraction,
    ModalSubmitInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    TextChannel,
} from 'discord.js';
import { pool } from '../lib/db';
import { OWNER_ID } from '../config';
import { getBotConfig } from '../lib/botConfig';

function isOwner(userId: string): boolean {
    return userId === OWNER_ID;
}

// Parsing "10%" → percent/10, "50000" → flat/50000
function parseDiscountInput(input: string): { type: 'percent' | 'flat'; value: number } | null {
    const trimmed = input.trim().replace(/\./g, ''); // strip thousand separators
    if (trimmed.endsWith('%')) {
        const val = parseFloat(trimmed.slice(0, -1));
        if (isNaN(val) || val <= 0 || val > 100) return null;
        return { type: 'percent', value: Math.round(val) };
    }
    const val = parseInt(trimmed.replace(/[^\d]/g, ''));
    if (isNaN(val) || val <= 0) return null;
    return { type: 'flat', value: val };
}

export function calculateDiscount(type: 'percent' | 'flat', value: number, price: number): number {
    if (type === 'percent') return Math.round(price * value / 100);
    return Math.min(value, price); // flat tidak boleh melebihi harga
}

// ── Core validation + application logic ──────────────────────────────────────
export async function validateAndApplyVoucher(
    code: string,
    serviceId: string,
    buyerId: string,
    price: number,
    channelName: string,
): Promise<{ discountAmount: number; display: string } | { error: string }> {

    // 1. Cek tabel promo_vouchers dulu
    const { rows: promoRows } = await pool.query(
        'SELECT * FROM promo_vouchers WHERE code = $1',
        [code.toUpperCase()]
    );

    if (promoRows.length > 0) {
        const v = promoRows[0];

        if (v.expires_at && new Date(v.expires_at) < new Date()) {
            return { error: '❌ Voucher sudah kadaluarsa.' };
        }
        if (v.used_count >= v.max_uses) {
            return { error: '❌ Voucher sudah mencapai batas pemakaian.' };
        }
        if (v.service_ids && v.service_ids.length > 0 && !v.service_ids.includes(serviceId)) {
            return { error: `❌ Voucher ini hanya berlaku untuk jasa: **${v.service_ids.join(', ')}**.` };
        }

        const discountAmount = calculateDiscount(v.type, v.value, price);
        const display = v.type === 'percent'
            ? `${v.value}% = Rp ${discountAmount.toLocaleString('id-ID')}`
            : `Rp ${parseInt(v.value).toLocaleString('id-ID')}`;

        await pool.query(
            'UPDATE promo_vouchers SET used_count = used_count + 1 WHERE code = $1',
            [code.toUpperCase()]
        );
        await pool.query(
            `UPDATE orders SET voucher_code = $1, discount_amount = $2 WHERE channel_name = $3`,
            [code.toUpperCase(), discountAmount, channelName]
        );

        return { discountAmount, display };
    }

    // 2. Cek loyalty voucher (prefix LOYAL-)
    if (code.toUpperCase().startsWith('LOYAL-')) {
        const { rows: loyalRows } = await pool.query(
            'SELECT vouchers FROM customer_loyalty WHERE user_id = $1',
            [buyerId]
        );
        if (!loyalRows[0]) return { error: '❌ Voucher tidak ditemukan.' };

        const vouchers: string[] = loyalRows[0].vouchers;
        const normalizedCode = code.toUpperCase();
        const found = vouchers.find(v => v.toUpperCase() === normalizedCode);
        if (!found) return { error: '❌ Voucher tidak ditemukan di akun kamu atau sudah dipakai.' };

        const cfg = await getBotConfig();
        const parsed = parseDiscountInput(cfg.voucher_discount);
        if (!parsed) return { error: '❌ Konfigurasi voucher loyalty bermasalah. Hubungi Owner.' };

        const discountAmount = calculateDiscount(parsed.type, parsed.value, price);
        const display = parsed.type === 'percent'
            ? `${parsed.value}% = Rp ${discountAmount.toLocaleString('id-ID')}`
            : `Rp ${parsed.value.toLocaleString('id-ID')}`;

        // Hapus dari daftar loyalty voucher (sudah dipakai)
        const updated = vouchers.filter(v => v.toUpperCase() !== normalizedCode);
        await pool.query(
            'UPDATE customer_loyalty SET vouchers = $1::jsonb WHERE user_id = $2',
            [JSON.stringify(updated), buyerId]
        );
        await pool.query(
            `UPDATE orders SET voucher_code = $1, discount_amount = $2 WHERE channel_name = $3`,
            [found, discountAmount, channelName]
        );

        return { discountAmount, display };
    }

    return { error: '❌ Kode voucher tidak ditemukan.' };
}

// ════════════════════════════════════════════════════════════════════════════
// OWNER: /voucher create | list | delete
// ════════════════════════════════════════════════════════════════════════════

export async function handleVoucherCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isOwner(interaction.user.id)) {
        await interaction.reply({ content: '❌ Hanya Owner yang bisa kelola voucher promo.', ephemeral: true });
        return;
    }

    const sub = interaction.options.getSubcommand();

    // ── Create ──────────────────────────────────────────────────────────────
    if (sub === 'create') {
        const modal = new ModalBuilder()
            .setCustomId('voucher:create_modal')
            .setTitle('Buat Voucher Promo Baru');

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('code')
                    .setLabel('Kode Voucher (contoh: DISKON50)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(20)
                    .setPlaceholder('DISKON50 (huruf kapital, tanpa spasi)'),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('discount')
                    .setLabel('Diskon: "10%" untuk persen, "50000" untuk flat Rp')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('Contoh: 10%  atau  50000'),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('max_uses')
                    .setLabel('Maks pemakaian (contoh: 100)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('1 = sekali pakai, 100 = bisa dipakai 100x'),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('expires')
                    .setLabel('Berlaku sampai DD/MM/YYYY (kosong = selamanya)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setPlaceholder('31/12/2026 atau kosongkan'),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('services')
                    .setLabel('ID jasa (kosong=semua, pisah koma: web,mobile)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setPlaceholder('web,mobile  atau kosongkan untuk semua jasa'),
            ),
        );

        await interaction.showModal(modal);
        return;
    }

    // ── List ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
        const { rows } = await pool.query(
            'SELECT * FROM promo_vouchers ORDER BY created_at DESC LIMIT 20'
        );

        if (rows.length === 0) {
            await interaction.reply({ content: '📭 Belum ada voucher promo yang dibuat.', ephemeral: true });
            return;
        }

        const lines = rows.map((v: any) => {
            const discount  = v.type === 'percent'
                ? `${v.value}%`
                : `Rp ${parseInt(v.value).toLocaleString('id-ID')}`;
            const expiry    = v.expires_at
                ? `<t:${Math.floor(new Date(v.expires_at).getTime() / 1000)}:D>`
                : 'Selamanya';
            const services  = (v.service_ids && v.service_ids.length) ? v.service_ids.join(', ') : 'Semua';
            const isExpired = v.expires_at && new Date(v.expires_at) < new Date();
            const status    = isExpired ? '❌ Expired'
                : v.used_count >= v.max_uses ? '🔴 Habis'
                : '✅ Aktif';
            return `**\`${v.code}\`** — ${discount} | ${v.used_count}/${v.max_uses}× | s/d ${expiry} | ${services} | ${status}`;
        });

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🎟️ Daftar Voucher Promo')
                    .setColor('#5865F2')
                    .setDescription(lines.join('\n'))
                    .setTimestamp(),
            ],
            ephemeral: true,
        });
        return;
    }

    // ── Delete ───────────────────────────────────────────────────────────────
    if (sub === 'delete') {
        const code = interaction.options.getString('code', true).trim().toUpperCase();
        const { rowCount } = await pool.query('DELETE FROM promo_vouchers WHERE code = $1', [code]);
        if (!rowCount || rowCount === 0) {
            await interaction.reply({ content: `❌ Voucher \`${code}\` tidak ditemukan.`, ephemeral: true });
        } else {
            await interaction.reply({ content: `✅ Voucher \`${code}\` berhasil dihapus.`, ephemeral: true });
        }
    }
}

// ── Modal submit: buat voucher ────────────────────────────────────────────────
export async function handleVoucherCreateModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!isOwner(interaction.user.id)) {
        await interaction.reply({ content: '❌', ephemeral: true });
        return;
    }

    const code     = interaction.fields.getTextInputValue('code').trim().toUpperCase().replace(/\s+/g, '');
    const discount = interaction.fields.getTextInputValue('discount').trim();
    const maxUses  = parseInt(interaction.fields.getTextInputValue('max_uses').trim());
    const expires  = interaction.fields.getTextInputValue('expires').trim();
    const services = interaction.fields.getTextInputValue('services').trim();

    const parsed = parseDiscountInput(discount);
    if (!parsed) {
        await interaction.reply({ content: '❌ Format diskon tidak valid. Gunakan "10%" atau "50000".', ephemeral: true });
        return;
    }

    if (isNaN(maxUses) || maxUses < 1) {
        await interaction.reply({ content: '❌ Maks pemakaian harus angka minimal 1.', ephemeral: true });
        return;
    }

    let expiresAt: Date | null = null;
    if (expires) {
        const parts = expires.split('/').map(Number);
        if (parts.length !== 3) {
            await interaction.reply({ content: '❌ Format tanggal tidak valid. Gunakan DD/MM/YYYY.', ephemeral: true });
            return;
        }
        expiresAt = new Date(parts[2], parts[1] - 1, parts[0], 23, 59, 59);
        if (isNaN(expiresAt.getTime())) {
            await interaction.reply({ content: '❌ Tanggal tidak valid.', ephemeral: true });
            return;
        }
    }

    const serviceIds = services
        ? services.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        : null;

    try {
        await pool.query(
            `INSERT INTO promo_vouchers (code, type, value, max_uses, service_ids, expires_at, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [code, parsed.type, parsed.value, maxUses, serviceIds, expiresAt, interaction.user.id]
        );

        const discountText = parsed.type === 'percent'
            ? `${parsed.value}%`
            : `Rp ${parsed.value.toLocaleString('id-ID')}`;
        const expiryText   = expiresAt
            ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:D>`
            : 'Selamanya';
        const servicesText = serviceIds?.length ? serviceIds.join(', ') : 'Semua jasa';

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('✅ Voucher Promo Berhasil Dibuat')
                    .setColor('#00FF88')
                    .addFields(
                        { name: '🏷️ Kode',        value: `\`${code}\``,   inline: true },
                        { name: '💸 Diskon',       value: discountText,     inline: true },
                        { name: '🔢 Maks Pakai',   value: `${maxUses}×`,   inline: true },
                        { name: '📅 Berlaku S/D',  value: expiryText,       inline: true },
                        { name: '🛒 Untuk Jasa',   value: servicesText,     inline: true },
                    )
                    .setFooter({ text: `Bagikan kode \`${code}\` ke customer kamu!` }),
            ],
            ephemeral: true,
        });
    } catch (err: any) {
        if (err.code === '23505') {
            await interaction.reply({ content: `❌ Kode voucher \`${code}\` sudah ada.`, ephemeral: true });
        } else {
            await interaction.reply({ content: `❌ Gagal membuat voucher: ${err.message}`, ephemeral: true });
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════
// IN-TICKET: Buyer klik 🎟️ Pakai Voucher
// ════════════════════════════════════════════════════════════════════════════

export async function handleVoucherApplyBtn(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.channel) return;

    const channelName = (interaction.channel as TextChannel).name;
    const { rows } = await pool.query('SELECT * FROM orders WHERE channel_name = $1', [channelName]);

    if (!rows[0]) {
        await interaction.reply({ content: '❌ Order tidak ditemukan.', ephemeral: true });
        return;
    }

    const order = rows[0];

    if (interaction.user.id !== order.buyer_id) {
        await interaction.reply({ content: '❌ Hanya buyer yang bisa menggunakan voucher.', ephemeral: true });
        return;
    }

    if (!order.price_agreed) {
        await interaction.reply({
            content: '❌ Harga belum ditetapkan. Minta seller klik **💰 Set/Ubah Harga** terlebih dahulu.',
            ephemeral: true,
        });
        return;
    }

    if (order.voucher_code) {
        const price    = parseInt(order.price_agreed);
        const discount = parseInt(order.discount_amount);
        await interaction.reply({
            content: `⚠️ Voucher \`${order.voucher_code}\` sudah dipakai.\nDiskon: **Rp ${discount.toLocaleString('id-ID')}** → Total: **Rp ${(price - discount).toLocaleString('id-ID')}**`,
            ephemeral: true,
        });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId('voucher:apply_modal')
        .setTitle('🎟️ Masukkan Kode Voucher');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('code')
                .setLabel('Kode Voucher')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('Contoh: DISKON50 atau LOYAL-XXXX-5X-YYY'),
        ),
    );

    await interaction.showModal(modal);
}

// ── Modal submit: apply voucher dalam tiket ───────────────────────────────────
export async function handleVoucherApplyModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.channel) return;

    const code        = interaction.fields.getTextInputValue('code').trim().toUpperCase();
    const channelName = (interaction.channel as TextChannel).name;

    const { rows } = await pool.query('SELECT * FROM orders WHERE channel_name = $1', [channelName]);
    if (!rows[0]) {
        await interaction.reply({ content: '❌ Order tidak ditemukan.', ephemeral: true });
        return;
    }

    const order = rows[0];

    if (interaction.user.id !== order.buyer_id) {
        await interaction.reply({ content: '❌ Hanya buyer yang bisa menggunakan voucher.', ephemeral: true });
        return;
    }

    if (!order.price_agreed) {
        await interaction.reply({ content: '❌ Harga belum ditetapkan.', ephemeral: true });
        return;
    }

    if (order.voucher_code) {
        await interaction.reply({ content: `⚠️ Voucher sudah dipakai: \`${order.voucher_code}\`.`, ephemeral: true });
        return;
    }

    const price  = parseInt(order.price_agreed);
    const result = await validateAndApplyVoucher(code, order.service_id, order.buyer_id, price, channelName);

    if ('error' in result) {
        await interaction.reply({ content: result.error, ephemeral: true });
        return;
    }

    const finalPrice = price - result.discountAmount;

    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle('🎟️ Voucher Berhasil Dipakai!')
                .setColor('#00FF88')
                .addFields(
                    { name: '🏷️ Kode',            value: `\`${code}\``,                                          inline: true },
                    { name: '💸 Diskon',            value: result.display,                                         inline: true },
                    { name: '\u200b',               value: '\u200b',                                               inline: true },
                    { name: '💰 Harga Awal',        value: `Rp ${price.toLocaleString('id-ID')}`,                 inline: true },
                    { name: '✅ Total Pembayaran',  value: `**Rp ${finalPrice.toLocaleString('id-ID')}**`,        inline: true },
                )
                .setDescription(`Transfer **Rp ${finalPrice.toLocaleString('id-ID')}** lalu klik **💸 Sudah Transfer**.`),
        ],
    });
}
