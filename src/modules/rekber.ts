import {
    Interaction, ButtonInteraction, ChannelType, PermissionFlagsBits,
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, TextChannel
} from 'discord.js';
import { randomUUID } from 'crypto';
import { OWNER_ID, ROLE_NAMES } from '../config';
import { pool } from '../lib/db';

// ─── Flow Rekber ────────────────────────────────────────────────────
// 1. Buyer ketik /rekber → isi modal (nominal, deskripsi, @seller)
// 2. Bot buat channel rekber privat → embed status "Menunggu Konfirmasi Buyer"
// 3. Buyer klik "Konfirmasi Transfer" → status jadi "Dana Ditahan"
// 4. Staff klik "Cairkan" → status selesai, channel dihapus
// 5. Staff klik "Batalkan" → refund note, channel dihapus
// ────────────────────────────────────────────────────────────────────

export async function handleRekberCommand(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const modal = new ModalBuilder()
        .setCustomId('modal_rekber')
        .setTitle('Rekber (Rekening Bersama)');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('rekber_seller')
                .setLabel('Username / ID Discord Seller')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('contoh: namaseller#0001 atau 123456789')
                .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('rekber_amount')
                .setLabel('Nominal Transaksi')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('contoh: Rp 150.000')
                .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('rekber_desc')
                .setLabel('Deskripsi Transaksi')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Jelaskan apa yang dibeli...')
                .setRequired(true)
        ),
    );

    await interaction.showModal(modal);
}

export async function handleRekberModal(interaction: Interaction): Promise<void> {
    if (!interaction.isModalSubmit() || !interaction.guild) return;
    if (interaction.customId !== 'modal_rekber') return;

    await interaction.deferReply({ ephemeral: true });

    const sellerInput = interaction.fields.getTextInputValue('rekber_seller').trim();
    const amount      = interaction.fields.getTextInputValue('rekber_amount').trim();
    const desc        = interaction.fields.getTextInputValue('rekber_desc').trim();

    // Resolve seller member
    const seller = interaction.guild.members.cache.find(
        m => m.user.tag === sellerInput ||
             m.user.username === sellerInput ||
             m.id === sellerInput ||
             m.displayName === sellerInput
    );

    if (!seller) {
        await interaction.editReply({ content: `❌ Seller \`${sellerInput}\` tidak ditemukan di server ini.` });
        return;
    }

    if (seller.id === interaction.user.id) {
        await interaction.editReply({ content: '❌ Kamu tidak bisa rekber dengan diri sendiri.' });
        return;
    }

    const escrowId = randomUUID().slice(0, 8).toUpperCase();

    // Cari kategori ACTIVE PROJECTS untuk parent
    const { rows: stateRows } = await pool.query(`SELECT value FROM bot_state WHERE key = 'project_cat_id'`);
    const parentId = stateRows[0]?.value ?? undefined;

    // Buat channel rekber privat
    const staffRoleNames = [ROLE_NAMES.OWNER, ROLE_NAMES.ADMIN];
    const guildRoles = await interaction.guild.roles.fetch();
    const staffOverwrites = guildRoles
        .filter(r => staffRoleNames.includes(r.name))
        .map(r => ({ id: r.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }));

    const channel = await interaction.guild.channels.create({
        name: `rekber-${escrowId.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: parentId,
        permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id,  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: seller.id,            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            ...staffOverwrites,
        ],
    });

    // Simpan ke DB
    await pool.query(
        `INSERT INTO escrow(id, buyer_id, seller_id, amount, description, channel_id, status)
         VALUES($1,$2,$3,$4,$5,$6,'pending')`,
        [escrowId, interaction.user.id, seller.id, amount, desc, channel.id]
    );

    const embed = new EmbedBuilder()
        .setTitle(`🤝 Rekber #${escrowId}`)
        .setDescription(`Transaksi rekening bersama antara buyer & seller.\n\nBuyer wajib kirim dana ke rekening bot/admin terlebih dahulu sebelum seller mulai mengerjakan.`)
        .addFields(
            { name: '🛒 Buyer',      value: `${interaction.user}`, inline: true },
            { name: '💼 Seller',     value: `${seller}`,           inline: true },
            { name: '💰 Nominal',    value: amount,                inline: true },
            { name: '📝 Deskripsi',  value: desc,                  inline: false },
            { name: '📊 Status',     value: '⏳ Menunggu Konfirmasi Transfer Buyer', inline: false },
        )
        .setColor('#FFA500')
        .setFooter({ text: `ID: ${escrowId} • Maheswara Rekber System` })
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`rekber_confirm_${escrowId}`)
            .setLabel('✅ Konfirmasi Transfer')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`rekber_cancel_${escrowId}`)
            .setLabel('❌ Batalkan Rekber')
            .setStyle(ButtonStyle.Danger),
    );

    await channel.send({ content: `${interaction.user} ${seller}`, embeds: [embed], components: [row] });
    await interaction.editReply({ content: `✅ Channel rekber dibuat: ${channel}` });
}

