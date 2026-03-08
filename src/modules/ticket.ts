import {
    Interaction, ButtonInteraction, ChannelType, PermissionFlagsBits,
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel
} from 'discord.js';
import { ROLE_NAMES } from '../config';
import { PROJECT_CAT_ID } from '../state';
import { recordOrder } from './loyalty';
import { sendReviewPrompt } from './review';
import { sendInvoiceDM } from './invoice';
import { notifySellerNewOrder } from './ordertrack';
import { isBlacklisted } from './blacklist';
import { getBotConfig } from '../lib/botConfig';

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

    const orderEmbed = new EmbedBuilder()
        .setTitle(`🛒 New Order: ${serviceId.toUpperCase()}`)
        .setDescription(
            `Halo ${interaction.user}, admin/seller akan segera melayani Anda.\n\n` +
            `**Silahkan kirim detail project:**\n1. Deskripsi Fitur\n2. Budget\n3. Deadline\n\n` +
            `📊 **Poin Kamu:** ${loyalty.points} pts  |  **Total Order:** ${loyalty.orderCount}x`
        )
        .setColor('#00ff00');

    const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Selesaikan & Tutup Tiket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ content: `${interaction.user}`, embeds: [orderEmbed], components: [closeRow] });

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
    if (buyerId) {
        await sendReviewPrompt(buyerId, serviceId, chanName, interaction.client);
    }

    setTimeout(async () => {
        await interaction.channel?.delete().catch(() => {});
    }, 5000);
}
