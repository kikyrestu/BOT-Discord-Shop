import {
    Interaction, ButtonInteraction, ChannelType, PermissionFlagsBits,
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel,
    ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction,
} from 'discord.js';
import { ROLE_NAMES } from '../config';
import { PROJECT_CAT_ID } from '../state';
import { recordOrder } from './loyalty';
import { sendReviewPrompt } from './review';
import { sendInvoiceDM } from './invoice';
import { notifySellerNewOrder } from './ordertrack';
import { isBlacklisted } from './blacklist';
import { getBotConfig } from '../lib/botConfig';
import { getService } from '../lib/serviceStore';
import { pool } from '../lib/db';

export async function handleTicket(interaction: Interaction, serviceId: string): Promise<void> {
    if (!interaction.guild || !interaction.isButton()) return;

    if (!PROJECT_CAT_ID) {
        await interaction.reply({ content: '❌ Kategori project belum ada! Hubungi Owner untuk /setup ulang.', ephemeral: true });
        return;
    }

    // Cek blacklist
    if (await isBlacklisted(interaction.user.id)) {
        await interaction.reply({
            content: '🚫 Kamu tidak dapat membuat order karena sedang dalam daftar blacklist. Hubungi Admin jika ini kesalahan.',
            ephemeral: true,
        });
        return;
    }

    const staffRoleNames = [ROLE_NAMES.OWNER, ROLE_NAMES.ADMIN, ROLE_NAMES.SELLER];
    const guildRoles = await interaction.guild.roles.fetch();
    const staffOverwrites = guildRoles
        .filter(r => staffRoleNames.includes(r.name))
        .map(r => ({ id: r.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }));

    const channel = await interaction.guild.channels.create({
        // Simpan serviceId & userId di nama channel biar bisa di-parse saat close
        name: `order-${serviceId}-${interaction.user.id}`,
        type: ChannelType.GuildText,
        parent: PROJECT_CAT_ID,
        permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            ...staffOverwrites
        ]
    });

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const loyalty = await recordOrder(member);
    const service = await getService(serviceId).catch(() => null);

    const orderEmbed = new EmbedBuilder()
        .setTitle(`🛒 New Order: ${service ? `${service.emoji} ${service.title}` : serviceId.toUpperCase()}`)
        .setDescription(
            `Halo ${interaction.user}, admin/seller akan segera melayani Anda.\n\n` +
            `**Silahkan kirim detail project:**\n1. Deskripsi & fitur yang diinginkan\n2. Budget & harga yang disetujui\n3. Deadline\n\n` +
            `📊 **Poin Kamu:** ${loyalty.points} pts  |  **Total Order:** ${loyalty.orderCount}×`
        )
        .setColor('#00ff00');

    if (service?.price) {
        orderEmbed.addFields({ name: '💰 Harga Mulai Dari', value: service.price, inline: true });
    }

    // Row 1: price negotiation tools (seller + buyer)
    const priceRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket:set_price')
            .setLabel('💰 Set/Ubah Harga')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('ticket:nego')
            .setLabel('🤝 Tawar Harga')
            .setStyle(ButtonStyle.Secondary),
    );

    // Row 2: payment & voucher actions
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket:voucher')
            .setLabel('🎟️ Pakai Voucher')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`pay:transfer:${channel.id}`)
            .setLabel('💸 Sudah Transfer')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('🔒 Tutup Tiket')
            .setStyle(ButtonStyle.Danger),
    );

    await channel.send({ content: `${interaction.user}`, embeds: [orderEmbed], components: [priceRow, actionRow] });

    // Notif ke payment-verification + ping seller
    const paymentChan = interaction.guild.channels.cache.find(
        c => c.name === 'payment-verification' && c.isTextBased()
    ) as TextChannel | undefined;

    if (paymentChan) {
        const notifEmbed = new EmbedBuilder()
            .setTitle('🔔 Tiket Baru Masuk')
            .setDescription(`Order **${serviceId.toUpperCase()}** dari ${interaction.user}\nChannel: ${channel}`)
            .setColor('#FFA500')
            .setTimestamp();
        await paymentChan.send({ embeds: [notifEmbed] });
    }

    // Notif seller via role ping
    await notifySellerNewOrder(interaction.guild, interaction.user.tag, serviceId, channel as TextChannel);

    // Kirim invoice ke DM buyer
    const orderId = `${serviceId}-${interaction.user.id}-${Date.now()}`;
    await sendInvoiceDM(interaction.client, {
        orderId,
        buyerId:     interaction.user.id,
        serviceId,
        channelName: channel.name,
        guild:       interaction.guild,
    });

    if (loyalty.loyaltyReached && loyalty.voucher) {
        const cfg = await getBotConfig();
        const loyaltyEmbed = new EmbedBuilder()
            .setTitle('🎉 Selamat! Kamu Dapat Reward Loyalty!')
            .setDescription(
                `Kamu udah order sebanyak **${loyalty.orderCount}x**! Ini hadiahnya:\n\n` +
                `🎟️ **Voucher Diskon ${cfg.voucher_discount}:** \`${loyalty.voucher}\`\n` +
                `⭐ Role **${ROLE_NAMES.LOYAL}** udah otomatis di-assign ke kamu!\n\n` +
                `Tunjukkan kode voucher ini ke admin saat order berikutnya.`
            )
            .setColor('#FFD700')
            .setFooter({ text: `${cfg.agency_name} • Loyalty Program` });
        await channel.send({ content: `${interaction.user}`, embeds: [loyaltyEmbed] });
    }

    await interaction.reply({ content: `✅ Tiket dibuat: ${channel}`, ephemeral: true });
}

