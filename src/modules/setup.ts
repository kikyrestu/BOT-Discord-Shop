import { Interaction, ChannelType, PermissionFlagsBits, ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { OWNER_ID, ROLE_NAMES } from '../config';
import { setProjectCatId } from '../state';
import { getAllServices } from '../lib/serviceStore';
import { buildServiceCard } from './card';
import { PROMO_CHANNEL_NAME } from './promo';
import { PAYMENT_CHANNEL_NAME } from './payment';
import { createStatChannels } from './stats';

// ── Panduan embed builders (shared between setup & /updpanduan) ───────────────

export function buildSellerPanduanEmbed(): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle('📋 Panduan Seller — Fitur Lengkap')
        .setColor('#FFCC00')
        .setDescription(
            '🔴 = Owner only  ·  🟠 = Admin+Owner  ·  🟡 = Seller+Admin+Owner  ·  🌐 = Semua\n\n' +

            '**💼 MANAJEMEN LAYANANMU**\n' +
            '`/payment add` — Tambah metode pembayaran 🟡\n' +
            '`/payment remove` — Hapus metode pembayaran 🟡\n' +
            '`/payment list` — Lihat daftar payment method 🟡\n' +
            '`/payment refresh` — Perbarui card pembayaran di channel 🟡\n\n' +

            '**📦 ORDER & TRANSAKSI**\n' +
            '`/orderupdate` — Update status order (open/progress/done/dll) 🟡\n' +
            '`/orderstatus` — Cek status order tertentu 🌐\n' +
            '`/rekber` — Buka sesi rekening bersama / escrow 🟡\n\n' +

            '**📊 DASHBOARD & STATISTIK**\n' +
            '`/sellerdash` — Dashboard order aktif, statistik per layanan & payment kamu 🟡\n' +
            '`/reviews` — Lihat rating & review semua layanan 🌐\n\n' +

            '**🛍️ PRODUK (dikelola Owner)**\n' +
            '`/product list` — Lihat semua produk & ID-nya 🔴\n' +
            '`/product edit` — Edit detail layanan 🔴\n' +
            '`/refreshcards` — Refresh semua card produk 🔴\n\n' +

            '**❓ BANTUAN**\n' +
            '`/shelp` — Panduan singkat command seller 🟡\n' +
            '`/help` — Panduan umum untuk semua member 🌐'
        )
        .setFooter({ text: 'Channel ini read-only • Ketik command di 🖥️-seller-terminal' });
}

export function buildAdminPanduanEmbed(): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle('📋 Panduan Admin — Fitur Lengkap')
        .setColor('#FF6600')
        .setDescription(
            '🔴 = Owner only  ·  🟠 = Admin+Owner  ·  🟡 = Seller+Admin+Owner  ·  🌐 = Semua\n\n' +

            '**🛡️ MODERASI & KEAMANAN**\n' +
            '`/blacklist` — Kelola daftar hitam buyer (tambah/hapus/cek/list) 🟠\n' +
            '`/rbac` — Kelola role & akses channel via panel interaktif 🟠\n\n' +

            '**📊 MONITORING & STATISTIK**\n' +
            '`/dashboard` — Dashboard lengkap: order, customer, review, blacklist 🟠\n' +
            '`/sellerdash` — Dashboard statistik per layanan & order aktif 🟠\n' +
            '`/reviews` — Lihat rata-rata rating semua layanan 🌐\n\n' +

            '**📦 ORDER MANAGEMENT**\n' +
            '`/orderupdate` — Update status order & kirim notif ke buyer 🟡\n' +
            '`/orderstatus` — Cek status order tertentu 🌐\n\n' +

            '**⚙️ KONFIGURASI**\n' +
            '`/config` — Pengaturan bot (promo cooldown, dll) 🟠\n' +
            '`/updpanduan` — Update semua channel panduan ke versi terbaru 🔴\n\n' +

            '**❓ BANTUAN**\n' +
            '`/devhelp` — Panduan lengkap command admin & owner 🟠\n' +
            '`/help` — Panduan umum 🌐'
        )
        .setFooter({ text: 'Channel ini read-only • Ketik command di 🖥️-admin-terminal' });
}

