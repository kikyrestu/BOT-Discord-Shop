import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { OWNER_ID } from '../config';

// ─── /help — untuk semua member (buyer) ───────────────────────────────────────

export async function handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
        .setTitle('📖  Panduan Penggunaan Bot')
        .setColor('#00CCFF')
        .setDescription(
            'Halo! Berikut command yang bisa kamu pakai sebagai **member/buyer** di server ini.\n' +
            'Mulai order? Kunjungi kategori **🛒 MARKETPLACE** dan klik tombol **Order Sekarang**!'
        )
        .addFields(
            {
                name: '🛒 __Marketplace & Order__',
                value:
                    '`/orderstatus` `[invoice]`\n' +
                    '> Cek status order kamu. Tanpa invoice = tampil semua order aktif.\n\n' +
                    '`/myorders`\n' +
                    '> Lihat riwayat order, total poin loyalty, dan daftar voucher aktif.\n\n' +
                    '`/rekber`\n' +
                    '> Buat transaksi rekening bersama (escrow) — uang aman sampai project selesai.\n\n' +
                    '`/reviews`\n' +
                    '> Lihat semua rating & review jasa dari buyer lain.',
                inline: false,
            },
            {
                name: '🎁 __Loyalty & Voucher__',
                value:
                    '`/redeem` `<kode>`\n' +
                    '> Redeem voucher diskon loyalty. Kode voucher didapat otomatis setiap kelipatan order.\n\n' +
                    '💡 *Setiap order otomatis menambah poin & progress loyalty kamu!*',
                inline: false,
            },
            {
                name: '🎮 __Komunitas__',
                value:
                    'Channel `🎮-share-server-samp` — Share server SA:MP kamu!\n' +
                    '> Format wajib: `Nama Server / IP / Deskripsi`\n' +
                    '> Ada cooldown per akun, post berulang otomatis dihapus.',
                inline: false,
            },
            {
                name: '❓ __Bantuan Lain__',
                value: '> Ping **@Admin** atau **@Owner** jika ada kendala.\n> `/shelp` — Panduan khusus Seller\n> `/devhelp` — Panduan Developer/Staff',
                inline: false,
            },
        )
        .setFooter({ text: 'Bot Marketplace • Ketik /help kapan saja untuk melihat panduan ini' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ─── /shelp — untuk Seller ────────────────────────────────────────────────────

export async function handleSellerHelp(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
        .setTitle('💼  Panduan Seller')
        .setColor('#FFCC00')
        .setDescription(
            'Command khusus untuk **Seller** dalam mengelola produk, pembayaran, dan order.'
        )
        .addFields(
            {
                name: '💳 __Setup Metode Pembayaran__',
                value:
                    '`/payment add`\n' +
                    '> Tambah metode pembayaran barumu (nama, nomor, nama rekening, opsional QR). ' +
                    'Card akan otomatis muncul di channel `💳-cara-pembayaran`.\n\n' +
                    '`/payment remove` `<nama>`\n' +
                    '> Hapus metode pembayaran yang sudah tidak aktif.\n\n' +
                    '`/payment list`\n' +
                    '> Lihat semua metode pembayaran yang kamu miliki.\n\n' +
                    '`/payment refresh`\n' +
                    '> Perbarui tampilan card pembayaranmu di channel.',
                inline: false,
            },
            {
                name: '📦 __Manajemen Produk__',
                value:
                    '`/product list`\n' +
                    '> Lihat semua jasa/produk beserta ID-nya.\n\n' +
                    '`/product edit` `<id>`\n' +
                    '> Edit detail produk (judul, harga, estimasi, deskripsi, dll) lewat form.\n\n' +
                    '`/refreshcards`\n' +
                    '> Refresh semua product card di channel marketplace (rebuild ulang). *(Owner only)*',
                inline: false,
            },
            {
                name: '📋 __Kelola Order__',
                value:
                    '`/orderupdate` `<invoice>` `<status>` `[catatan]`\n' +
                    '> Update status order buyer. Status tersedia:\n' +
                    '> 🟡 `open` → 🔵 `in_progress` → 🟠 `revision` → 🟢 `done` / 🔴 `cancelled`\n' +
                    '> Buyer otomatis dapat DM notifikasi saat status berubah.\n\n' +
                    '✋ **Tombol Klaim Order**\n' +
                    '> Saat ada order baru, notif muncul di `payment-verification` dengan tombol **Klaim Order** — klik untuk assign order ke dirimu.',
                inline: false,
            },
            {
                name: '⚖️ __Rekber (Escrow)__',
                value:
                    'Buyer atau Seller bisa mulai rekber lewat `/rekber`.\n' +
                    'Log transaksi tersimpan di channel `rekber-log`.',
                inline: false,
            },
        )
        .setFooter({ text: 'Bot Marketplace • Seller Guide • Butuh bantuan? Ping @Admin' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ─── /devhelp — untuk Owner/Admin/Staff ───────────────────────────────────────

export async function handleDevHelp(interaction: ChatInputCommandInteraction): Promise<void> {
    // Hanya staff (Admin permission atau Owner)
    const isOwner = interaction.user.id === OWNER_ID;
    const isAdmin = interaction.memberPermissions?.has('Administrator') ?? false;
    if (!isOwner && !isAdmin) {
        await interaction.reply({
            content: '❌ Command ini khusus untuk **Owner** dan **Admin**.',
            ephemeral: true,
        });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('🛠️  Panduan Developer / Staff')
        .setColor('#FF8C00')
        .setDescription(
            'Dokumen lengkap semua command administratif & teknikal bot ini.\n' +
            'Semua di bawah bersifat **ephemeral** (hanya kamu yang lihat).'
        )
        .addFields(
            {
                name: '⚙️ __Konfigurasi Bot__ `/config`',
                value:
                    '`/config view` — Tampilkan semua pengaturan aktif\n' +
                    '`/config set <key> <value>` — Ubah config:\n' +
                    '> • `agency_name` — Nama agency (footer embed)\n' +
                    '> • `promo_cooldown_h` — Cooldown promo dalam jam (default: 6)\n' +
                    '> • `loyalty_threshold` — Kelipatan order untuk reward (default: 5)\n' +
                    '> • `loyalty_points` — Poin per order (default: 10)\n' +
                    '> • `voucher_discount` — Teks diskon voucher (default: 10%)\n' +
                    '`/config reset <key>` — Kembalikan ke nilai default',
                inline: false,
            },
            {
                name: '🔐 __Role-Based Access Control__ `/rbac`',
                value:
                    '__Role:__\n' +
                    '`/rbac role create <name> [color] [hoist] [mentionable]`\n' +
                    '`/rbac role delete <role>`\n' +
                    '`/rbac role assign <user> <role>`\n' +
                    '`/rbac role revoke <user> <role>`\n' +
                    '`/rbac role list`\n\n' +
                    '__Channel Permission:__\n' +
                    '`/rbac channel allow <channel> <role> <permission>` — view/send/readonly/manage\n' +
                    '`/rbac channel deny <channel> <role> <permission>` — all/send/view\n' +
                    '`/rbac channel reset <channel> <role>` — hapus override\n' +
                    '`/rbac channel info <channel>` — lihat semua override\n' +
                    '`/rbac channel lockdown <channel> [reason]` — kunci channel\n' +
                    '`/rbac channel unlock <channel>` — buka kembali\n' +
                    '> 📝 Semua aksi RBAC tercatat di `rbac-log`',
                inline: false,
            },
            {
                name: '🚫 __Blacklist__ `/blacklist`',
                value:
                    '`/blacklist add <user> [alasan]` — Blacklist buyer\n' +
                    '`/blacklist remove <user>` — Hapus dari blacklist\n' +
                    '`/blacklist check <user>` — Cek status blacklist\n' +
                    '`/blacklist list` — Lihat semua yang di-blacklist',
                inline: false,
            },
            {
                name: '📊 __Dashboard & Statistik__ `/dashboard`',
                value: '`/dashboard` — Rekap total order, revenue, buyer aktif, review, escrow aktif.',
                inline: false,
            },
            {
                name: '🏗️ __Setup Server__ `/setup`',
                value:
                    '`/setup` *(Owner only)* — Reset & rebuild seluruh channel, kategori, dan role server dari awal.\n' +
                    '> ⚠️ **Destructive!** Semua channel & role lama akan dihapus.',
                inline: false,
            },
            {
                name: '📡 __Channel Otomatis__',
                value:
                    '• `📊 SERVER STATS` — Voice channel `👥 Members` & `🛒 Buyers` update otomatis\n' +
                    '• `payment-verification` — Notif order baru + tombol Klaim Order\n' +
                    '• `rbac-log` — Audit log semua aksi RBAC\n' +
                    '• `rekber-log` — Log transaksi escrow\n' +
                    '• `📂 ACTIVE PROJECTS` — Hidden by default, muncul saat tiket aktif',
                inline: false,
            },
        )
        .setFooter({ text: 'Bot Marketplace • Developer/Staff Guide' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}
