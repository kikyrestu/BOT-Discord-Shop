import 'dotenv/config';
import {
    Client, GatewayIntentBits, Events, Partials,
    REST, Routes, SlashCommandBuilder,
} from 'discord.js';
import { TOKEN, OWNER_ID } from './src/config';
import { initDB } from './src/lib/db';
import { loadProjectCatId } from './src/state';
import { handleSetupRequest, handleSetupConfirm, handleUpdPanduan } from './src/modules/setup';
import { handleTicket, handleCloseTicket,
    handleSetPrice, handleSetPriceModal,
    handleNegoPrice, handleNegoPriceModal, handleNegoAccept,
    handlePackageSelectPrompt, handlePackageSelect,
} from './src/modules/ticket';
import {
    handleVoucherCommand, handleVoucherCreateModal,
    handleVoucherApplyBtn, handleVoucherApplyModal,
} from './src/modules/voucher';
import { handleRefreshCards } from './src/modules/refresh';
import { handleProductCommand, handleProductModal, handleProductAutocomplete, handlePackageEditPick, handlePackageDeletePick, handlePackageModal } from './src/modules/products';
import { handleRekberCommand, handleRekberModal, handleRekberButton } from './src/modules/rekber';
import { handlePromoMessage } from './src/modules/promo';
import { handleReviewButton, handleReviewModal, handleReviewReport, handleReviewsCommand } from './src/modules/review';
import { handlePaymentCommand, handlePaymentModal, handlePaymentAutocomplete } from './src/modules/payment';
import { handleOrderStatusCommand, handleOrderUpdateCommand, handleOrderAutocomplete,
    handleClaimOrderButton, handleOrderUpdateInvoiceSelect,
    handleOrderUpdateStatusSelect, handleOrderUpdateNoteModal,
    handlePaymentBuyerBtn, handlePaymentSellerBtn,
} from './src/modules/ordertrack';
import {
    handleBlacklistCommand, handleBlacklistBack, handleBlacklistAdd,
    handleBlacklistAddUser, handleBlacklistAddModal, handleBlacklistRemove,
    handleBlacklistRemoveUser, handleBlacklistCheck, handleBlacklistCheckUser,
    handleBlacklistList,
} from './src/modules/blacklist';
import { handleDashboardCommand, handleSellerDashCommand } from './src/modules/dashboard';
import {
    handleConfigCommand, handleConfigSetSelect, handleConfigResetSelect,
    handleConfigSetKeySelect, handleConfigResetKeySelect,
    handleConfigSetModal, handleConfigResetConfirm, handleConfigBack,
} from './src/modules/config';
import {
    handleRbacCommand, handleRbacMain, handleRbacRoleMenu, handleRbacRoleCreate,
    handleRbacRoleCreateModal, handleRbacRoleDelete, handleRbacRoleDeletePick,
    handleRbacRoleDeleteConfirm, handleRbacRoleAssign, handleRbacRoleAssignUser,
    handleRbacRoleAssignRole, handleRbacRoleRevoke, handleRbacRoleRevokeUser,
    handleRbacRoleRevokeRole, handleRbacRoleList, handleRbacChanMenu,
    handleRbacChanAllow, handleRbacChanAllowChan, handleRbacChanAllowRole,
    handleRbacChanAllowPerm, handleRbacChanDeny, handleRbacChanDenyChan,
    handleRbacChanDenyRole, handleRbacChanDenyPerm, handleRbacChanReset,
    handleRbacChanResetChan, handleRbacChanResetRole, handleRbacChanInfo,
    handleRbacChanInfoChan, handleRbacChanLockdown, handleRbacChanLockdownChan,
    handleRbacLockdownModal, handleRbacChanUnlock, handleRbacChanUnlockChan,
} from './src/modules/rbac';
import { handleHelp, handleSellerHelp, handleDevHelp } from './src/modules/help';
import {
    handlePanelCommand, handlePanelMain,
    handlePanelChannels, handlePanelChCreate, handlePanelChCreateModal,
    handlePanelChDelete, handlePanelChDeletePick, handlePanelChDeleteConfirm,
    handlePanelChRename, handlePanelChRenamePick, handlePanelChRenameModal,
    handlePanelChPerms, handlePanelChPermsChan, handlePanelChPermsRole, handlePanelChPermsType,
    handlePanelRoles, handlePanelRoleCreate, handlePanelRoleCreateModal,
    handlePanelRoleDelete, handlePanelRoleDeletePick, handlePanelRoleDeleteConfirm,
    handlePanelRoleAssign, handlePanelRoleAssignUser, handlePanelRoleAssignRole,
    handlePanelRoleRevoke, handlePanelRoleRevokeUser, handlePanelRoleRevokeRole,
    handlePanelRoleChannel, handlePanelRoleChannelPick, handlePanelRoleChannelChan,
    handlePanelRoleChannelPerm, handlePanelRoleList,
    handlePanelConfig, handlePanelBlacklist,
    handlePanelMember, handlePanelMemberUser,
    handlePanelMemberAdd, handlePanelMemberAddRole,
    handlePanelMemberRm, handlePanelMemberRmRole,
    handlePanelProducts, handlePanelProductPick,
    handlePanelProductAssign, handlePanelProductAssignUser, handlePanelProductUnassign,
    handlePanelVoucher, handlePanelVoucherCreate, handlePanelVoucherCreateModal,
    handlePanelVoucherDelete, handlePanelVoucherDeletePick,
} from './src/modules/panel';
import { handleMemberJoin } from './src/modules/welcome';
import { handleSpGive, handleSpGiveModal, handleSpConfirmDenda, handleSpList, checkExpiredSP } from './src/modules/sp';
import { updateMemberStat } from './src/modules/stats';
import { pool } from './src/lib/db';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,   // Bug #2 fix: diperlukan untuk guild.members.fetch()
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