export function buildOwnerPanduanEmbed(): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle('📋 Panduan Owner — Semua Akses')
        .setColor('#FF0000')
        .setDescription(
            '🔴 = Owner only  ·  🟠 = Admin+Owner  ·  🟡 = Seller+Admin+Owner  ·  🌐 = Semua\n\n' +

            '**🔴 EKSKLUSIF OWNER**\n' +
            '`/setup` — Setup ulang seluruh server dari nol (⚠️ menghapus semua channel & role)\n' +
            '`/panel` — Panel server: buat/hapus/rename channel, kelola role, config\n' +
            '`/refreshcards` — Refresh semua product cards di marketplace\n' +
            '`/product list` — Lihat semua produk & ID\n' +
            '`/product edit` — Edit detail produk/layanan\n' +
            '`/updpanduan` — Update semua channel panduan ke versi terbaru\n\n' +

            '**🟠 ADMIN + OWNER**\n' +
            '`/dashboard` — Dashboard lengkap marketplace\n' +
            '`/sellerdash` — Dashboard statistik per layanan\n' +
            '`/rbac` — Kelola role & akses channel\n' +
            '`/blacklist` — Kelola blacklist buyer\n' +
            '`/config` — Pengaturan bot\n' +
            '`/orderupdate` — Update status order\n' +
            '`/devhelp` — Panduan command staff\n\n' +

            '**🟡 SELLER + ADMIN + OWNER**\n' +
            '`/payment add/remove/list/refresh` — Kelola metode pembayaran\n' +
            '`/rekber` — Buka sesi rekening bersama\n' +
            '`/sellerdash` — Dashboard toko\n\n' +

            '**🌐 SEMUA MEMBER**\n' +
            '`/orderstatus` — Cek status order\n' +
            '`/reviews` — Lihat rating layanan\n' +
            '`/myorders` — Riwayat & loyalty poin\n' +
            '`/help` — Panduan umum'
        )
        .setFooter({ text: 'Channel ini read-only • Owner only • Ketik command di 🖥️-owner-terminal' });
}

// ── /updpanduan command ───────────────────────────────────────────────────────
export async function handleUpdPanduan(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (interaction.user.id !== OWNER_ID) {
        await interaction.reply({ content: '❌ Hanya Owner yang bisa update panduan.', ephemeral: true });
        return;
    }
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const targets: Array<{ name: string; builder: () => EmbedBuilder }> = [
        { name: '📋-panduan-seller', builder: buildSellerPanduanEmbed },
        { name: '📋-panduan-admin',  builder: buildAdminPanduanEmbed  },
        { name: '📋-panduan-owner',  builder: buildOwnerPanduanEmbed  },
    ];

    const results: string[] = [];
    for (const t of targets) {
        const chan = guild.channels.cache.find(c => c.name === t.name) as TextChannel | undefined;
        if (!chan || !chan.isTextBased()) {
            results.push(`❌ \`${t.name}\` tidak ditemukan`);
            continue;
        }
        // Hapus pesan lama bot di channel itu lalu kirim ulang
        const messages = await chan.messages.fetch({ limit: 10 });
        for (const msg of messages.values()) {
            if (msg.author.bot) await msg.delete().catch(() => {});
        }
        await chan.send({ embeds: [t.builder()] });
        results.push(`✅ \`${t.name}\` diperbarui`);
    }

    await interaction.editReply({
        content: '**Update Panduan Selesai:**\n' + results.join('\n'),
    });
}


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
    await guideSellerChan.send({ embeds: [buildSellerPanduanEmbed()] });

    await guild.channels.create({ name: '💼-seller-lounge',   parent: catSeller.id, permissionOverwrites: sellerCat });
    await guild.channels.create({ name: '🖥️-seller-terminal', parent: catSeller.id, permissionOverwrites: sellerCat });
    await guild.channels.create({ name: '🔊-seller-voice', type: ChannelType.GuildVoice, parent: catSeller.id, permissionOverwrites: sellerCat } as any);

    // ── 7. Internal Staff ──────────────────────────────────────────────────────
    const catStaff = await guild.channels.create({ name: '🏦 INTERNAL STAFF', type: ChannelType.GuildCategory, permissionOverwrites: adminCat });

    const guideAdminChan = await guild.channels.create({ name: '📋-panduan-admin', parent: catStaff.id, permissionOverwrites: adminRO });
    await guideAdminChan.send({ embeds: [buildAdminPanduanEmbed()] });

    const guideOwnerChan = await guild.channels.create({ name: '📋-panduan-owner', parent: catStaff.id, permissionOverwrites: ownerRO });
    await guideOwnerChan.send({ embeds: [buildOwnerPanduanEmbed()] });

    await guild.channels.create({ name: '🖥️-admin-terminal',      parent: catStaff.id, permissionOverwrites: adminCat });
    await guild.channels.create({ name: '🖥️-owner-terminal',       parent: catStaff.id, permissionOverwrites: ownerCat });
    await guild.channels.create({ name: '💰-payment-verification', parent: catStaff.id, permissionOverwrites: sellerCat });
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
    await guild.channels.create({ name: PROMO_CHANNEL_NAME, parent: catCommunity.id });
    await guild.channels.create({ name: '💬-general', parent: catCommunity.id });
    await guild.channels.create({ name: '🔊-voice-chat', type: ChannelType.GuildVoice, parent: catCommunity.id } as any);

    console.log('✅ Server Setup Selesai!');
    await interaction.user.send('✅ **Server setup selesai!** Semua channel & role sudah dibuat ulang.').catch(() => {});
}