export async function handleCloseTicket(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild || !interaction.channel) return;

    const staffRoleNames = [ROLE_NAMES.OWNER, ROLE_NAMES.ADMIN, ROLE_NAMES.SELLER];
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isStaff = member.roles.cache.some(r => staffRoleNames.includes(r.name));

    if (!isStaff) {
        await interaction.reply({ content: '❌ Hanya staff yang bisa menutup tiket.', ephemeral: true });
        return;
    }

    // Parse buyer_id & serviceId dari nama channel: order-{serviceId}-{userId}
    const chanName = 'name' in interaction.channel ? (interaction.channel as any).name as string : '';
    const parts = chanName.split('-'); // ['order', serviceId, userId]
    const serviceId = parts[1] ?? 'unknown';
    const buyerId   = parts[2] ?? '';

    // Kirim ringkasan ke payment-verification
    const paymentChan = interaction.guild.channels.cache.find(
        c => c.name === 'payment-verification' && c.isTextBased()
    ) as TextChannel | undefined;

    if (paymentChan) {
        const embed = new EmbedBuilder()
            .setTitle('📋 Tiket Diselesaikan')
            .setDescription(`Channel **${'name' in interaction.channel ? interaction.channel.name : 'unknown'}** ditutup oleh ${interaction.user}`)
            .setColor('#00FF88')
            .setTimestamp();
        await paymentChan.send({ embeds: [embed] });
    }

    await interaction.reply({ content: '🔒 Tiket selesai. Channel akan dihapus dalam 5 detik...' });

    // Kirim DM ke buyer minta review sebelum channel dihapus
    if (buyerId && interaction.guild) {
        await sendReviewPrompt(buyerId, serviceId, chanName, interaction.guild.id, interaction.client);
    }

    setTimeout(async () => {
        await interaction.channel?.delete().catch(() => {});
    }, 5000);
}

// ── Price / Negotiation handlers ─────────────────────────────────────────────

/** Seller (or admin/owner) sets the agreed price for this ticket */
export async function handleSetPrice(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild || !interaction.channel) return;

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const staffRoles = [ROLE_NAMES.OWNER, ROLE_NAMES.ADMIN, ROLE_NAMES.SELLER];
    const isStaff = member.roles.cache.some(r => staffRoles.includes(r.name));

    if (!isStaff) {
        await interaction.reply({ content: '❌ Hanya seller / staff yang bisa set harga.', ephemeral: true });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId('ticket:set_price_modal')
        .setTitle('Set Harga Order');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('price')
                .setLabel('Harga yang disepakati (angka Rp, tanpa titik)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('Contoh: 200000')
        )
    );

    await interaction.showModal(modal);
}

