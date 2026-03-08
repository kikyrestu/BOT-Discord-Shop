import {
    Interaction,
    ChatInputCommandInteraction,
    StringSelectMenuInteraction,
    ModalSubmitInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    GuildMember,
    TextChannel,
} from 'discord.js';
import { pool } from '../lib/db';
import { ROLE_NAMES, OWNER_ID } from '../config';
import { sendStatusUpdateDM } from './invoice';
import { getBotConfig } from '../lib/botConfig';

const STATUS_OPTIONS = ['open', 'in_progress', 'revision', 'done', 'cancelled'] as const;
type OrderStatus = typeof STATUS_OPTIONS[number];

const STATUS_LABEL: Record<OrderStatus, string> = {
    open:        '🟡 Menunggu konfirmasi',
    in_progress: '🔵 Sedang dikerjakan',
    revision:    '🟠 Dalam revisi',
    done:        '🟢 Selesai',
    cancelled:   '🔴 Dibatalkan',
};

function isStaff(member: GuildMember): boolean {
    return member.roles.cache.some(r =>
        [ROLE_NAMES.OWNER, ROLE_NAMES.ADMIN, ROLE_NAMES.SELLER].includes(r.name as any)
    );
}

// /orderstatus [invoice_no?] — buyer lihat status, staff bisa lihat semua
export async function handleOrderStatusCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;

    const member  = interaction.member as GuildMember;
    const invoiceArg = interaction.options.getString('invoice');

    // Buyer: lihat order mereka sendiri
    if (!isStaff(member)) {
        const { rows } = await pool.query(
            `SELECT invoice_no, service_id, status, created_at
             FROM orders WHERE buyer_id = $1
             ORDER BY created_at DESC LIMIT 10`,
            [interaction.user.id]
        );

        if (rows.length === 0) {
            await interaction.reply({ content: '📭 Kamu belum memiliki order apapun.', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('📦 Status Order Kamu')
            .setColor('#5865F2')
            .setDescription(
                rows.map((r: any, i: number) =>
                    `**${i + 1}. \`${r.invoice_no}\`**\n` +
                    `🛒 ${r.service_id.toUpperCase()} · ${STATUS_LABEL[r.status as OrderStatus] ?? r.status}\n` +
                    `📅 <t:${Math.floor(new Date(r.created_at).getTime() / 1000)}:d>`
                ).join('\n\n')
            )
            .setFooter({ text: 'Gunakan /orderstatus [invoice] untuk detail spesifik' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    // Staff: cari berdasarkan invoice atau tampilkan semua aktif
    const query = invoiceArg
        ? `SELECT * FROM orders WHERE invoice_no = $1`
        : `SELECT * FROM orders WHERE status NOT IN ('done','cancelled') ORDER BY created_at DESC LIMIT 20`;
    const params = invoiceArg ? [invoiceArg.toUpperCase()] : [];

    const { rows } = await pool.query(query, params);
    if (rows.length === 0) {
        await interaction.reply({ content: '📭 Tidak ada order yang ditemukan.', ephemeral: true });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(invoiceArg ? `📄 Detail Order ${invoiceArg}` : '📊 Order Aktif')
        .setColor('#FFA500');

    for (const r of rows) {
        embed.addFields({
            name:  `\`${r.invoice_no}\` — ${r.service_id.toUpperCase()}`,
            value: `${STATUS_LABEL[r.status as OrderStatus] ?? r.status}\n<@${r.buyer_id}> · <t:${Math.floor(new Date(r.created_at).getTime() / 1000)}:R>`,
            inline: false,
        });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// /orderupdate — UI: pilih invoice dari select menu aktif → pilih status → modal note
export async function handleOrderUpdateCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;

    const member = interaction.member as GuildMember;
    if (!isStaff(member)) {
        await interaction.reply({ content: '❌ Hanya Staff yang bisa update status order.', ephemeral: true });
        return;
    }

    const { rows } = await pool.query(
        `SELECT invoice_no, service_id, status FROM orders
         WHERE status NOT IN ('done','cancelled') ORDER BY created_at DESC LIMIT 25`
    );

    if (rows.length === 0) {
        await interaction.reply({ content: '📭 Tidak ada order aktif saat ini.', ephemeral: true });
        return;
    }

    const options = rows.map((r: any) => ({
        label:       `${r.invoice_no} — ${r.service_id.toUpperCase()}`,
        description: STATUS_LABEL[r.status as OrderStatus] ?? r.status,
        value:       r.invoice_no,
    }));

    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle('📦 Update Status Order — 1/3')
                .setColor('#5865F2')
                .setDescription('Pilih invoice yang ingin diupdate:')
        ],
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ou:invoice_select')
                    .setPlaceholder('Pilih invoice...')
                    .addOptions(options)
            )
        ],
        ephemeral: true,
    });
}

// Step 2: pilih status setelah invoice dipilih
export async function handleOrderUpdateInvoiceSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    const member = interaction.member as GuildMember;
    if (!isStaff(member)) { await interaction.reply({ content: '❌', ephemeral: true }); return; }

    const invoiceNo = interaction.values[0];

    const statusOptions = STATUS_OPTIONS.map(s => ({
        label: STATUS_LABEL[s],
        value: s,
    }));

    await interaction.update({
        embeds: [
            new EmbedBuilder()
                .setTitle('📦 Update Status Order — 2/3')
                .setColor('#FFA500')
                .setDescription(`Invoice: \`${invoiceNo}\`\n\nPilih status baru:`)
        ],
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`ou:status_select:${invoiceNo}`)
                    .setPlaceholder('Pilih status...')
                    .addOptions(statusOptions)
            )
        ],
    });
}

