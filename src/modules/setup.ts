import { Interaction, ChannelType, PermissionFlagsBits, ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { OWNER_ID, ROLE_NAMES } from '../config';
import { setProjectCatId } from '../state';
import { getAllServices } from '../lib/serviceStore';
import { buildServiceCard } from './card';
import { PROMO_CHANNEL_NAME } from './promo';
import { PAYMENT_CHANNEL_NAME } from './payment';
import { createStatChannels } from './stats';

// Step 1: /setup → tampilkan konfirmasi dulu, belum ngapa-ngapain
export async function handleSetupRequest(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (interaction.user.id !== OWNER_ID) {
        await interaction.reply({ content: '❌ Hanya Owner yang bisa menjalankan setup.', ephemeral: true });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('⚠️ Konfirmasi Server Reset')
        .setDescription(
            '**PERINGATAN!** Aksi ini akan:\n\n' +
            '🗑️ Menghapus **SEMUA** channel yang ada\n' +
            '🗑️ Menghapus **SEMUA** role yang ada\n' +
            '🔨 Membuat ulang seluruh struktur server dari awal\n\n' +
            '**Aksi ini tidak bisa dibatalkan!** Yakin mau lanjut?'
        )
        .setColor('#FF0000');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('setup_confirm').setLabel('Ya, Lanjutkan').setEmoji('✅').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('setup_cancel').setLabel('Batal').setEmoji('❌').setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// Step 2: tombol Konfirmasi diklik → jalankan setup sebenarnya
export async function handleSetupConfirm(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild || interaction.user.id !== OWNER_ID) {
        await interaction.reply({ content: '❌ Bukan lu yang request setup ini.', ephemeral: true });
        return;
    }

    // Defer sebelum channel-nya ilang
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;

    // 1. Hapus semua channel
    const channels = await guild.channels.fetch();
    for (const channel of channels.values()) {
        if (channel) await channel.delete().catch(() => {});
    }

    // 2. Hapus role lama (kecuali @everyone & managed/bot roles)
    const roles = await guild.roles.fetch();
    for (const role of roles.values()) {
        if (!role.managed && role.id !== guild.id) {
            await role.delete().catch(() => {});
        }
    }

    // 3. Buat semua roles
    const roleOwner = await guild.roles.create({
        name: ROLE_NAMES.OWNER, color: '#FF0000', hoist: true,
        permissions: [PermissionFlagsBits.Administrator],
    });
    const roleAdmin = await guild.roles.create({
        name: ROLE_NAMES.ADMIN, color: '#FF6600', hoist: true,
        permissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ViewChannel],
    });
    const roleSeller = await guild.roles.create({
        name: ROLE_NAMES.SELLER, color: '#FFCC00', hoist: true,
        permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
    });
    await guild.roles.create({
        name: ROLE_NAMES.CUSTOMER, color: '#00CCFF', hoist: true,
        permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
    });
    await guild.roles.create({
        name: ROLE_NAMES.LOYAL, color: '#FFD700', hoist: true,
        permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
    });

    const ownerMember = await guild.members.fetch(OWNER_ID).catch(() => null);
    if (ownerMember) await ownerMember.roles.add(roleOwner).catch(() => {});

    // ── Permission Overwrites ─────────────────────────────────────────────────
    const readOnly     = [{ id: guild.id, deny: [PermissionFlagsBits.SendMessages] }];
    const hiddenAll    = [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }];

    // Seller Zone: Seller + Admin + Owner
    const sellerCat = [
        { id: guild.id,      deny:  [PermissionFlagsBits.ViewChannel] },
        { id: roleOwner.id,  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: roleAdmin.id,  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: roleSeller.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ];
    const sellerRO = [
        { id: guild.id,      deny:  [PermissionFlagsBits.ViewChannel] },
        { id: roleOwner.id,  allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
        { id: roleAdmin.id,  allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
        { id: roleSeller.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
    ];

    // Internal Staff: Admin + Owner only
    const adminCat = [
        { id: guild.id,     deny:  [PermissionFlagsBits.ViewChannel] },
        { id: roleOwner.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        { id: roleAdmin.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ];
    const adminRO = [
        { id: guild.id,     deny:  [PermissionFlagsBits.ViewChannel] },
        { id: roleOwner.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
        { id: roleAdmin.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
    ];

    // Owner only
    const ownerCat = [
        { id: guild.id,     deny:  [PermissionFlagsBits.ViewChannel] },
        { id: roleOwner.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ];
    const ownerRO = [
        { id: guild.id,     deny:  [PermissionFlagsBits.ViewChannel] },
        { id: roleOwner.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
    ];

    // ── 4. Stats (pertama = paling atas) ──────────────────────────────────────
    const catStats = await guild.channels.create({
        name: '📊 SERVER STATS', type: ChannelType.GuildCategory,
        permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.SendMessages] }],
    });
    await createStatChannels(guild, catStats.id);

    // ── 5. Server Core ─────────────────────────────────────────────────────────
    const catCore = await guild.channels.create({ name: '🛡️ SERVER CORE', type: ChannelType.GuildCategory });
    await guild.channels.create({ name: '📜-rules',         parent: catCore.id, permissionOverwrites: readOnly });
    await guild.channels.create({ name: '📢-announcements', parent: catCore.id, permissionOverwrites: readOnly });

    // ── 6. Seller Zone ─────────────────────────────────────────────────────────
    const catSeller = await guild.channels.create({ name: '👔 SELLER ZONE', type: ChannelType.GuildCategory, permissionOverwrites: sellerCat });

    const guideSellerChan = await guild.channels.create({ name: '📋-panduan-seller', parent: catSeller.id, permissionOverwrites: sellerRO });
    await guideSellerChan.send({ embeds: [new EmbedBuilder()
        .setTitle('📋 Panduan Seller')
        .setColor('#FFCC00')
        .setDescription(
            'Selamat datang di **Seller Zone**! Berikut command yang tersedia:\n\n' +
            '`/shelp` — Lihat semua command seller\n' +
            '`/product add` — Tambah layanan baru\n' +
            '`/product edit` — Edit layanan\n' +
            '`/product delete` — Hapus layanan\n' +
            '`/payment add` — Tambah metode pembayaran\n' +
            '`/payment remove` — Hapus metode pembayaran\n' +
            '`/payment refresh` — Perbarui card pembayaran\n' +
            '`/orderupdate` — Update status order\n' +
            '`/rekber` — Buka sesi rekber/escrow\n\n' +
            '💡 Ketik semua command di **🖥️-seller-terminal**'
        )
        .setFooter({ text: 'Channel ini read-only' })
    ]});

    await guild.channels.create({ name: '💼-seller-lounge',   parent: catSeller.id, permissionOverwrites: sellerCat });
    await guild.channels.create({ name: '🖥️-seller-terminal', parent: catSeller.id, permissionOverwrites: sellerCat });

    // ── 7. Internal Staff ──────────────────────────────────────────────────────
    const catStaff = await guild.channels.create({ name: '🏦 INTERNAL STAFF', type: ChannelType.GuildCategory, permissionOverwrites: adminCat });

    const guideAdminChan = await guild.channels.create({ name: '📋-panduan-admin', parent: catStaff.id, permissionOverwrites: adminRO });
    await guideAdminChan.send({ embeds: [new EmbedBuilder()
        .setTitle('📋 Panduan Admin')
        .setColor('#FF6600')
        .setDescription(
            'Berikut command untuk **Admin**:\n\n' +
            '`/devhelp` — Lihat semua command admin\n' +
            '`/rbac` — Kelola role & akses channel\n' +
            '`/blacklist` — Kelola daftar hitam buyer\n' +
            '`/config` — Pengaturan bot\n' +
            '`/dashboard` — Dashboard transaksi\n' +
            '`/stats` — Statistik server\n' +
            '`/orderupdate` — Update status order\n\n' +
            '💡 Ketik semua command di **🖥️-admin-terminal**'
        )
        .setFooter({ text: 'Channel ini read-only' })
    ]});

    const guideOwnerChan = await guild.channels.create({ name: '📋-panduan-owner', parent: catStaff.id, permissionOverwrites: ownerRO });
    await guideOwnerChan.send({ embeds: [new EmbedBuilder()
        .setTitle('📋 Panduan Owner')
        .setColor('#FF0000')
        .setDescription(
            'Berikut command eksklusif **Owner**:\n\n' +
            '`/panel` — Panel admin server (channel, role, config)\n' +
            '`/setup` — Setup ulang seluruh server\n' +
            '`/refresh` — Refresh semua product cards\n' +
            '`/config` — Pengaturan bot\n' +
            '`/rbac` — Kelola role & akses channel\n' +
            '`/blacklist` — Kelola daftar hitam\n' +
            '`/devhelp` — Semua command owner\n\n' +
            '💡 Ketik semua command di **🖥️-owner-terminal**'
        )
        .setFooter({ text: 'Channel ini read-only — Owner only' })
    ]});

    await guild.channels.create({ name: '🖥️-admin-terminal',      parent: catStaff.id, permissionOverwrites: adminCat });
    await guild.channels.create({ name: '🖥️-owner-terminal',       parent: catStaff.id, permissionOverwrites: ownerCat });
    await guild.channels.create({ name: '💰-payment-verification', parent: catStaff.id, permissionOverwrites: adminCat });
    await guild.channels.create({ name: '🔒-rekber-log',           parent: catStaff.id, permissionOverwrites: adminCat });
    await guild.channels.create({ name: '📋-rbac-log',             parent: catStaff.id, permissionOverwrites: adminCat });

    // ── 8. Marketplace ─────────────────────────────────────────────────────────
    const catMarket = await guild.channels.create({ name: '🛒 MARKETPLACE', type: ChannelType.GuildCategory });

    for (const s of await getAllServices()) {
        const chan = await guild.channels.create({ name: s.name, parent: catMarket.id, permissionOverwrites: readOnly });
        const { embed, row } = await buildServiceCard(s);
        await chan.send({ embeds: [embed], components: [row] });
    }

    const payChan = await guild.channels.create({ name: PAYMENT_CHANNEL_NAME, parent: catMarket.id, permissionOverwrites: readOnly });
    await payChan.send({ embeds: [new EmbedBuilder()
        .setTitle('💳 Cara Pembayaran')
        .setColor('#F5A623')
        .setDescription(
            '**Metode pembayaran tersedia dari para Seller.**\n\n' +
            'Lihat card pembayaran di bawah, transfer ke metode yang sesuai dengan seller kamu, ' +
            'lalu konfirmasi ke seller di tiket order kamu.\n\n' +
            '⚠️ Selalu konfirmasi pembayaran sebelum menganggap order selesai.'
        )
        .setFooter({ text: 'Maheswara Agency • Selalu konfirmasi ke seller' })
    ]});

    await guild.channels.create({ name: '⭐-reviews', parent: catMarket.id, permissionOverwrites: readOnly });

    // ── 9. Active Projects ─────────────────────────────────────────────────────
    const catProject = await guild.channels.create({ name: '📂 ACTIVE PROJECTS', type: ChannelType.GuildCategory, permissionOverwrites: hiddenAll });
    await setProjectCatId(catProject.id);

    // ── 10. Komunitas ──────────────────────────────────────────────────────────
    const catCommunity = await guild.channels.create({ name: '🌏 KOMUNITAS', type: ChannelType.GuildCategory });
    const promoChan = await guild.channels.create({ name: PROMO_CHANNEL_NAME, parent: catCommunity.id });
    await guild.channels.create({ name: '💬-general', parent: catCommunity.id });

    await promoChan.send({ embeds: [new EmbedBuilder()
        .setTitle('🎮 Channel Share Server SA:MP')
        .setColor('#00fbff')
        .setDescription(
            'Share server SA:MP kamu di sini!\n\n' +
            '**⚠️ Aturan:**\n' +
            '• Khusus untuk server SA:MP\n' +
            '• Cooldown **6 jam** per akun\n' +
            '• Wajib menggunakan format di bawah\n\n' +
            '**📝 Format Wajib:**\n```\nNama Server: ...\nIP: ...\nDeskripsi: ...\n```'
        )
        .setFooter({ text: 'Post yang tidak sesuai format akan otomatis dihapus' })
    ]});

    console.log('✅ Server Setup Selesai!');
    await interaction.user.send('✅ **Server setup selesai!** Semua channel & role sudah dibuat ulang.').catch(() => {});
}
