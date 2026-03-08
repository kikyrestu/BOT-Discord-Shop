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

    // 4. Buat kategori
    const staffRoles = [roleOwner, roleAdmin, roleSeller];
    const staffOverwrites = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        ...staffRoles.map(r => ({ id: r.id, allow: [PermissionFlagsBits.ViewChannel] }))
    ];

    const catCore    = await guild.channels.create({ name: '🛡️ SERVER CORE',     type: ChannelType.GuildCategory });
    const catMarket  = await guild.channels.create({ name: '🛒 MARKETPLACE',     type: ChannelType.GuildCategory });
    // ACTIVE PROJECTS: deny @everyone — kategori hanya muncul untuk customer yang punya tiket aktif
    const catProject = await guild.channels.create({
        name: '📂 ACTIVE PROJECTS',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }],
    });
    const catStaff   = await guild.channels.create({ name: '🏦 INTERNAL STAFF',  type: ChannelType.GuildCategory, permissionOverwrites: staffOverwrites });
    // Stats category — semua orang bisa lihat tapi tidak bisa join/kirim
    const catStats = await guild.channels.create({
        name: '📊 SERVER STATS',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.SendMessages] }],
    });

    await setProjectCatId(catProject.id);

    // Buat stat voice channels
    await createStatChannels(guild, catStats.id);

    // 5. Channel core
    await guild.channels.create({ name: 'rules',         parent: catCore.id, permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.SendMessages] }] });
    await guild.channels.create({ name: 'announcements', parent: catCore.id, permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.SendMessages] }] });

    // 6. Marketplace channels per jasa
    for (const s of await getAllServices()) {
        const chan = await guild.channels.create({
            name: s.name, parent: catMarket.id,
            permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.SendMessages] }]
        });
        const { embed, row } = await buildServiceCard(s);
        await chan.send({ embeds: [embed], components: [row] });
    }

    // Channel cara pembayaran (seller isi sendiri via /payment)
    const payGuideEmbed = new EmbedBuilder()
        .setTitle('💳 Cara Pembayaran')
        .setDescription(
            'Di channel ini setiap **Seller** menampilkan metode pembayaran mereka.\n\n' +
            '**Untuk Seller:**\n' +
            '`/payment add` — Tambah metode pembayaran\n' +
            '`/payment remove` — Hapus metode pembayaran\n' +
            '`/payment list` — Lihat daftar metode kamu\n' +
            '`/payment refresh` — Perbarui card di channel ini\n\n' +
            '**Untuk Buyer:**\n' +
            'Lihat card di bawah dan transfer ke metode yang sesuai, lalu konfirmasi ke seller di tiket order kamu.'
        )
        .setColor('#F5A623')
        .setFooter({ text: 'Maheswara Agency • Selalu konfirmasi pembayaran ke seller' });
    const payChan = await guild.channels.create({
        name: PAYMENT_CHANNEL_NAME, parent: catMarket.id,
        permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.SendMessages] }]
    });
    await payChan.send({ embeds: [payGuideEmbed] });

    // 7. Kategori & channel komunitas
    const catCommunity = await guild.channels.create({ name: '🌏 KOMUNITAS', type: ChannelType.GuildCategory });
    const promoChan = await guild.channels.create({ name: PROMO_CHANNEL_NAME, parent: catCommunity.id });
    await guild.channels.create({ name: '⭐-reviews', parent: catCommunity.id, permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.SendMessages] }] });

    // Kirim panduan format di channel share server
    const promoGuideEmbed = new EmbedBuilder()
        .setTitle('🎮 Channel Share Server SA:MP')
        .setDescription(
            'Share server SA:MP kamu di sini dan kenalkan ke komunitas!\n\n' +
            '**⚠️ Aturan:**\n' +
            '• Khusus untuk server SA:MP\n' +
            '• Cooldown **6 jam** per akun\n' +
            '• Wajib menggunakan format di bawah\n\n' +
            '**📝 Format Wajib:**\n```\nNama Server: ...\nIP: ...\nDeskripsi: ...\n```'
        )
        .setColor('#00fbff')
        .setFooter({ text: 'Post yang tidak sesuai format akan otomatis dihapus' });
    await promoChan.send({ embeds: [promoGuideEmbed] });

    // 8. Staff channels
    await guild.channels.create({
        name: 'payment-verification', parent: catStaff.id,
        permissionOverwrites: staffOverwrites
    });
    await guild.channels.create({
        name: 'rekber-log', parent: catStaff.id,
        permissionOverwrites: staffOverwrites
    });
    await guild.channels.create({
        name: 'rbac-log', parent: catStaff.id,
        permissionOverwrites: staffOverwrites
    });

    console.log('✅ Server Setup Selesai!');

    // DM owner karena channel asalnya udah ke-delete
    await interaction.user.send('✅ **Server setup selesai!** Semua channel & role sudah dibuat ulang.').catch(() => {});
}