// Step 3: tampilkan modal untuk catatan opsional
export async function handleOrderUpdateStatusSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const parts     = interaction.customId.split(':'); // ['ou', 'status_select', '<invoiceNo>']
    const invoiceNo = parts[2];
    const status    = interaction.values[0];

    const modal = new ModalBuilder()
        .setCustomId(`ou:note_modal:${invoiceNo}:${status}`)
        .setTitle('Catatan Update (Opsional)');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('note')
                .setLabel('Catatan untuk buyer (bisa dikosongkan)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setPlaceholder('Misal: Sedang dikerjakan, estimasi 2 hari...')
        )
    );

    await interaction.showModal(modal);
}

// Step 4: modal submit → update DB + DM buyer
export async function handleOrderUpdateNoteModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guild) return;

    const parts     = interaction.customId.split(':'); // ['ou', 'note_modal', '<invoiceNo>', '<status>']
    const invoiceNo = parts[2];
    const newStatus = parts[3] as OrderStatus;
    const note      = interaction.fields.getTextInputValue('note').trim();

    const { rows } = await pool.query(
        'SELECT buyer_id FROM orders WHERE invoice_no = $1',
        [invoiceNo]
    );

    if (rows.length === 0) {
        await interaction.reply({ content: `❌ Invoice \`${invoiceNo}\` tidak ditemukan.`, ephemeral: true });
        return;
    }

    await pool.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE invoice_no = $2',
        [newStatus, invoiceNo]
    );

    await interaction.deferReply({ ephemeral: true });

    await sendStatusUpdateDM(
        interaction.client,
        rows[0].buyer_id,
        invoiceNo,
        newStatus,
        note,
        interaction.guild.name
    );

    await interaction.editReply(
        `✅ Status order \`${invoiceNo}\` diubah ke **${STATUS_LABEL[newStatus]}** dan buyer sudah dinotifikasi via DM.`
    );
}

// Autocomplete untuk invoice field
export async function handleOrderAutocomplete(interaction: Interaction): Promise<void> {
    if (!interaction.isAutocomplete()) return;
    if (!['orderstatus', 'orderupdate'].includes(interaction.commandName)) return;

    const focused  = interaction.options.getFocused().toUpperCase();
    const member   = interaction.member as GuildMember;

    let rows: any[];
    if (isStaff(member)) {
        const { rows: r } = await pool.query(
            `SELECT invoice_no, service_id, status FROM orders
             WHERE invoice_no ILIKE $1 LIMIT 25`,
            [`%${focused}%`]
        );
        rows = r;
    } else {
        const { rows: r } = await pool.query(
            `SELECT invoice_no, service_id, status FROM orders
             WHERE buyer_id = $1 AND invoice_no ILIKE $2 LIMIT 25`,
            [interaction.user.id, `%${focused}%`]
        );
        rows = r;
    }

    await interaction.respond(
        rows.map((r: any) => ({
            name:  `${r.invoice_no} — ${r.service_id.toUpperCase()} (${r.status})`,
            value: r.invoice_no,
        }))
    );
}