client.once(Events.ClientReady, async (c) => {
    console.log(`Bot Online as ${c.user.tag}`);

    // Init database & load persisted state
    await initDB();
    await loadProjectCatId();

    // Sync initial member stat di semua guild
    for (const guild of c.guilds.cache.values()) {
        await updateMemberStat(guild);
    }

    // Auto-restore SP1 yang sudah expired
    await checkExpiredSP(c);
    setInterval(() => checkExpiredSP(c), 30 * 60 * 1000);

    // Register slash commands
    const commands = [
        new SlashCommandBuilder()
            .setName('setup')
            .setDescription('Reset & setup ulang seluruh server (Owner only)'),
        new SlashCommandBuilder()
            .setName('rekber')
            .setDescription('Buat transaksi rekening bersama (escrow) dengan seller'),
        new SlashCommandBuilder()
            .setName('reviews')
            .setDescription('Lihat rating & review semua jasa'),
        new SlashCommandBuilder()
            .setName('myorders')
            .setDescription('Lihat riwayat order & poin loyalty kamu'),
        new SlashCommandBuilder()
            .setName('redeem')
            .setDescription('Lihat daftar voucher loyalty kamu'),
        new SlashCommandBuilder()
            .setName('payment')
            .setDescription('Setup metode pembayaran kamu (khusus Seller)')
            .addSubcommand(sub =>
                sub.setName('add').setDescription('Tambah metode pembayaran baru')
            )
            .addSubcommand(sub =>
                sub.setName('remove')
                    .setDescription('Hapus metode pembayaran')
                    .addStringOption(opt =>
                        opt.setName('nama')
                            .setDescription('Nama metode yang mau dihapus')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
            )
            .addSubcommand(sub =>
                sub.setName('list').setDescription('Lihat daftar payment method kamu')
            )
            .addSubcommand(sub =>
                sub.setName('refresh').setDescription('Perbarui card payment kamu di channel')
            ),
        new SlashCommandBuilder()
            .setName('orderstatus')
            .setDescription('Cek status order kamu')
            .addStringOption(opt =>
                opt.setName('invoice')
                    .setDescription('Nomor invoice (opsional)')
                    .setRequired(false)
                    .setAutocomplete(true)
            ),
        new SlashCommandBuilder()
            .setName('orderupdate')
            .setDescription('Update status order via panel interaktif (Staff only)'),
        new SlashCommandBuilder()
            .setName('blacklist')
            .setDescription('Kelola blacklist buyer via panel interaktif (Admin only)'),
        new SlashCommandBuilder()
            .setName('dashboard')
            .setDescription('Lihat statistik & rekap marketplace (Admin only)'),
        new SlashCommandBuilder()
            .setName('sellerdash')
            .setDescription('Dashboard statistik & order aktif untuk Seller'),
        new SlashCommandBuilder()
            .setName('updpanduan')
            .setDescription('Update semua channel panduan dengan fitur terbaru (Owner only)'),
        new SlashCommandBuilder()
            .setName('refreshcards')
            .setDescription('Refresh semua product cards (Owner only)'),
        new SlashCommandBuilder()
            .setName('config')
            .setDescription('Konfigurasi pengaturan bot via panel interaktif (Owner only)'),
        new SlashCommandBuilder()
            .setName('rbac')
            .setDescription('Kelola Role-Based Access Control via panel interaktif (Owner/Admin only)'),
        new SlashCommandBuilder()
            .setName('panel')
            .setDescription('Panel Admin Server — channel, role, config (Owner only)'),
        new SlashCommandBuilder()
            .setName('sp')
            .setDescription('Kelola Surat Peringatan seller (Owner only)')
            .addSubcommand(sub =>
                sub.setName('give')
                    .setDescription('Berikan SP ke seller')
                    .addUserOption(opt =>
                        opt.setName('seller').setDescription('Target seller').setRequired(true)
                    )
                    .addIntegerOption(opt =>
                        opt.setName('level').setDescription('Level SP').setRequired(true)
                            .addChoices(
                                { name: 'SP-1 ⚠️ Warning (hide 7 hari)', value: 1 },
                                { name: 'SP-2 🔴 Denda', value: 2 },
                                { name: 'SP-3 💀 Kick + Blacklist', value: 3 },
                            )
                    )
            )
            .addSubcommand(sub =>
                sub.setName('list')
                    .setDescription('Lihat daftar SP')
                    .addUserOption(opt =>
                        opt.setName('seller').setDescription('Filter by seller').setRequired(false)
                    )
            ),
        new SlashCommandBuilder()
            .setName('product')
            .setDescription('Kelola produk/jasa')
            .addSubcommand(sub =>
                sub.setName('list').setDescription('Lihat semua produk beserta ID-nya')
            )
            .addSubcommand(sub =>
                sub.setName('edit')
                    .setDescription('Edit data produk lewat form')
                    .addStringOption(opt =>
                        opt.setName('id')
                            .setDescription('ID produk yang mau diedit')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
            )
            .addSubcommand(sub =>
                sub.setName('package')
                    .setDescription('Kelola paket harga produk (maks 3)')
                    .addStringOption(opt =>
                        opt.setName('id')
                            .setDescription('ID produk')
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addStringOption(opt =>
                        opt.setName('action')
                            .setDescription('Aksi')
                            .setRequired(true)
                            .addChoices(
                                { name: 'Tambah Paket', value: 'add'    },
                                { name: 'Edit Paket',   value: 'edit'   },
                                { name: 'Hapus Paket',  value: 'delete' },
                                { name: 'Lihat Paket',  value: 'list'   },
                            )
                    )
            ),
        new SlashCommandBuilder()
            .setName('voucher')
            .setDescription('Kelola voucher promo diskon (Owner only)')
            .addSubcommand(sub => sub.setName('create').setDescription('Buat voucher promo baru'))
            .addSubcommand(sub => sub.setName('list').setDescription('Lihat semua voucher promo'))
            .addSubcommand(sub =>
                sub.setName('delete')
                    .setDescription('Hapus voucher promo')
                    .addStringOption(opt =>
                        opt.setName('code').setDescription('Kode voucher yang akan dihapus').setRequired(true)
                    )
            ),
        new SlashCommandBuilder()
            .setName('testwelcome')
            .setDescription('Preview welcome banner (Owner only)')
            .addUserOption(opt =>
                opt.setName('target')
                    .setDescription('User untuk di-preview (default: kamu sendiri)')
                    .setRequired(false)
            ),
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('Panduan penggunaan bot untuk buyer/member'),
        new SlashCommandBuilder()
            .setName('shelp')
            .setDescription('Panduan command khusus Seller'),
        new SlashCommandBuilder()
            .setName('devhelp')
            .setDescription('Panduan command Owner/Admin/Staff (restricted)'),
    ].map(cmd => cmd.toJSON());

    const rest = new REST().setToken(TOKEN);
    for (const guild of c.guilds.cache.values()) {
        await rest.put(Routes.applicationGuildCommands(c.user.id, guild.id), { body: commands })
            .catch(err => console.error(`Gagal register commands di guild ${guild.name}:`, err));
    }
    console.log('Slash commands berhasil diregister!');
});

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        // Slash commands
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'setup')        await handleSetupRequest(interaction);
            if (interaction.commandName === 'refreshcards') await handleRefreshCards(interaction);
            if (interaction.commandName === 'product')      await handleProductCommand(interaction);
            if (interaction.commandName === 'rekber')       await handleRekberCommand(interaction);
            if (interaction.commandName === 'reviews')      await handleReviewsCommand(interaction);
            if (interaction.commandName === 'payment')      await handlePaymentCommand(interaction);
            if (interaction.commandName === 'orderstatus')  await handleOrderStatusCommand(interaction);
            if (interaction.commandName === 'orderupdate')  await handleOrderUpdateCommand(interaction);
            if (interaction.commandName === 'blacklist')    await handleBlacklistCommand(interaction);
            if (interaction.commandName === 'dashboard')    await handleDashboardCommand(interaction);
            if (interaction.commandName === 'sellerdash')   await handleSellerDashCommand(interaction);
            if (interaction.commandName === 'updpanduan')   await handleUpdPanduan(interaction);
            if (interaction.commandName === 'config')        await handleConfigCommand(interaction);
            if (interaction.commandName === 'rbac')           await handleRbacCommand(interaction);
            if (interaction.commandName === 'testwelcome') {
                if (interaction.isChatInputCommand() && interaction.guild) {
                    if (interaction.user.id !== OWNER_ID) {
                        await interaction.reply({ content: '❌ Hanya Owner.', ephemeral: true });
                    } else {
                        const targetUser = interaction.options.getUser('target') ?? interaction.user;
                        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                        if (!member) {
                            await interaction.reply({ content: '❌ Member tidak ditemukan di server ini.', ephemeral: true });
                        } else {
                            await interaction.deferReply({ ephemeral: true });
                            await handleMemberJoin(member);
                            await interaction.editReply({ content: `✅ Welcome banner dikirim ke <#${interaction.guild.channels.cache.find(c => c.name === '👋-welcome')?.id ?? '?'}>.` });
                        }
                    }
                }
            }
            if (interaction.commandName === 'help')           await handleHelp(interaction);
            if (interaction.commandName === 'shelp')          await handleSellerHelp(interaction);
            if (interaction.commandName === 'devhelp')        await handleDevHelp(interaction);
            if (interaction.commandName === 'panel')          await handlePanelCommand(interaction);
            if (interaction.commandName === 'sp') {
                const sub = interaction.options.getSubcommand();
                if (sub === 'give') await handleSpGive(interaction);
                if (sub === 'list') await handleSpList(interaction);
            }
            if (interaction.commandName === 'myorders') {
                const { rows } = await pool.query(
                    `SELECT order_count, points, vouchers FROM customer_loyalty WHERE user_id = $1`,
                    [interaction.user.id]
                );
                const data = rows[0];
                if (!data) {
                    await interaction.reply({ content: '📭 Kamu belum pernah order.', ephemeral: true });
                } else {
                    const { EmbedBuilder } = await import('discord.js');
                    const embed = new EmbedBuilder()
                        .setTitle('📊 Riwayat & Loyalty Kamu')
                        .setColor('#5865F2')
                        .addFields(
                            { name: '🛒 Total Order', value: `${data.order_count}x`, inline: true },
                            { name: '⭐ Poin',         value: `${data.points} pts`,   inline: true },
                            { name: '🎟️ Voucher Aktif', value: data.vouchers.length > 0 ? data.vouchers.map((v: string) => `\`${v}\``).join('\n') : 'Tidak ada', inline: false },
                        )
                        .setFooter({ text: 'Setiap 5 order dapat voucher diskon 10%!' });
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                }
            }
            if (interaction.commandName === 'voucher') await handleVoucherCommand(interaction);

            if (interaction.commandName === 'redeem') {
                // Informational only — actual application happens via 🎟️ button in ticket
                const { rows } = await pool.query(
                    `SELECT vouchers, points FROM customer_loyalty WHERE user_id = $1`,
                    [interaction.user.id]
                );
                if (!rows[0] || !rows[0].vouchers?.length) {
                    await interaction.reply({ content: '📭 Kamu belum punya voucher loyalty.\n\nVoucher diberikan secara otomatis berdasarkan poin loyalty. Gunakan jasa kami lebih banyak untuk mendapatkan voucher!', ephemeral: true });
                } else {
                    const list = (rows[0].vouchers as string[]).map(v => `\`${v}\``).join('\n');
                    await interaction.reply({
                        content: `🎟️ **Voucher Loyalty Kamu:**\n${list}\n\n> Untuk memakai voucher, buka tiket order dan klik tombol **🎟️ Pakai Voucher**.`,
                        ephemeral: true,
                    });
                }
            }
        }

        // Autocomplete
        if (interaction.isAutocomplete()) {
            if (interaction.commandName === 'product')     await handleProductAutocomplete(interaction);
            if (interaction.commandName === 'payment')     await handlePaymentAutocomplete(interaction);
            if (interaction.commandName === 'orderstatus') await handleOrderAutocomplete(interaction);
        }

        // Modal submit
        if (interaction.isModalSubmit()) {
            await handleProductModal(interaction);
            await handleRekberModal(interaction);
            await handlePaymentModal(interaction);
            const mid = interaction.customId;
            if (mid.startsWith('cfg:set_modal:'))           await handleConfigSetModal(interaction);
            if (mid === 'rbac:role_create_modal')            await handleRbacRoleCreateModal(interaction);
            if (mid.startsWith('rbac:lockdown_modal:'))      await handleRbacLockdownModal(interaction);
            if (mid.startsWith('ou:note_modal:'))            await handleOrderUpdateNoteModal(interaction);
            if (mid.startsWith('bl:add_modal:'))             await handleBlacklistAddModal(interaction);
            if (mid.startsWith('review:submit:'))            await handleReviewModal(interaction);
            // Panel modals
            if (mid === 'panel:ch_create_modal')              await handlePanelChCreateModal(interaction);
            if (mid.startsWith('panel:ch_rename_modal:'))     await handlePanelChRenameModal(interaction);
            if (mid === 'panel:role_create_modal')            await handlePanelRoleCreateModal(interaction);
            if (mid.startsWith('sp:give:'))                    await handleSpGiveModal(interaction);
            // Voucher modals
            if (mid === 'voucher:create_modal')                  await handleVoucherCreateModal(interaction);
            if (mid === 'panel:voucher_create_modal')             await handlePanelVoucherCreateModal(interaction);
            if (mid === 'voucher:apply_modal')                   await handleVoucherApplyModal(interaction);
            // Ticket price/nego modals
            if (mid === 'ticket:set_price_modal')                await handleSetPriceModal(interaction);
            if (mid === 'ticket:nego_modal')                     await handleNegoPriceModal(interaction);
            // Package modals
            if (mid.startsWith('pkg:add_modal:') || mid.startsWith('pkg:edit_modal:')) await handlePackageModal(interaction);
        }

        // Button interactions
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('buy_')) {
                await handlePackageSelectPrompt(interaction, interaction.customId.replace('buy_', ''));
            }

            if (interaction.customId === 'close_ticket') {
                await handleCloseTicket(interaction);
            }

            if (interaction.customId.startsWith('rekber_')) {
                await handleRekberButton(interaction);
            }

            if (interaction.customId.startsWith('review:rate:')) {
                await handleReviewButton(interaction);
            }

            // Legacy review buttons (old format)
            if (interaction.customId.startsWith('review_')) {
                await handleReviewButton(interaction);
            }

            if (interaction.customId.startsWith('review:report:')) {
                await handleReviewReport(interaction);
            }

            if (interaction.customId.startsWith('pay:transfer:')) {
                await handlePaymentBuyerBtn(interaction);
            }

            if (interaction.customId.startsWith('pay:seller:')) {
                await handlePaymentSellerBtn(interaction);
            }

            if (interaction.customId === 'setup_confirm') {
                await handleSetupConfirm(interaction);
            }

            if (interaction.customId === 'setup_cancel') {
                await interaction.update({ content: '❌ Setup dibatalkan.', embeds: [], components: [] });
            }

            if (interaction.customId.startsWith('claim_order_')) {
                await handleClaimOrderButton(interaction);
            }

            // Bug #8 fix: gunakan OWNER_ID dari config, bukan process.env
            if (interaction.customId.startsWith('info_')) {
                const serviceId = interaction.customId.replace('info_', '');
                await interaction.reply({
                    content: `Mau tanya-tanya soal jasa **${serviceId.toUpperCase()}**? Ping <@${OWNER_ID}> atau langsung klik **Order Sekarang** dan jelasin detail di tiket!`,
                    ephemeral: true
                });
            }

            // Config UI
            const cid = interaction.customId;
            if (cid === 'cfg:set_select')              await handleConfigSetSelect(interaction);
            if (cid === 'cfg:reset_select')            await handleConfigResetSelect(interaction);
            if (cid.startsWith('cfg:reset_confirm:'))  await handleConfigResetConfirm(interaction);
            if (cid === 'cfg:back')                    await handleConfigBack(interaction);

            // RBAC UI
            if (cid === 'rbac:main')                        await handleRbacMain(interaction);
            if (cid === 'rbac:role_menu')                   await handleRbacRoleMenu(interaction);
            if (cid === 'rbac:role_create')                 await handleRbacRoleCreate(interaction);
            if (cid === 'rbac:role_delete')                 await handleRbacRoleDelete(interaction);
            if (cid.startsWith('rbac:role_delete_confirm:')) await handleRbacRoleDeleteConfirm(interaction);
            if (cid === 'rbac:role_assign')                 await handleRbacRoleAssign(interaction);
            if (cid === 'rbac:role_revoke')                 await handleRbacRoleRevoke(interaction);
            if (cid === 'rbac:role_list')                   await handleRbacRoleList(interaction);
            if (cid === 'rbac:chan_menu')                    await handleRbacChanMenu(interaction);
            if (cid === 'rbac:chan_allow')                   await handleRbacChanAllow(interaction);
            if (cid === 'rbac:chan_deny')                    await handleRbacChanDeny(interaction);
            if (cid === 'rbac:chan_reset')                   await handleRbacChanReset(interaction);
            if (cid === 'rbac:chan_info')                    await handleRbacChanInfo(interaction);
            if (cid === 'rbac:chan_lockdown')                await handleRbacChanLockdown(interaction);
            if (cid === 'rbac:chan_unlock')                  await handleRbacChanUnlock(interaction);

            // Blacklist UI
            if (cid === 'bl:add')    await handleBlacklistAdd(interaction);
            if (cid === 'bl:remove') await handleBlacklistRemove(interaction);
            if (cid === 'bl:check')  await handleBlacklistCheck(interaction);
            if (cid === 'bl:list')   await handleBlacklistList(interaction);
            if (cid === 'bl:back')   await handleBlacklistBack(interaction);

            // Admin Panel UI
            if (cid === 'panel:main')                          await handlePanelMain(interaction);
            if (cid === 'panel:member')                        await handlePanelMember(interaction);
            if (cid.startsWith('panel:member_add:'))           await handlePanelMemberAdd(interaction);
            if (cid.startsWith('panel:member_rm:'))            await handlePanelMemberRm(interaction);
            if (cid === 'panel:channels')                      await handlePanelChannels(interaction);
            if (cid === 'panel:ch_create')                     await handlePanelChCreate(interaction);
            if (cid === 'panel:ch_delete')                     await handlePanelChDelete(interaction);
            if (cid.startsWith('panel:ch_delete_confirm:'))    await handlePanelChDeleteConfirm(interaction);
            if (cid === 'panel:ch_rename')                     await handlePanelChRename(interaction);
            if (cid === 'panel:ch_perms')                      await handlePanelChPerms(interaction);
            if (cid === 'panel:roles')                         await handlePanelRoles(interaction);
            if (cid === 'panel:role_create')                   await handlePanelRoleCreate(interaction);
            if (cid === 'panel:role_delete')                   await handlePanelRoleDelete(interaction);
            if (cid.startsWith('panel:role_delete_confirm:'))  await handlePanelRoleDeleteConfirm(interaction);
            if (cid === 'panel:role_assign')                   await handlePanelRoleAssign(interaction);
            if (cid === 'panel:role_revoke')                   await handlePanelRoleRevoke(interaction);
            if (cid === 'panel:role_channel')                  await handlePanelRoleChannel(interaction);
            if (cid === 'panel:role_list')                     await handlePanelRoleList(interaction);
            if (cid === 'panel:config')                        await handlePanelConfig(interaction);
            if (cid === 'panel:blacklist')                     await handlePanelBlacklist(interaction);
            if (cid === 'panel:products')                      await handlePanelProducts(interaction);
            if (cid.startsWith('panel:product_assign:'))       await handlePanelProductAssign(interaction);
            if (cid.startsWith('panel:product_unassign:'))     await handlePanelProductUnassign(interaction);
            if (cid === 'panel:voucher')                        await handlePanelVoucher(interaction);
            if (cid === 'panel:voucher_create')                 await handlePanelVoucherCreate(interaction);
            if (cid === 'panel:voucher_delete')                 await handlePanelVoucherDelete(interaction);
            if (cid.startsWith('sp:confirm_denda:'))           await handleSpConfirmDenda(interaction);

            // Ticket: price & negotiation
            if (cid === 'ticket:set_price')                      await handleSetPrice(interaction);
            if (cid === 'ticket:nego')                           await handleNegoPrice(interaction);
            if (cid === 'ticket:voucher')                        await handleVoucherApplyBtn(interaction);
            if (cid.startsWith('ticket:nego_accept:'))           await handleNegoAccept(interaction);
        }

        // String select menus
        if (interaction.isStringSelectMenu()) {
            const sid = interaction.customId;
            if (sid === 'cfg:set_key')                      await handleConfigSetKeySelect(interaction);
            if (sid === 'cfg:reset_key')                    await handleConfigResetKeySelect(interaction);
            if (sid.startsWith('rbac:chan_allow_perm:'))    await handleRbacChanAllowPerm(interaction);
            if (sid.startsWith('rbac:chan_deny_perm:'))     await handleRbacChanDenyPerm(interaction);
            if (sid === 'ou:invoice_select')                await handleOrderUpdateInvoiceSelect(interaction);
            if (sid.startsWith('ou:status_select:'))        await handleOrderUpdateStatusSelect(interaction);
            // Panel string selects
            if (sid.startsWith('panel:ch_perms_type:'))     await handlePanelChPermsType(interaction);
            if (sid.startsWith('panel:role_channel_perm:')) await handlePanelRoleChannelPerm(interaction);
            if (sid === 'panel:product_pick')               await handlePanelProductPick(interaction);
            if (sid === 'panel:voucher_delete_pick')        await handlePanelVoucherDeletePick(interaction);
            // Package string selects
            if (sid.startsWith('pkg:edit_pick:'))   await handlePackageEditPick(interaction);
            if (sid.startsWith('pkg:delete_pick:')) await handlePackageDeletePick(interaction);
            if (sid.startsWith('pkg:select:'))      await handlePackageSelect(interaction);
        }

        // User select menus
        if (interaction.isUserSelectMenu()) {
            const uid = interaction.customId;
            if (uid === 'rbac:role_assign_user')       await handleRbacRoleAssignUser(interaction);
            if (uid === 'rbac:role_revoke_user')       await handleRbacRoleRevokeUser(interaction);
            if (uid === 'bl:add_user')                 await handleBlacklistAddUser(interaction);
            if (uid === 'bl:remove_user')              await handleBlacklistRemoveUser(interaction);
            if (uid === 'bl:check_user')               await handleBlacklistCheckUser(interaction);
            // Panel user selects
            if (uid === 'panel:role_assign_user')      await handlePanelRoleAssignUser(interaction);
            if (uid === 'panel:role_revoke_user')      await handlePanelRoleRevokeUser(interaction);
            if (uid === 'panel:member_user')                      await handlePanelMemberUser(interaction);
            if (uid.startsWith('panel:product_assign_user:'))     await handlePanelProductAssignUser(interaction);
        }

        // Role select menus
        if (interaction.isRoleSelectMenu()) {
            const rid = interaction.customId;
            if (rid === 'rbac:role_delete_pick')               await handleRbacRoleDeletePick(interaction);
            if (rid.startsWith('rbac:role_assign_role:'))      await handleRbacRoleAssignRole(interaction);
            if (rid.startsWith('rbac:role_revoke_role:'))      await handleRbacRoleRevokeRole(interaction);
            if (rid.startsWith('rbac:chan_allow_role:'))        await handleRbacChanAllowRole(interaction);
            if (rid.startsWith('rbac:chan_deny_role:'))         await handleRbacChanDenyRole(interaction);
            if (rid.startsWith('rbac:chan_reset_role:'))        await handleRbacChanResetRole(interaction);
            // Panel role selects
            if (rid === 'panel:role_delete_pick')              await handlePanelRoleDeletePick(interaction);
            if (rid.startsWith('panel:role_assign_role:'))     await handlePanelRoleAssignRole(interaction);
            if (rid.startsWith('panel:role_revoke_role:'))     await handlePanelRoleRevokeRole(interaction);
            if (rid === 'panel:role_channel_pick')             await handlePanelRoleChannelPick(interaction);
            if (rid.startsWith('panel:ch_perms_role:'))        await handlePanelChPermsRole(interaction);
            if (rid.startsWith('panel:member_add_role:'))      await handlePanelMemberAddRole(interaction);
            if (rid.startsWith('panel:member_rm_role:'))       await handlePanelMemberRmRole(interaction);
        }

        // Channel select menus
        if (interaction.isChannelSelectMenu()) {
            const chid = interaction.customId;
            if (chid === 'rbac:chan_allow_chan')              await handleRbacChanAllowChan(interaction);
            if (chid === 'rbac:chan_deny_chan')               await handleRbacChanDenyChan(interaction);
            if (chid === 'rbac:chan_reset_chan')              await handleRbacChanResetChan(interaction);
            if (chid === 'rbac:chan_info_chan')               await handleRbacChanInfoChan(interaction);
            if (chid === 'rbac:chan_lockdown_chan')           await handleRbacChanLockdownChan(interaction);
            if (chid === 'rbac:chan_unlock_chan')             await handleRbacChanUnlockChan(interaction);
            // Panel channel selects
            if (chid === 'panel:ch_delete_pick')             await handlePanelChDeletePick(interaction);
            if (chid === 'panel:ch_rename_pick')             await handlePanelChRenamePick(interaction);
            if (chid === 'panel:ch_perms_chan')               await handlePanelChPermsChan(interaction);
            if (chid.startsWith('panel:role_channel_chan:')) await handlePanelRoleChannelChan(interaction);
        }
    } catch (err) {
        console.error('Unhandled interaction error:', err);
        const reply = { content: '❌ Terjadi error. Coba lagi atau hubungi Owner.', ephemeral: true };
        try {
            if (interaction.isRepliable()) {
                if ((interaction as any).deferred) await (interaction as any).editReply(reply);
                else await (interaction as any).reply(reply);
            }
        } catch {}
    }
});

// Promo channel moderation
client.on(Events.MessageCreate, async (message) => {
    await handlePromoMessage(message);
});

// Stats + welcome saat ada yang join
client.on(Events.GuildMemberAdd, async (member) => {
    await updateMemberStat(member.guild);
    await handleMemberJoin(member);
});

client.on(Events.GuildMemberRemove, async (member) => {
    await updateMemberStat(member.guild);
});

// Global error handler — bot tidak crash karena unhandled rejection
process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
});

client.login(TOKEN);
