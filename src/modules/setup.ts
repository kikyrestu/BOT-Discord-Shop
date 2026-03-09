import { Interaction, ChannelType, PermissionFlagsBits, ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { OWNER_ID, ROLE_NAMES } from '../config';
import { setProjectCatId } from '../state';
import { getAllServices } from '../lib/serviceStore';
import { buildServiceCard } from './card';
import { PROMO_CHANNEL_NAME } from './promo';
import { PAYMENT_CHANNEL_NAME } from './payment';
import { createStatChannels } from './stats';
import { WELCOME_CHANNEL_NAME } from './welcome';

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
        .setTitle('🔍 Konfirmasi Setup — Mode Scan & Isi')
        .setDescription(
            '**Setup akan:**\n\n' +
            '🔍 Scan semua role & channel yang sudah ada\n' +
            '➕ Menambahkan yang **belum ada** saja\n' +
            '✅ Tidak menghapus apapun yang sudah ada\n\n' +
            '**Aman dijalankan kapan saja, data tidak akan hilang.**'
        )
        .setColor('#00CCFF');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('setup_confirm').setLabel('Scan & Isi Sekarang').setEmoji('🔍').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('setup_cancel').setLabel('Batal').setEmoji('❌').setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// Step 2: tombol Konfirmasi diklik → scan & isi yang kurang
export async function handleSetupConfirm(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild || interaction.user.id !== OWNER_ID) {
        await interaction.reply({ content: '❌ Bukan lu yang request setup ini.', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    const guild  = interaction.guild;
    const log: string[] = [];

    // ── Helper: cari role by name, buat kalau belum ada ──────────────────────
    async function ensureRole(name: string, opts: Parameters<typeof guild.roles.create>[0]) {
        let role = guild.roles.cache.find(r => r.name === name);
        if (!role) {
            role = await guild.roles.create({ name, ...opts });
            log.push(`➕ Role **${name}** dibuat`);
        } else {
            log.push(`✅ Role **${name}** sudah ada`);
        }
        return role;
    }

    // ── Helper: cari category by name, buat kalau belum ada ──────────────────
    async function ensureCategory(name: string, opts: any = {}) {
        let cat = guild.channels.cache.find(c => c.name === name && c.type === ChannelType.GuildCategory);
        if (!cat) {
            cat = await guild.channels.create({ name, type: ChannelType.GuildCategory, ...opts });
            log.push(`➕ Kategori **${name}** dibuat`);
        } else {
            log.push(`✅ Kategori **${name}** sudah ada`);
        }
        return cat;
    }

    // ── Helper: cari text channel by name, buat kalau belum ada ──────────────
    async function ensureChannel(name: string, opts: any = {}, onCreated?: (chan: TextChannel) => Promise<void>) {
        let chan = guild.channels.cache.find(c => c.name === name && c.isTextBased()) as TextChannel | undefined;
        if (!chan) {
            chan = await guild.channels.create({ name, type: ChannelType.GuildText, ...opts }) as TextChannel;
            log.push(`➕ Channel **#${name}** dibuat`);
            if (onCreated) await onCreated(chan);
        } else {
            log.push(`✅ Channel **#${name}** sudah ada`);
        }
        return chan;
    }

    // ── Helper: cari voice channel by name, buat kalau belum ada ─────────────
    async function ensureVoice(name: string, opts: any = {}) {
        if (!guild.channels.cache.find(c => c.name === name && c.type === ChannelType.GuildVoice)) {
            await guild.channels.create({ name, type: ChannelType.GuildVoice, ...opts } as any);
            log.push(`➕ Voice **${name}** dibuat`);
        } else {
            log.push(`✅ Voice **${name}** sudah ada`);
        }
    }

    // ── 1. Roles ──────────────────────────────────────────────────────────────
    const roleOwner  = await ensureRole(ROLE_NAMES.OWNER,    { color: '#FF0000', hoist: true, permissions: [PermissionFlagsBits.Administrator] });
    const roleAdmin  = await ensureRole(ROLE_NAMES.ADMIN,    { color: '#FF6600', hoist: true, permissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ViewChannel] });
    const roleSeller = await ensureRole(ROLE_NAMES.SELLER,   { color: '#FFCC00', hoist: true, permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
    await ensureRole(ROLE_NAMES.CUSTOMER, { color: '#00CCFF', hoist: true, permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
    await ensureRole(ROLE_NAMES.LOYAL,    { color: '#FFD700', hoist: true, permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

    // Assign Owner role ke owner member kalau belum punya
    const ownerMember = await guild.members.fetch(OWNER_ID).catch(() => null);
    if (ownerMember && !ownerMember.roles.cache.has(roleOwner.id)) {
        await ownerMember.roles.add(roleOwner).catch(() => {});
        log.push(`➕ Role **${ROLE_NAMES.OWNER}** di-assign ke Owner`);
    }

    // ── Permission Overwrites ─────────────────────────────────────────────────
    const readOnly  = [{ id: guild.id, deny: [PermissionFlagsBits.SendMessages] }];
    const hiddenAll = [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel]  }];

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
    const ownerCat = [
        { id: guild.id,     deny:  [PermissionFlagsBits.ViewChannel] },
        { id: roleOwner.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ];
    const ownerRO = [
        { id: guild.id,     deny:  [PermissionFlagsBits.ViewChannel] },
        { id: roleOwner.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
    ];

    // ── 2. Stats category ─────────────────────────────────────────────────────
    const catStats = await ensureCategory('📊 SERVER STATS', {
        permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.SendMessages] }],
    });
    // Stat voice channels created by createStatChannels if missing
    const existingStats = guild.channels.cache.filter(c => c.parentId === (catStats as any).id);
    if (existingStats.size === 0) {
        await createStatChannels(guild, (catStats as any).id);
        log.push('➕ Stat channels dibuat');
    } else {
        log.push('✅ Stat channels sudah ada');
    }

    // ── 3. Server Core ─────────────────────────────────────────────────────────
    const catCore = await ensureCategory('🛡️ SERVER CORE');
    await ensureChannel('📜-rules',           { parent: (catCore as any).id, permissionOverwrites: readOnly });
    await ensureChannel('📢-announcements',   { parent: (catCore as any).id, permissionOverwrites: readOnly });
    await ensureChannel(WELCOME_CHANNEL_NAME, { parent: (catCore as any).id, permissionOverwrites: readOnly });

    // ── 4. Seller Zone ─────────────────────────────────────────────────────────
    const catSeller = await ensureCategory('👔 SELLER ZONE', { permissionOverwrites: sellerCat });
    await ensureChannel('📋-panduan-seller', { parent: (catSeller as any).id, permissionOverwrites: sellerRO }, async (chan) => {
        await chan.send({ embeds: [buildSellerPanduanEmbed()] });
    });
    await ensureChannel('💼-seller-lounge',   { parent: (catSeller as any).id, permissionOverwrites: sellerCat });
    await ensureChannel('🖥️-seller-terminal', { parent: (catSeller as any).id, permissionOverwrites: sellerCat });
    await ensureVoice  ('🔊-seller-voice',    { parent: (catSeller as any).id, permissionOverwrites: sellerCat });

    // ── 5. Internal Staff ──────────────────────────────────────────────────────
    const catStaff = await ensureCategory('🏦 INTERNAL STAFF', { permissionOverwrites: adminCat });
    await ensureChannel('📋-panduan-admin', { parent: (catStaff as any).id, permissionOverwrites: adminRO }, async (chan) => {
        await chan.send({ embeds: [buildAdminPanduanEmbed()] });
    });
    await ensureChannel('📋-panduan-owner', { parent: (catStaff as any).id, permissionOverwrites: ownerRO }, async (chan) => {
        await chan.send({ embeds: [buildOwnerPanduanEmbed()] });
    });
    await ensureChannel('🖥️-admin-terminal',      { parent: (catStaff as any).id, permissionOverwrites: adminCat });
    await ensureChannel('🖥️-owner-terminal',       { parent: (catStaff as any).id, permissionOverwrites: ownerCat });
    await ensureChannel('💰-payment-verification', { parent: (catStaff as any).id, permissionOverwrites: sellerCat });
    await ensureChannel('🔒-rekber-log',           { parent: (catStaff as any).id, permissionOverwrites: adminCat });
    await ensureChannel('📋-rbac-log',             { parent: (catStaff as any).id, permissionOverwrites: adminCat });

    // ── 6. Marketplace ─────────────────────────────────────────────────────────
    const catMarket = await ensureCategory('🛒 MARKETPLACE');

    const sellerRoleObj = guild.roles.cache.find(r => r.name === ROLE_NAMES.SELLER);
    for (const s of await getAllServices()) {
        if (!(s as any).seller_id) continue;
        // Buat channel marketplace kalau belum ada
        if (!guild.channels.cache.find(c => c.name === s.name)) {
            const perms: any[] = [
                { id: guild.id, deny: [PermissionFlagsBits.SendMessages] },
            ];
            if (sellerRoleObj) perms.push({ id: sellerRoleObj.id, deny: [PermissionFlagsBits.ViewChannel] });
            perms.push({ id: (s as any).seller_id, allow: [PermissionFlagsBits.ViewChannel] });
            const chan = await guild.channels.create({ name: s.name, type: ChannelType.GuildText, parent: (catMarket as any).id, permissionOverwrites: perms }) as TextChannel;
            const { embed, row } = await buildServiceCard(s);
            await chan.send({ embeds: [embed], components: [row] });
            log.push(`➕ Channel marketplace **#${s.name}** dibuat`);
        } else {
            log.push(`✅ Channel marketplace **#${s.name}** sudah ada`);
        }
    }

    await ensureChannel(PAYMENT_CHANNEL_NAME, { parent: (catMarket as any).id, permissionOverwrites: readOnly }, async (chan) => {
        await chan.send({ embeds: [new EmbedBuilder()
            .setTitle('💳 Cara Pembayaran & Alur Order')
            .setColor('#F5A623')
            .setDescription(
                '**Selamat datang di Maheswara Agency!**\n' +
                'Berikut panduan lengkap mulai dari order sampai proyek selesai.\n\u200b'
            )
            .addFields(
                { name: '📋 Step 1 — Pilih Layanan',    value: '› Jelajahi channel di kategori **🛒 MARKETPLACE**\n› Klik **🛒 Order Sekarang** atau **💬 Tanya Dulu** di card layanan', inline: false },
                { name: '🎫 Step 2 — Tiket Order',       value: '› Bot otomatis buat channel private khusus kamu & seller\n› Ceritakan detail project: fitur, budget, deadline', inline: false },
                { name: '💸 Step 3 — Pembayaran',        value: '› Sepakati harga dgn seller, transfer, lalu klik **💸 Sudah Transfer**\n› Seller konfirmasi → status jadi **Sedang Dikerjakan**', inline: false },
                { name: '🔨 Step 4 — Pengerjaan',        value: '› Pantau status via `/orderstatus` · Kamu dapat DM setiap update', inline: false },
                { name: '✅ Step 5 — Selesai & Review',  value: '› Seller closing tiket → Kamu dapat DM untuk kasih **⭐ rating**', inline: false },
                { name: '⚠️ Penting',                    value: '› Jangan transfer sebelum ada kesepakatan di tiket\n› Simpan screenshot bukti transfer', inline: false },
            )
            .setFooter({ text: 'Maheswara Agency • Transparansi adalah prioritas kami' })
        ]});
    });

    await ensureChannel('⭐-reviews', { parent: (catMarket as any).id, permissionOverwrites: readOnly });

    // ── 7. Active Projects ─────────────────────────────────────────────────────
    const catProject = await ensureCategory('📂 ACTIVE PROJECTS', { permissionOverwrites: hiddenAll });
    await setProjectCatId((catProject as any).id);

    // ── 8. Komunitas ───────────────────────────────────────────────────────────
    const catCommunity = await ensureCategory('🌏 KOMUNITAS');
    await ensureChannel(PROMO_CHANNEL_NAME, { parent: (catCommunity as any).id });
    await ensureChannel('💬-general',       { parent: (catCommunity as any).id });
    await ensureVoice  ('🔊-voice-chat',    { parent: (catCommunity as any).id });

    // ── Summary ────────────────────────────────────────────────────────────────
    const added   = log.filter(l => l.startsWith('➕')).length;
    const skipped = log.filter(l => l.startsWith('✅')).length;
    const summary = `**Setup Selesai!** ${added} item ditambahkan, ${skipped} item sudah ada.\n\n` +
        log.slice(-30).join('\n'); // tampilkan max 30 baris terakhir

    console.log('✅ Setup (scan & fill) Selesai:', { added, skipped });
    await interaction.user.send(`✅ **Setup selesai!** ${added} item baru ditambahkan.`).catch(() => {});
    await interaction.editReply({ content: summary });
}