// Notif ke seller saat tiket order baru dibuat — dengan tombol Klaim Order
export async function notifySellerNewOrder(
    guild: import('discord.js').Guild,
    buyerTag: string,
    serviceId: string,
    orderChannel: import('discord.js').TextChannel
): Promise<void> {
    try {
        const cfg        = await getBotConfig();
        const sellerRole = guild.roles.cache.find(r => r.name === ROLE_NAMES.SELLER);
        const staffChan  = guild.channels.cache.find(
            c => c.name === 'payment-verification' && c.isTextBased()
        ) as TextChannel | undefined;

        if (!staffChan) return;

        const embed = new EmbedBuilder()
            .setTitle('🔔 Order Baru Masuk!')
            .setDescription(
                `**Jasa:** ${serviceId.toUpperCase()}\n` +
                `**Buyer:** ${buyerTag}\n` +
                `**Channel:** ${orderChannel}`
            )
            .setColor('#00FF88')
            .setFooter({ text: `${cfg.agency_name} • Klaim order untuk assign ke dirimu` })
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`claim_order_${orderChannel.id}`)
                .setLabel('👋 Klaim Order Ini')
                .setStyle(ButtonStyle.Primary),
        );

        const content = sellerRole ? `${sellerRole} — ada order baru!` : '📢 Ada order baru!';
        await staffChan.send({ content, embeds: [embed], components: [row] });
    } catch (err) {
        console.error('notifySellerNewOrder error:', err);
    }
}

// Tombol Klaim Order diklik seller
export async function handleClaimOrderButton(
    interaction: import('discord.js').ButtonInteraction
): Promise<void> {
    if (!interaction.guild) return;

    const member    = interaction.member as GuildMember;
    const staffRoles = [ROLE_NAMES.OWNER, ROLE_NAMES.ADMIN, ROLE_NAMES.SELLER];
    if (!member.roles.cache.some(r => staffRoles.includes(r.name as any))) {
        await interaction.reply({ content: '❌ Hanya Staff yang bisa klaim order.', ephemeral: true });
        return;
    }

    const orderChanId = interaction.customId.replace('claim_order_', '');
    const orderChan   = interaction.guild.channels.cache.get(orderChanId) as TextChannel | undefined;

    if (!orderChan) {
        await interaction.update({ content: '⚠️ Channel tiket tidak ditemukan (mungkin sudah ditutup).', embeds: [], components: [] });
        return;
    }

    const cfg = await getBotConfig();

    // Simpan seller_id ke order record berdasarkan channel name
    await pool.query(
        'UPDATE orders SET seller_id = $1 WHERE channel_name = $2 AND seller_id IS NULL',
        [interaction.user.id, orderChan.name]
    ).catch(() => {});

    // Update notif embed: disable tombol klaim, tambah info seller
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setDescription(
            interaction.message.embeds[0].description +
            `\n\n✅ **Diklaim oleh:** ${interaction.user} (<t:${Math.floor(Date.now() / 1000)}:R>)`
        )
        .setColor('#5865F2');

    await interaction.update({ embeds: [updatedEmbed], components: [] });

    // Kirim notif ke channel tiket bahwa seller sudah assign
    await orderChan.send({
        embeds: [
            new EmbedBuilder()
                .setDescription(`👋 **${interaction.user}** telah mengambil order ini dan akan segera menghubungi kamu!`)
                .setColor('#5865F2')
        ]
    }).catch(() => {});
}

// ── Buyer: klik 💸 Sudah Transfer ────────────────────────────────────────────
export async function handlePaymentBuyerBtn(
    interaction: import('discord.js').ButtonInteraction
): Promise<void> {
    if (!interaction.guild || !interaction.channel) return;

    const chanId  = interaction.customId.replace('pay:transfer:', '');
    const chan     = interaction.channel as TextChannel;

    // Validasi channel sesuai customId
    if (chan.id !== chanId) {
        await interaction.reply({ content: '❌ Tombol tidak valid.', ephemeral: true });
        return;
    }

    // Cari order berdasarkan channel_name
    const { rows } = await pool.query('SELECT * FROM orders WHERE channel_name = $1', [chan.name]);
    if (!rows[0]) {
        await interaction.reply({ content: '❌ Order tidak ditemukan.', ephemeral: true });
        return;
    }
    const order = rows[0];

    // Hanya buyer yang bisa klik
    if (interaction.user.id !== order.buyer_id) {
        await interaction.reply({ content: '❌ Hanya buyer yang bisa konfirmasi transfer.', ephemeral: true });
        return;
    }

    if (order.payment_confirmed) {
        await interaction.reply({ content: '⚠️ Pembayaran sudah pernah dikonfirmasi.', ephemeral: true });
        return;
    }

    // Disable tombol agar tidak bisa diklik dua kali
    await interaction.update({ components: [] });

    // Prompt upload bukti di tiket
    await chan.send({
        embeds: [new EmbedBuilder()
            .setTitle('💸 Transfer Dikonfirmasi')
            .setDescription(
                `${interaction.user} sudah konfirmasi transfer!\n\n` +
                `📎 **Kirim screenshot bukti transfer di bawah ini.**\n` +
                `Seller akan mengkonfirmasi dana masuk sebelum mulai mengerjakan.`
            )
            .setColor('#FFCC00')
            .setTimestamp()
        ],
    });

    // Notif ke payment-verification dengan tombol konfirmasi untuk seller
    const paymentChan = interaction.guild.channels.cache.find(
        c => c.name === '💰-payment-verification' && c.isTextBased()
    ) as TextChannel | undefined;

    if (paymentChan) {
        const embed = new EmbedBuilder()
            .setTitle('💸 Buyer Sudah Transfer — Konfirmasi Dana')
            .setDescription(
                `**Invoice:** \`${order.invoice_no}\`\n` +
                `**Layanan:** ${order.service_id.toUpperCase()}\n` +
                `**Buyer:** <@${order.buyer_id}>\n` +
                `**Channel Tiket:** ${chan}\n\n` +
                `Cek bukti transfer di channel tiket, lalu konfirmasi dana masuk.`
            )
            .setColor('#FFCC00')
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`pay:seller:${chan.id}`)
                .setLabel('✅ Konfirmasi Dana Masuk')
                .setStyle(ButtonStyle.Success),
        );

        await paymentChan.send({ embeds: [embed], components: [row] });
    }
}