export async function handleSetPriceModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.channel || !interaction.guild) return;

    const raw   = interaction.fields.getTextInputValue('price').replace(/[^\d]/g, '');
    const price = parseInt(raw);

    if (isNaN(price) || price < 1) {
        await interaction.reply({ content: '❌ Harga tidak valid. Masukkan angka saja (contoh: 200000).', ephemeral: true });
        return;
    }

    const channelName = (interaction.channel as TextChannel).name;

    await pool.query(
        `UPDATE orders SET price_agreed = $1 WHERE channel_name = $2`,
        [price, channelName]
    );

    await interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle('✅ Harga Ditetapkan')
            .setColor('#5865F2')
            .addFields(
                { name: '💰 Harga Disepakati', value: `Rp ${price.toLocaleString('id-ID')}`,  inline: true },
                { name: '🎟️ Selanjutnya',      value: 'Buyer dapat pakai voucher lalu transfer', inline: true },
            )
            .setFooter({ text: 'Klik 🎟️ Pakai Voucher jika punya kode diskon, lalu 💸 Sudah Transfer.' })
        ],
    });
}

/** Buyer proposes a counter-price to the seller */
export async function handleNegoPrice(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.channel) return;

    const channelName = (interaction.channel as TextChannel).name;
    const { rows } = await pool.query('SELECT buyer_id FROM orders WHERE channel_name = $1', [channelName]);

    if (!rows[0]) {
        await interaction.reply({ content: '❌ Order tidak ditemukan.', ephemeral: true });
        return;
    }

    if (interaction.user.id !== rows[0].buyer_id) {
        await interaction.reply({ content: '❌ Hanya buyer yang bisa menawar harga.', ephemeral: true });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId('ticket:nego_modal')
        .setTitle('Tawar Harga');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('offer')
                .setLabel('Harga tawaranmu (angka Rp, tanpa titik)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('Contoh: 150000')
        )
    );

    await interaction.showModal(modal);
}

export async function handleNegoPriceModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.channel) return;

    const raw   = interaction.fields.getTextInputValue('offer').replace(/[^\d]/g, '');
    const offer = parseInt(raw);

    if (isNaN(offer) || offer < 1) {
        await interaction.reply({ content: '❌ Harga tidak valid. Masukkan angka saja (contoh: 150000).', ephemeral: true });
        return;
    }

    const acceptRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`ticket:nego_accept:${offer}`)
            .setLabel(`✅ Setuju — Rp ${offer.toLocaleString('id-ID')}`)
            .setStyle(ButtonStyle.Success),
    );

    await interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle('🤝 Penawaran Harga')
            .setColor('#FEE75C')
            .setDescription(`${interaction.user} mengajukan penawaran harga untuk order ini.`)
            .addFields({ name: '💸 Tawaran', value: `**Rp ${offer.toLocaleString('id-ID')}**`, inline: true })
            .setFooter({ text: 'Seller: klik tombol di bawah jika setuju dengan harga ini.' })
        ],
        components: [acceptRow],
    });
}

/** Seller accepts the buyer's negotiated offer */
export async function handleNegoAccept(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild || !interaction.channel) return;

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const staffRoles = [ROLE_NAMES.OWNER, ROLE_NAMES.ADMIN, ROLE_NAMES.SELLER];
    const isStaff = member.roles.cache.some(r => staffRoles.includes(r.name));

    if (!isStaff) {
        await interaction.reply({ content: '❌ Hanya seller / staff yang bisa menyetujui penawaran.', ephemeral: true });
        return;
    }

    // Extract price from customId: ticket:nego_accept:<price>
    const priceStr = interaction.customId.split(':')[2];
    const price    = parseInt(priceStr);

    if (isNaN(price) || price < 1) {
        await interaction.reply({ content: '❌ Data harga tidak valid.', ephemeral: true });
        return;
    }

    const channelName = (interaction.channel as TextChannel).name;

    await pool.query(
        `UPDATE orders SET price_agreed = $1 WHERE channel_name = $2`,
        [price, channelName]
    );

    // Disable the accept button on the original message
    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`ticket:nego_accept:${price}`)
            .setLabel(`✅ Disetujui — Rp ${price.toLocaleString('id-ID')}`)
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
    );
    await interaction.update({ components: [disabledRow] });

    await (interaction.channel as TextChannel).send({
        embeds: [new EmbedBuilder()
            .setTitle('✅ Harga Disepakati')
            .setColor('#00FF88')
            .addFields(
                { name: '💰 Harga Disepakati', value: `Rp ${price.toLocaleString('id-ID')}`, inline: true },
                { name: '🎟️ Selanjutnya',      value: 'Buyer dapat pakai voucher lalu transfer',  inline: true },
            )
            .setFooter({ text: 'Klik 🎟️ Pakai Voucher jika punya kode diskon, lalu 💸 Sudah Transfer.' })
        ],
    });
}