export async function handleRekberButton(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) return;

    const isConfirm = interaction.customId.startsWith('rekber_confirm_');
    const isCancel  = interaction.customId.startsWith('rekber_cancel_');
    const isCairkan = interaction.customId.startsWith('rekber_cairkan_');
    if (!isConfirm && !isCancel && !isCairkan) return;

    const escrowId = interaction.customId.split('_').pop()!.toUpperCase();
    const { rows } = await pool.query(`SELECT * FROM escrow WHERE id = $1`, [escrowId]);
    const escrow = rows[0];

    if (!escrow) {
        await interaction.reply({ content: '❌ Data rekber tidak ditemukan.', ephemeral: true });
        return;
    }

    const staffRoleNames = [ROLE_NAMES.OWNER, ROLE_NAMES.ADMIN];
    const member  = await interaction.guild.members.fetch(interaction.user.id);
    const isStaff = member.roles.cache.some(r => staffRoleNames.includes(r.name));

    // Buyer konfirmasi transfer
    if (isConfirm) {
        if (interaction.user.id !== escrow.buyer_id) {
            await interaction.reply({ content: '❌ Hanya buyer yang bisa konfirmasi transfer.', ephemeral: true });
            return;
        }
        if (escrow.status !== 'pending') {
            await interaction.reply({ content: '❌ Rekber ini sudah tidak dalam status pending.', ephemeral: true });
            return;
        }

        await pool.query(`UPDATE escrow SET status = 'holding' WHERE id = $1`, [escrowId]);

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .spliceFields(4, 1, { name: '📊 Status', value: '🔒 Dana Ditahan — Tunggu Seller Selesai', inline: false })
            .setColor('#FFCC00');

        const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`rekber_cairkan_${escrowId}`)
                .setLabel('💸 Cairkan Dana ke Seller')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`rekber_cancel_${escrowId}`)
                .setLabel('❌ Batalkan & Refund')
                .setStyle(ButtonStyle.Danger),
        );

        await interaction.update({ embeds: [updatedEmbed], components: [newRow] });
        await (interaction.channel as import('discord.js').TextChannel)?.send(`✅ Buyer telah konfirmasi transfer **${escrow.amount}**. Staff harap verifikasi pembayaran sebelum mem-cairkan!`);
        return;
    }

    // Staff cairkan dana
    if (isCairkan) {
        if (!isStaff) {
            await interaction.reply({ content: '❌ Hanya Staff yang bisa mencairkan dana.', ephemeral: true });
            return;
        }
        if (escrow.status !== 'holding') {
            await interaction.reply({ content: '❌ Dana belum dikonfirmasi buyer.', ephemeral: true });
            return;
        }

        await pool.query(`UPDATE escrow SET status = 'done' WHERE id = $1`, [escrowId]);

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .spliceFields(4, 1, { name: '📊 Status', value: `✅ Selesai — Dana dicairkan oleh ${interaction.user}`, inline: false })
            .setColor('#00FF88');

        await interaction.update({ embeds: [updatedEmbed], components: [] });
        await (interaction.channel as import('discord.js').TextChannel)?.send(`✅ Dana **${escrow.amount}** berhasil dicairkan ke seller <@${escrow.seller_id}>! Channel akan dihapus dalam 10 detik.`);
        setTimeout(() => (interaction.channel as import('discord.js').TextChannel)?.delete().catch(() => {}), 10000);
        return;
    }

    // Batalkan rekber
    if (isCancel) {
        if (!isStaff && interaction.user.id !== escrow.buyer_id) {
            await interaction.reply({ content: '❌ Hanya Buyer atau Staff yang bisa membatalkan.', ephemeral: true });
            return;
        }

        await pool.query(`UPDATE escrow SET status = 'cancelled' WHERE id = $1`, [escrowId]);

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .spliceFields(4, 1, { name: '📊 Status', value: `❌ Dibatalkan oleh ${interaction.user}`, inline: false })
            .setColor('#FF0000');

        await interaction.update({ embeds: [updatedEmbed], components: [] });
        await (interaction.channel as import('discord.js').TextChannel)?.send(`❌ Rekber dibatalkan. Jika dana sudah ditransfer, hubungi staff untuk proses refund. Channel dihapus dalam 10 detik.`);
        setTimeout(() => (interaction.channel as import('discord.js').TextChannel)?.delete().catch(() => {}), 10000);
    }
}