// ── Seller: klik ✅ Konfirmasi Dana Masuk ────────────────────────────────────
export async function handlePaymentSellerBtn(
    interaction: import('discord.js').ButtonInteraction
): Promise<void> {
    if (!interaction.guild) return;

    const member = interaction.member as GuildMember;
    if (!isStaff(member)) {
        await interaction.reply({ content: '❌ Hanya Staff yang bisa konfirmasi pembayaran.', ephemeral: true });
        return;
    }

    const chanId   = interaction.customId.replace('pay:seller:', '');
    const orderChan = interaction.guild.channels.cache.get(chanId) as TextChannel | undefined;

    if (!orderChan) {
        await interaction.update({ content: '⚠️ Channel tiket tidak ditemukan (mungkin sudah ditutup).', embeds: [], components: [] });
        return;
    }

    const { rows } = await pool.query('SELECT * FROM orders WHERE channel_name = $1', [orderChan.name]);
    if (!rows[0]) {
        await interaction.reply({ content: '❌ Order tidak ditemukan.', ephemeral: true });
        return;
    }
    const order = rows[0];

    const isAdmin = interaction.user.id === OWNER_ID ||
        member.roles.cache.some(r => [ROLE_NAMES.OWNER, ROLE_NAMES.ADMIN].includes(r.name as any));

    // Cek seller yang klaim
    if (!order.seller_id && !isAdmin) {
        await interaction.reply({ content: '⚠️ Belum ada seller yang klaim order ini. Klaim dulu lewat tombol **Klaim Order** sebelum konfirmasi.', ephemeral: true });
        return;
    }
    if (order.seller_id && order.seller_id !== interaction.user.id && !isAdmin) {
        await interaction.reply({ content: '❌ Order ini diklaim seller lain. Hanya seller yang mengklaim order atau Admin/Owner yang bisa konfirmasi.', ephemeral: true });
        return;
    }
    if (order.payment_confirmed) {
        await interaction.update({ content: '⚠️ Pembayaran sudah dikonfirmasi sebelumnya.', embeds: [], components: [] });
        return;
    }

    // Update DB: konfirmasi + in_progress + simpan seller_id kalau belum ada
    await pool.query(
        `UPDATE orders
         SET payment_confirmed = TRUE,
             status            = 'in_progress',
             updated_at        = NOW(),
             seller_id         = COALESCE(seller_id, $1)
         WHERE channel_name = $2`,
        [interaction.user.id, orderChan.name]
    );

    // Disable tombol di payment-verification
    await interaction.update({
        embeds: [EmbedBuilder.from(interaction.message.embeds[0])
            .setDescription(
                (interaction.message.embeds[0].description ?? '') +
                `\n\n✅ **Dikonfirmasi oleh:** ${interaction.user} (<t:${Math.floor(Date.now() / 1000)}:R>)`
            )
            .setColor('#00FF88')
        ],
        components: [],
    });

    // Notif di channel tiket
    await orderChan.send({
        embeds: [new EmbedBuilder()
            .setTitle('✅ Pembayaran Dikonfirmasi!')
            .setDescription(
                `${interaction.user} sudah mengkonfirmasi dana masuk.\n\n` +
                `🔵 **Status order: Sedang Dikerjakan**\n` +
                `Seller akan segera memulai pengerjaan order kamu!`
            )
            .setColor('#00FF88')
            .setTimestamp()
        ],
    }).catch(() => {});

    // DM buyer
    await sendStatusUpdateDM(
        interaction.client,
        order.buyer_id,
        order.invoice_no,
        'in_progress',
        'Pembayaran dikonfirmasi oleh seller. Order sudah mulai dikerjakan!',
        interaction.guild.name
    );
}
