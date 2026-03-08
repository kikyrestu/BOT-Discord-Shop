import {
    ChatInputCommandInteraction,
    ButtonInteraction,
    ChannelSelectMenuInteraction,
    RoleSelectMenuInteraction,
    UserSelectMenuInteraction,
    StringSelectMenuInteraction,
    ModalSubmitInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    UserSelectMenuBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    GuildChannel,
    GuildMember,
    PermissionFlagsBits,
} from 'discord.js';
import { OWNER_ID, ROLE_NAMES } from '../config';
import { pool } from '../lib/db';
import { getAllServices } from '../lib/serviceStore';

// ─── Permission Presets ───────────────────────────────────────────────────────

type PermKey = 'ViewChannel' | 'SendMessages' | 'ReadMessageHistory' | 'ManageMessages' | 'AttachFiles' | 'EmbedLinks';

const PERM_ALLOW: Record<string, Partial<Record<PermKey, boolean>>> = {
    view:     { ViewChannel: true,  ReadMessageHistory: true },
    send:     { ViewChannel: true,  SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true },
    readonly: { ViewChannel: true,  ReadMessageHistory: true, SendMessages: false },
    manage:   { ViewChannel: true,  SendMessages: true, ReadMessageHistory: true, ManageMessages: true, AttachFiles: true, EmbedLinks: true },
    deny:     { ViewChannel: false, SendMessages: false },
};

const PERM_LABELS: Record<string, string> = {
    view:     '\u{1F441}\uFE0F View only',
    send:     '\u2709\uFE0F View + Send',
    readonly: '\u{1F4CB} Read-only',
    manage:   '\u{1F6E0}\uFE0F Manage',
    deny:     '\u{1F6AB} Deny',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOwner(userId: string): boolean {
    return userId === OWNER_ID;
}

function ownerOnly(interaction: { user: { id: string } }): boolean {
    return interaction.user.id === OWNER_ID;
}

function backRow(cid: string, label = '\u2190 Kembali'): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(cid).setLabel(label).setStyle(ButtonStyle.Secondary),
    );
}

function mainEmbed(): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle('\u{1F3E0} Admin Panel')
        .setColor('#5865F2')
        .setDescription(
            '**Panel manajemen server — hanya untuk Owner**\n\n' +
            '\u{1F4CB} **Channels** — Buat, hapus, rename, atur akses\n' +
            '\u{1F465} **Roles** \u2014 Buat, hapus, assign ke user & channel\n' +
            '\u{1F464} **Members** \u2014 Lihat & atur role member dengan cepat\n' +
            '\u{1F4E6} **Products** \u2014 Assign seller ke lapak & switch kepemilikan\n' +
            '\u2699\uFE0F **Config** \u2014 Pengaturan bot\n' +
            '\u{1F6AB} **Blacklist** — Kelola daftar hitam buyer',
        )
        .setFooter({ text: 'Owner Only Panel' });
}

function mainRows(): ActionRowBuilder<ButtonBuilder>[] {
    return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('panel:channels').setLabel('\u{1F4CB} Channels').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('panel:roles').setLabel('\u{1F465} Roles').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('panel:member').setLabel('\u{1F464} Members').setStyle(ButtonStyle.Primary),
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('panel:products').setLabel('\u{1F4E6} Products').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('panel:config').setLabel('\u2699\uFE0F Config').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('panel:blacklist').setLabel('\u{1F6AB} Blacklist').setStyle(ButtonStyle.Danger),
        ),
    ];
}

// ── Entry ──────────────────────────────────────────────────────────────────────

export async function handlePanelCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isOwner(interaction.user.id)) {
        await interaction.reply({ content: '\u274C Panel ini hanya untuk Owner.', ephemeral: true });
        return;
    }
    await interaction.reply({ embeds: [mainEmbed()], components: mainRows(), ephemeral: true });
}

export async function handlePanelMain(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    await interaction.update({ embeds: [mainEmbed()], components: mainRows() });
}

// ════════════════════════════════════════════════════════════════════════════════
// CHANNEL SECTION
// ════════════════════════════════════════════════════════════════════════════════

export async function handlePanelChannels(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    await interaction.update({
        embeds: [
            new EmbedBuilder().setTitle('\u{1F4CB} Channel Manager').setColor('#5865F2')
                .setDescription('Pilih aksi untuk channel server:'),
        ],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('panel:ch_create').setLabel('\u2795 Buat Channel').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('panel:ch_delete').setLabel('\u{1F5D1}\uFE0F Hapus Channel').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('panel:ch_rename').setLabel('\u270F\uFE0F Rename Channel').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('panel:ch_perms').setLabel('\u{1F510} Atur Akses').setStyle(ButtonStyle.Secondary),
            ),
            backRow('panel:main'),
        ],
    });
}

// ── Create Channel ────────────────────────────────────────────────────────────

export async function handlePanelChCreate(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const modal = new ModalBuilder().setCustomId('panel:ch_create_modal').setTitle('Buat Channel Baru');
    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('name').setLabel('Nama Channel').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('contoh: general-chat'),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('type').setLabel('Tipe: text / voice / forum').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('text (default)'),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('topic').setLabel('Topik / Deskripsi (opsional)').setStyle(TextInputStyle.Short).setRequired(false),
        ),
    );
    await interaction.showModal(modal);
}

export async function handlePanelChCreateModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const name     = interaction.fields.getTextInputValue('name').trim().toLowerCase().replace(/\s+/g, '-');
    const typeRaw  = interaction.fields.getTextInputValue('type').trim().toLowerCase();
    const topic    = interaction.fields.getTextInputValue('topic').trim() || undefined;
    let   chanType = ChannelType.GuildText as number;
    if (typeRaw === 'voice') chanType = ChannelType.GuildVoice;
    else if (typeRaw === 'forum') chanType = ChannelType.GuildForum;
    try {
        const chan = await interaction.guild.channels.create({ name, type: chanType as any, topic } as any);
        await interaction.reply({
            embeds: [
                new EmbedBuilder().setTitle('\u2705 Channel Dibuat').setColor('#00FF88')
                    .addFields(
                        { name: 'Channel', value: `${chan}`, inline: true },
                        { name: 'Tipe',    value: typeRaw || 'text', inline: true },
                    ),
            ],
            components: [backRow('panel:channels', '\u2190 Channel Manager')],
            ephemeral: true,
        });
    } catch (err) {
        await interaction.reply({ content: `\u274C Gagal: ${(err as Error).message}`, ephemeral: true });
    }
}

// ── Delete Channel ────────────────────────────────────────────────────────────

export async function handlePanelChDelete(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F5D1}\uFE0F Hapus Channel').setColor('#FF0000').setDescription('Pilih channel yang akan dihapus:')],
        components: [
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('panel:ch_delete_pick').setPlaceholder('Pilih channel...'),
            ),
            backRow('panel:channels', '\u2190 Channel Manager'),
        ],
    });
}

export async function handlePanelChDeletePick(interaction: ChannelSelectMenuInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const chan = interaction.channels.first();
    if (!chan) return;
    await interaction.update({
        embeds: [
            new EmbedBuilder().setTitle('\u26A0\uFE0F Konfirmasi Hapus Channel').setColor('#FF0000')
                .setDescription(`Yakin mau hapus <#${chan.id}> (**${(chan as any).name ?? chan.id}**)?

\u26A0\uFE0F **Tindakan ini tidak bisa dibalik!**`),
        ],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`panel:ch_delete_confirm:${chan.id}`).setLabel('\u{1F5D1}\uFE0F Ya, Hapus Sekarang').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('panel:ch_delete').setLabel('Batal').setStyle(ButtonStyle.Secondary),
            ),
        ],
    });
}

export async function handlePanelChDeleteConfirm(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const chanId = interaction.customId.replace('panel:ch_delete_confirm:', '');
    try {
        const chan = interaction.guild.channels.cache.get(chanId);
        if (!chan) {
            await interaction.update({ content: '\u26A0\uFE0F Channel tidak ditemukan atau sudah dihapus.', embeds: [], components: [backRow('panel:channels', '\u2190 Channel Manager')] });
            return;
        }
        const name = (chan as any).name ?? chanId;
        await chan.delete();
        await interaction.update({
            content:    `\u2705 Channel **${name}** berhasil dihapus.`,
            embeds:     [],
            components: [backRow('panel:channels', '\u2190 Channel Manager')],
        });
    } catch (err) {
        await interaction.update({ content: `\u274C Gagal: ${(err as Error).message}`, embeds: [], components: [backRow('panel:channels', '\u2190 Channel Manager')] });
    }
}

// ── Rename Channel ────────────────────────────────────────────────────────────

export async function handlePanelChRename(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u270F\uFE0F Rename Channel').setColor('#FFA500').setDescription('Pilih channel yang akan direname:')],
        components: [
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('panel:ch_rename_pick').setPlaceholder('Pilih channel...'),
            ),
            backRow('panel:channels', '\u2190 Channel Manager'),
        ],
    });
}

export async function handlePanelChRenamePick(interaction: ChannelSelectMenuInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const chan = interaction.channels.first();
    if (!chan) return;
    const modal = new ModalBuilder().setCustomId(`panel:ch_rename_modal:${chan.id}`).setTitle('Rename Channel');
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('newname').setLabel(`Nama Baru untuk #${(chan as any).name ?? chan.id}`).setStyle(TextInputStyle.Short).setRequired(true).setValue((chan as any).name ?? ''),
    ));
    await interaction.showModal(modal);
}

export async function handlePanelChRenameModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const chanId  = interaction.customId.replace('panel:ch_rename_modal:', '');
    const newName = interaction.fields.getTextInputValue('newname').trim().toLowerCase().replace(/\s+/g, '-');
    try {
        const chan = interaction.guild.channels.cache.get(chanId) as GuildChannel | undefined;
        if (!chan) { await interaction.reply({ content: '\u26A0\uFE0F Channel tidak ditemukan.', ephemeral: true }); return; }
        const oldName = (chan as any).name;
        await chan.setName(newName);
        await interaction.reply({
            content:    `\u2705 Channel renamed: **${oldName}** \u2192 **${newName}**`,
            components: [backRow('panel:channels', '\u2190 Channel Manager')],
            ephemeral:  true,
        });
    } catch (err) {
        await interaction.reply({ content: `\u274C Gagal: ${(err as Error).message}`, ephemeral: true });
    }
}

// ── Channel Permissions ───────────────────────────────────────────────────────

export async function handlePanelChPerms(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F510} Atur Akses Channel — 1/3').setColor('#5865F2').setDescription('Pilih channel:')],
        components: [
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('panel:ch_perms_chan').setPlaceholder('Pilih channel...').addChannelTypes(ChannelType.GuildText),
            ),
            backRow('panel:channels', '\u2190 Channel Manager'),
        ],
    });
}

export async function handlePanelChPermsChan(interaction: ChannelSelectMenuInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const chan = interaction.channels.first();
    if (!chan) return;
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F510} Atur Akses Channel — 2/3').setColor('#5865F2').setDescription(`Channel: <#${chan.id}>\n\nPilih role yang akan diatur:`)],
        components: [
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder().setCustomId(`panel:ch_perms_role:${chan.id}`).setPlaceholder('Pilih role...'),
            ),
            backRow('panel:ch_perms', '\u2190 Pilih Channel Lagi'),
        ],
    });
}

export async function handlePanelChPermsRole(interaction: RoleSelectMenuInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const chanId = interaction.customId.replace('panel:ch_perms_role:', '');
    const role   = interaction.roles.first();
    if (!role) return;
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F510} Atur Akses Channel — 3/3').setColor('#5865F2').setDescription(`Channel: <#${chanId}>\nRole: ${role}\n\nPilih jenis akses:`)],
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder().setCustomId(`panel:ch_perms_type:${chanId}:${role.id}`).setPlaceholder('Pilih akses...').addOptions([
                    { label: '\u{1F441}\uFE0F View only',      value: 'view',     description: 'Bisa lihat tapi tidak bisa kirim' },
                    { label: '\u2709\uFE0F View + Send',        value: 'send',     description: 'Full akses: baca + kirim pesan' },
                    { label: '\u{1F4CB} Read-only',              value: 'readonly', description: 'Bisa baca, tidak bisa kirim' },
                    { label: '\u{1F6E0}\uFE0F Manage',          value: 'manage',   description: 'Full akses + manage pesan' },
                    { label: '\u{1F6AB} Deny — blokir semua',    value: 'deny',     description: 'Tidak bisa lihat atau masuk' },
                ]),
            ),
            backRow('panel:ch_perms', '\u2190 Pilih Channel Lagi'),
        ],
    });
}

export async function handlePanelChPermsType(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const parts  = interaction.customId.split(':');
    const chanId = parts[2];
    const roleId = parts[3];
    const perm   = interaction.values[0];
    const preset = PERM_ALLOW[perm];
    if (!preset) { await interaction.update({ content: 'Preset tidak dikenal.', embeds: [], components: [] }); return; }
    try {
        const chan = interaction.guild.channels.cache.get(chanId) as GuildChannel | undefined;
        if (!chan) { await interaction.update({ content: '\u26A0\uFE0F Channel tidak ditemukan.', embeds: [], components: [backRow('panel:channels', '\u2190 Channel Manager')] }); return; }
        await chan.permissionOverwrites.edit(roleId, preset as any);
        await interaction.update({
            embeds: [
                new EmbedBuilder().setTitle('\u2705 Akses Diatur').setColor('#00FF88')
                    .addFields(
                        { name: 'Channel', value: `<#${chanId}>`,      inline: true },
                        { name: 'Role',    value: `<@&${roleId}>`,     inline: true },
                        { name: 'Akses',   value: PERM_LABELS[perm],     inline: true },
                    ),
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('panel:ch_perms').setLabel('\u{1F510} Atur Akses Lagi').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('panel:channels').setLabel('\u2190 Channel Manager').setStyle(ButtonStyle.Secondary),
                ),
            ],
        });
    } catch (err) {
        await interaction.update({ content: `\u274C Gagal: ${(err as Error).message}`, embeds: [], components: [backRow('panel:channels', '\u2190 Channel Manager')] });
    }
}

// ════════════════════════════════════════════════════════════════════════════════
// ROLE SECTION
// ════════════════════════════════════════════════════════════════════════════════

export async function handlePanelRoles(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F465} Role Manager').setColor('#00FF88').setDescription('Pilih aksi untuk role server:')],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('panel:role_create').setLabel('\u2795 Buat Role').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('panel:role_delete').setLabel('\u{1F5D1}\uFE0F Hapus Role').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('panel:role_assign').setLabel('\u{1F464} Assign ke User').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('panel:role_revoke').setLabel('\u{1F6AB} Cabut dari User').setStyle(ButtonStyle.Secondary),
            ),
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('panel:role_channel').setLabel('\u{1F510} Set Akses Channel').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('panel:role_list').setLabel('\u{1F4CB} List Roles').setStyle(ButtonStyle.Secondary),
            ),
            backRow('panel:main'),
        ],
    });
}

// ── Create Role ───────────────────────────────────────────────────────────────

export async function handlePanelRoleCreate(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const modal = new ModalBuilder().setCustomId('panel:role_create_modal').setTitle('Buat Role Baru');
    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('name').setLabel('Nama Role').setStyle(TextInputStyle.Short).setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('color').setLabel('Warna Hex (opsional)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('#FF5500'),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('hoist').setLabel('Tampil terpisah di sidebar? ya/tidak').setStyle(TextInputStyle.Short).setRequired(false),
        ),
    );
    await interaction.showModal(modal);
}

export async function handlePanelRoleCreateModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const name  = interaction.fields.getTextInputValue('name').trim();
    const color = interaction.fields.getTextInputValue('color').trim() || undefined;
    const hoist = interaction.fields.getTextInputValue('hoist').trim().toLowerCase() === 'ya';
    try {
        const role = await interaction.guild.roles.create({ name, color: color as any, hoist, mentionable: true });
        await interaction.reply({
            embeds: [
                new EmbedBuilder().setTitle('\u2705 Role Dibuat').setColor('#00FF88')
                    .addFields(
                        { name: 'Role',  value: `${role}`, inline: true },
                        { name: 'Warna', value: color ?? 'Default', inline: true },
                        { name: 'Hoist', value: hoist ? 'Ya' : 'Tidak', inline: true },
                    ),
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('panel:role_channel').setLabel('\u{1F510} Set Akses Channel').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('panel:roles').setLabel('\u2190 Role Manager').setStyle(ButtonStyle.Secondary),
                ),
            ],
            ephemeral: true,
        });
    } catch (err) {
        await interaction.reply({ content: `\u274C Gagal: ${(err as Error).message}`, ephemeral: true });
    }
}

// ── Delete Role ───────────────────────────────────────────────────────────────

export async function handlePanelRoleDelete(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F5D1}\uFE0F Hapus Role').setColor('#FF0000').setDescription('Pilih role yang akan dihapus:')],
        components: [
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder().setCustomId('panel:role_delete_pick').setPlaceholder('Pilih role...'),
            ),
            backRow('panel:roles', '\u2190 Role Manager'),
        ],
    });
}

export async function handlePanelRoleDeletePick(interaction: RoleSelectMenuInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const role = interaction.roles.first();
    if (!role) return;
    await interaction.update({
        embeds: [
            new EmbedBuilder().setTitle('\u26A0\uFE0F Konfirmasi Hapus Role').setColor('#FF0000')
                .setDescription(`Yakin mau hapus role **${role.name}**?\n\n\u26A0\uFE0F **Semua member yang punya role ini akan kehilangan role tersebut!**`),
        ],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`panel:role_delete_confirm:${role.id}`).setLabel('\u{1F5D1}\uFE0F Ya, Hapus').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('panel:role_delete').setLabel('Batal').setStyle(ButtonStyle.Secondary),
            ),
        ],
    });
}

export async function handlePanelRoleDeleteConfirm(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const roleId = interaction.customId.replace('panel:role_delete_confirm:', '');
    try {
        const role = await interaction.guild.roles.fetch(roleId);
        if (!role) {
            await interaction.update({ content: '\u26A0\uFE0F Role tidak ditemukan.', embeds: [], components: [backRow('panel:roles', '\u2190 Role Manager')] });
            return;
        }
        const name = role.name;
        await role.delete();
        await interaction.update({
            content:    `\u2705 Role **${name}** berhasil dihapus.`,
            embeds:     [],
            components: [backRow('panel:roles', '\u2190 Role Manager')],
        });
    } catch (err) {
        await interaction.update({ content: `\u274C Gagal: ${(err as Error).message}`, embeds: [], components: [backRow('panel:roles', '\u2190 Role Manager')] });
    }
}

// ── Assign Role to User ───────────────────────────────────────────────────────

export async function handlePanelRoleAssign(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F464} Assign Role ke User — 1/2').setColor('#5865F2').setDescription('Pilih user yang akan diberi role:')],
        components: [
            new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
                new UserSelectMenuBuilder().setCustomId('panel:role_assign_user').setPlaceholder('Pilih user...'),
            ),
            backRow('panel:roles', '\u2190 Role Manager'),
        ],
    });
}

export async function handlePanelRoleAssignUser(interaction: UserSelectMenuInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const user = interaction.users.first();
    if (!user) return;
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F464} Assign Role ke User — 2/2').setColor('#5865F2').setDescription(`User: ${user}\n\nPilih role yang akan diberikan:`)],
        components: [
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder().setCustomId(`panel:role_assign_role:${user.id}`).setPlaceholder('Pilih role...'),
            ),
            backRow('panel:roles', '\u2190 Role Manager'),
        ],
    });
}

export async function handlePanelRoleAssignRole(interaction: RoleSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const userId = interaction.customId.replace('panel:role_assign_role:', '');
    const role   = interaction.roles.first();
    if (!role) return;
    try {
        const member = await interaction.guild.members.fetch(userId);
        await member.roles.add(role.id);
        await interaction.update({
            embeds: [
                new EmbedBuilder().setTitle('\u2705 Role Diberikan').setColor('#00FF88')
                    .addFields(
                        { name: 'User', value: `<@${userId}>`, inline: true },
                        { name: 'Role', value: `${role}`,       inline: true },
                    ),
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('panel:role_assign').setLabel('\u{1F464} Assign Lagi').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('panel:roles').setLabel('\u2190 Role Manager').setStyle(ButtonStyle.Secondary),
                ),
            ],
        });
    } catch (err) {
        await interaction.update({ content: `\u274C Gagal: ${(err as Error).message}`, embeds: [], components: [backRow('panel:roles', '\u2190 Role Manager')] });
    }
}

// ── Revoke Role from User ─────────────────────────────────────────────────────

export async function handlePanelRoleRevoke(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F6AB} Cabut Role dari User — 1/2').setColor('#FF6B35').setDescription('Pilih user yang akan dicabut rolenya:')],
        components: [
            new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
                new UserSelectMenuBuilder().setCustomId('panel:role_revoke_user').setPlaceholder('Pilih user...'),
            ),
            backRow('panel:roles', '\u2190 Role Manager'),
        ],
    });
}

export async function handlePanelRoleRevokeUser(interaction: UserSelectMenuInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const user = interaction.users.first();
    if (!user) return;
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F6AB} Cabut Role dari User — 2/2').setColor('#FF6B35').setDescription(`User: ${user}\n\nPilih role yang akan dicabut:`)],
        components: [
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder().setCustomId(`panel:role_revoke_role:${user.id}`).setPlaceholder('Pilih role...'),
            ),
            backRow('panel:roles', '\u2190 Role Manager'),
        ],
    });
}

export async function handlePanelRoleRevokeRole(interaction: RoleSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const userId = interaction.customId.replace('panel:role_revoke_role:', '');
    const role   = interaction.roles.first();
    if (!role) return;
    try {
        const member = await interaction.guild.members.fetch(userId);
        await member.roles.remove(role.id);
        await interaction.update({
            embeds: [
                new EmbedBuilder().setTitle('\u2705 Role Dicabut').setColor('#00FF88')
                    .addFields(
                        { name: 'User', value: `<@${userId}>`, inline: true },
                        { name: 'Role', value: `${role}`,       inline: true },
                    ),
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('panel:role_revoke').setLabel('\u{1F6AB} Cabut Lagi').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('panel:roles').setLabel('\u2190 Role Manager').setStyle(ButtonStyle.Secondary),
                ),
            ],
        });
    } catch (err) {
        await interaction.update({ content: `\u274C Gagal: ${(err as Error).message}`, embeds: [], components: [backRow('panel:roles', '\u2190 Role Manager')] });
    }
}

// ── Set Role → Channel Access ─────────────────────────────────────────────────

export async function handlePanelRoleChannel(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F510} Set Akses Channel untuk Role — 1/3').setColor('#5865F2').setDescription('Pilih role terlebih dahulu:')],
        components: [
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder().setCustomId('panel:role_channel_pick').setPlaceholder('Pilih role...'),
            ),
            backRow('panel:roles', '\u2190 Role Manager'),
        ],
    });
}

export async function handlePanelRoleChannelPick(interaction: RoleSelectMenuInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const role = interaction.roles.first();
    if (!role) return;
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F510} Set Akses Channel untuk Role — 2/3').setColor('#5865F2').setDescription(`Role: ${role}\n\nPilih channel yang akan diatur:`)],
        components: [
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId(`panel:role_channel_chan:${role.id}`).setPlaceholder('Pilih channel...').addChannelTypes(ChannelType.GuildText),
            ),
            backRow('panel:role_channel', '\u2190 Pilih Role Lagi'),
        ],
    });
}

export async function handlePanelRoleChannelChan(interaction: ChannelSelectMenuInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const roleId = interaction.customId.replace('panel:role_channel_chan:', '');
    const chan   = interaction.channels.first();
    if (!chan) return;
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F510} Set Akses Channel untuk Role — 3/3').setColor('#5865F2').setDescription(`Role: <@&${roleId}>\nChannel: <#${chan.id}>\n\nPilih jenis akses:`)],
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder().setCustomId(`panel:role_channel_perm:${roleId}:${chan.id}`).setPlaceholder('Pilih akses...').addOptions([
                    { label: '\u{1F441}\uFE0F View only',      value: 'view',     description: 'Bisa lihat tapi tidak bisa kirim' },
                    { label: '\u2709\uFE0F View + Send',        value: 'send',     description: 'Full akses: baca + kirim pesan' },
                    { label: '\u{1F4CB} Read-only',              value: 'readonly', description: 'Bisa baca, tidak bisa kirim' },
                    { label: '\u{1F6E0}\uFE0F Manage',          value: 'manage',   description: 'Full akses + manage pesan' },
                    { label: '\u{1F6AB} Deny — blokir semua',    value: 'deny',     description: 'Tidak bisa lihat atau masuk' },
                ]),
            ),
            backRow('panel:role_channel', '\u2190 Pilih Role Lagi'),
        ],
    });
}

export async function handlePanelRoleChannelPerm(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const parts  = interaction.customId.split(':');
    const roleId = parts[2];
    const chanId = parts[3];
    const perm   = interaction.values[0];
    const preset = PERM_ALLOW[perm];
    if (!preset) { await interaction.update({ content: 'Preset tidak dikenal.', embeds: [], components: [] }); return; }
    try {
        const chan = interaction.guild.channels.cache.get(chanId) as GuildChannel | undefined;
        if (!chan) { await interaction.update({ content: '\u26A0\uFE0F Channel tidak ditemukan.', embeds: [], components: [backRow('panel:roles', '\u2190 Role Manager')] }); return; }
        await chan.permissionOverwrites.edit(roleId, preset as any);
        await interaction.update({
            embeds: [
                new EmbedBuilder().setTitle('\u2705 Akses Role Diatur').setColor('#00FF88')
                    .addFields(
                        { name: 'Role',    value: `<@&${roleId}>`,  inline: true },
                        { name: 'Channel', value: `<#${chanId}>`,   inline: true },
                        { name: 'Akses',   value: PERM_LABELS[perm], inline: true },
                    ),
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId('panel:role_channel').setLabel('\u{1F510} Atur Lagi').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('panel:roles').setLabel('\u2190 Role Manager').setStyle(ButtonStyle.Secondary),
                ),
            ],
        });
    } catch (err) {
        await interaction.update({ content: `\u274C Gagal: ${(err as Error).message}`, embeds: [], components: [backRow('panel:roles', '\u2190 Role Manager')] });
    }
}

// ── Role List ─────────────────────────────────────────────────────────────────

export async function handlePanelRoleList(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const roles = [...interaction.guild.roles.cache.values()]
        .filter(r => r.id !== interaction.guild!.id)
        .sort((a, b) => b.position - a.position)
        .slice(0, 25);
    if (!roles.length) {
        await interaction.update({ content: 'Tidak ada role.', embeds: [], components: [backRow('panel:roles', '\u2190 Role Manager')] });
        return;
    }
    const desc = roles.map((r, i) => `**${i + 1}.** ${r} — \`${r.id}\` — ${r.members.size} member`).join('\n');
    await interaction.update({
        embeds: [
            new EmbedBuilder().setTitle('\u{1F4CB} Daftar Role Server').setColor('#5865F2')
                .setDescription(desc).setFooter({ text: `Total: ${roles.length} role` }),
        ],
        components: [backRow('panel:roles', '\u2190 Role Manager')],
    });
}

// ════════════════════════════════════════════════════════════════════════════════
// QUICK ACCESS: CONFIG & BLACKLIST
// ════════════════════════════════════════════════════════════════════════════════

export async function handlePanelConfig(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const { getBotConfig } = await import('../lib/botConfig');
    const cfg = await getBotConfig();
    const embed = new EmbedBuilder()
        .setTitle('\u2699\uFE0F Konfigurasi Bot')
        .setColor('#5865F2')
        .setDescription('Atur pengaturan bot dari sini.')
        .addFields(
            { name: 'Nama Agency',       value: `\`${cfg.agency_name}\``,                    inline: true },
            { name: 'Cooldown Promo',    value: `\`${cfg.promo_cooldown_h}h\``,             inline: true },
            { name: 'Loyalty Threshold', value: `\`${cfg.loyalty_threshold} order\``,       inline: true },
            { name: 'Loyalty Points',    value: `\`${cfg.loyalty_points} pts/order\``,      inline: true },
            { name: 'Diskon Voucher',    value: `\`${cfg.voucher_discount}\``,              inline: true },
        );
    await interaction.update({
        embeds: [embed],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('cfg:set_select').setLabel('\u270F\uFE0F Ubah Setting').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('cfg:reset_select').setLabel('\u267B\uFE0F Reset Default').setStyle(ButtonStyle.Secondary),
            ),
            backRow('panel:main'),
        ],
    });
}

export async function handlePanelBlacklist(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F6AB} Blacklist Manager').setColor('#FF0000').setDescription('Kelola daftar hitam buyer:')],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('bl:add').setLabel('\u{1F6AB} Blacklist User').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('bl:remove').setLabel('\u2705 Hapus Blacklist').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('bl:check').setLabel('\u{1F50D} Cek User').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('bl:list').setLabel('\u{1F4CB} Lihat Semua').setStyle(ButtonStyle.Secondary),
            ),
            backRow('panel:main'),
        ],
    });
}

// ════════════════════════════════════════════════════════════════════════════════
// MEMBER SECTION — Quick role management per member
// ════════════════════════════════════════════════════════════════════════════════

export async function handlePanelMember(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F464} Member Role Manager').setColor('#00BBFF')
            .setDescription('Pilih member yang ingin dikelola rolenya:\n\nKamu bisa lihat role saat ini lalu tambah atau hapus role dengan cepat.'),
        ],
        components: [
            new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
                new UserSelectMenuBuilder().setCustomId('panel:member_user').setPlaceholder('Pilih member...'),
            ),
            backRow('panel:main'),
        ],
    });
}

export async function handlePanelMemberUser(interaction: UserSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const user = interaction.users.first();
    if (!user) return;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
        await interaction.update({ content: '\u26A0\uFE0F Member tidak ditemukan di server.', embeds: [], components: [backRow('panel:member', '\u2190 Pilih Ulang')] });
        return;
    }
    const memberRoles = member.roles.cache
        .filter(r => r.id !== interaction.guild!.id)
        .sort((a, b) => b.position - a.position);
    const rolesText = memberRoles.size > 0
        ? memberRoles.map(r => `${r}`).join(', ')
        : '*Tidak punya role*';
    await interaction.update({
        embeds: [
            new EmbedBuilder().setTitle(`\u{1F464} ${member.displayName}`).setColor('#00BBFF')
                .setThumbnail(user.displayAvatarURL())
                .addFields(
                    { name: 'Username', value: `${user}`, inline: true },
                    { name: `Role (${memberRoles.size})`, value: rolesText, inline: false },
                ),
        ],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`panel:member_add:${user.id}`).setLabel('\u2795 Tambah Role').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`panel:member_rm:${user.id}`).setLabel('\u2796 Hapus Role').setStyle(ButtonStyle.Danger),
            ),
            backRow('panel:member', '\u2190 Member Lain'),
        ],
    });
}

export async function handlePanelMemberAdd(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const userId = interaction.customId.replace('panel:member_add:', '');
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u2795 Tambah Role ke Member').setColor('#00FF88')
            .setDescription(`Member: <@${userId}>\n\nPilih role yang akan ditambahkan:`),
        ],
        components: [
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder().setCustomId(`panel:member_add_role:${userId}`).setPlaceholder('Pilih role...'),
            ),
            backRow('panel:member', '\u2190 Pilih Member Lagi'),
        ],
    });
}

export async function handlePanelMemberAddRole(interaction: RoleSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const userId = interaction.customId.replace('panel:member_add_role:', '');
    const role   = interaction.roles.first();
    if (!role) return;
    try {
        const member = await interaction.guild.members.fetch(userId);
        await member.roles.add(role.id);
        await interaction.update({
            embeds: [new EmbedBuilder().setTitle('\u2705 Role Ditambahkan').setColor('#00FF88')
                .addFields(
                    { name: 'Member', value: `<@${userId}>`, inline: true },
                    { name: 'Role',   value: `${role}`,       inline: true },
                ),
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId(`panel:member_add:${userId}`).setLabel('\u2795 Tambah Role Lain').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('panel:member').setLabel('\u{1F464} Member Lain').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('panel:main').setLabel('\u2190 Main Panel').setStyle(ButtonStyle.Secondary),
                ),
            ],
        });
    } catch (err) {
        await interaction.update({ content: `\u274C Gagal: ${(err as Error).message}`, embeds: [], components: [backRow('panel:member', '\u2190 Kembali')] });
    }
}

export async function handlePanelMemberRm(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const userId = interaction.customId.replace('panel:member_rm:', '');
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) {
        await interaction.update({ content: '\u26A0\uFE0F Member tidak ditemukan.', embeds: [], components: [backRow('panel:member', '\u2190 Kembali')] });
        return;
    }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u2796 Hapus Role dari Member').setColor('#FF6B35')
            .setDescription(`Member: <@${userId}>\n\nPilih role yang akan dihapus:`),
        ],
        components: [
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder().setCustomId(`panel:member_rm_role:${userId}`).setPlaceholder('Pilih role yang akan dihapus...'),
            ),
            backRow('panel:member', '\u2190 Pilih Member Lagi'),
        ],
    });
}

export async function handlePanelMemberRmRole(interaction: RoleSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }
    const userId = interaction.customId.replace('panel:member_rm_role:', '');
    const role   = interaction.roles.first();
    if (!role) return;
    try {
        const member = await interaction.guild.members.fetch(userId);
        await member.roles.remove(role.id);
        await interaction.update({
            embeds: [new EmbedBuilder().setTitle('\u2705 Role Dihapus').setColor('#00FF88')
                .addFields(
                    { name: 'Member', value: `<@${userId}>`, inline: true },
                    { name: 'Role',   value: `${role}`,       inline: true },
                ),
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId(`panel:member_rm:${userId}`).setLabel('\u2796 Hapus Role Lain').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('panel:member').setLabel('\u{1F464} Member Lain').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('panel:main').setLabel('\u2190 Main Panel').setStyle(ButtonStyle.Secondary),
                ),
            ],
        });
    } catch (err) {
        await interaction.update({ content: `\u274C Gagal: ${(err as Error).message}`, embeds: [], components: [backRow('panel:member', '\u2190 Kembali')] });
    }
}

// ════════════════════════════════════════════════════════════════════════════════
// PRODUCTS SECTION — Assign seller ke marketplace channel
// ════════════════════════════════════════════════════════════════════════════════

export async function handlePanelProducts(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }

    const services = await getAllServices();
    if (services.length === 0) {
        await interaction.update({
            embeds: [new EmbedBuilder().setTitle('\u{1F4E6} Products').setColor('#FF6600').setDescription('\u26A0\uFE0F Belum ada produk di database.')],
            components: [backRow('panel:main')],
        });
        return;
    }

    const options = services.map(s => ({
        label:       `${s.emoji} ${s.title}`.slice(0, 100),
        value:       s.id,
        description: s.seller_id ? `Seller: ID ${s.seller_id.slice(0, 18)}` : 'Belum ada seller',
    }));

    await interaction.update({
        embeds: [
            new EmbedBuilder().setTitle('\u{1F4E6} Products Manager').setColor('#5865F2')
                .setDescription('Pilih produk untuk assign atau ganti seller-nya:')
                .addFields(services.map(s => ({
                    name:   `${s.emoji} ${s.title}`,
                    value:  s.seller_id ? `\u{1F464} <@${s.seller_id}>` : '\u26A0\uFE0F *Belum diassign*',
                    inline: true,
                }))),
        ],
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('panel:product_pick')
                    .setPlaceholder('Pilih produk...')
                    .addOptions(options),
            ),
            backRow('panel:main'),
        ],
    });
}

export async function handlePanelProductPick(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }

    const serviceId = interaction.values[0];
    const services  = await getAllServices();
    const service   = services.find(s => s.id === serviceId);
    if (!service) {
        await interaction.update({ content: '\u26A0\uFE0F Produk tidak ditemukan.', embeds: [], components: [backRow('panel:products', '\u2190 Products')] });
        return;
    }

    const sellerText = service.seller_id ? `\u{1F464} <@${service.seller_id}>` : '\u26A0\uFE0F *Belum ada seller*';

    await interaction.update({
        embeds: [
            new EmbedBuilder().setTitle(`${service.emoji} ${service.title}`).setColor(service.color as any)
                .addFields(
                    { name: '\u{1F4CB} Channel', value: `\`${service.name}\``,  inline: true },
                    { name: '\u{1F464} Seller',  value: sellerText,              inline: true },
                    { name: '\u{1F4B0} Harga',   value: service.price || '-',    inline: true },
                )
                .setDescription('Klik tombol di bawah untuk assign atau ganti seller produk ini.'),
        ],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`panel:product_assign:${serviceId}`)
                    .setLabel(service.seller_id ? '\u{1F504} Ganti Seller' : '\u{1F464} Assign Seller')
                    .setStyle(ButtonStyle.Primary),
                ...(service.seller_id ? [
                    new ButtonBuilder()
                        .setCustomId(`panel:product_unassign:${serviceId}`)
                        .setLabel('\u274C Hapus Seller')
                        .setStyle(ButtonStyle.Danger),
                ] : []),
            ),
            backRow('panel:products', '\u2190 Products'),
        ],
    });
}

export async function handlePanelProductAssign(interaction: ButtonInteraction): Promise<void> {
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }

    const serviceId = interaction.customId.replace('panel:product_assign:', '');
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('\u{1F464} Assign Seller').setColor('#5865F2')
            .setDescription(`Pilih seller yang akan diassign ke produk \`${serviceId}\`:`)],
        components: [
            new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId(`panel:product_assign_user:${serviceId}`)
                    .setPlaceholder('Pilih seller...'),
            ),
            backRow(`panel:products`, '\u2190 Products'),
        ],
    });
}

export async function handlePanelProductAssignUser(interaction: UserSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }

    const serviceId  = interaction.customId.replace('panel:product_assign_user:', '');
    const newSeller  = interaction.users.first();
    if (!newSeller) return;

    const services   = await getAllServices();
    const service    = services.find(s => s.id === serviceId);
    if (!service) {
        await interaction.update({ content: '\u26A0\uFE0F Produk tidak ditemukan.', embeds: [], components: [backRow('panel:products', '\u2190 Products')] });
        return;
    }

    const { updateServiceSeller } = await import('../lib/serviceStore');
    await updateServiceSeller(serviceId, newSeller.id);

    // Update marketplace channel permissions
    const guild = interaction.guild;
    const chan   = guild.channels.cache.find(c => c.name === service.name && c.isTextBased()) as GuildChannel | undefined;
    if (chan) {
        // Remove old seller's allow overwrite if any
        if (service.seller_id && service.seller_id !== newSeller.id) {
            await chan.permissionOverwrites.delete(service.seller_id).catch(() => {});
        }
        // Find Seller role
        const sellerRole = guild.roles.cache.find(r => r.name === ROLE_NAMES.SELLER);
        if (sellerRole) {
            await chan.permissionOverwrites.edit(sellerRole.id, { ViewChannel: false }).catch(() => {});
        }
        // Allow new seller
        await chan.permissionOverwrites.edit(newSeller.id, { ViewChannel: true }).catch(() => {});
    }

    await interaction.update({
        embeds: [
            new EmbedBuilder().setTitle('\u2705 Seller Diassign').setColor('#00FF88')
                .addFields(
                    { name: '\u{1F4E6} Produk',  value: `${service.emoji} ${service.title}`, inline: true },
                    { name: '\u{1F464} Seller',  value: `${newSeller}`, inline: true },
                    { name: '\u{1F4CB} Channel', value: chan ? `<#${chan.id}>` : `\`${service.name}\` (belum ada channel)`, inline: true },
                )
                .setDescription(chan ? '\u{1F510} Permissions channel sudah diperbarui.' : '\u26A0\uFE0F Channel tidak ditemukan — jalankan `/setup` untuk membuat channel.'),
        ],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('panel:products').setLabel('\u{1F4E6} Lihat Semua Products').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('panel:main').setLabel('\u2190 Main Panel').setStyle(ButtonStyle.Secondary),
            ),
        ],
    });
}

export async function handlePanelProductUnassign(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!ownerOnly(interaction)) { await interaction.reply({ content: '\u274C', ephemeral: true }); return; }

    const serviceId = interaction.customId.replace('panel:product_unassign:', '');
    const services  = await getAllServices();
    const service   = services.find(s => s.id === serviceId);
    if (!service || !service.seller_id) {
        await interaction.update({ content: '\u26A0\uFE0F Produk atau seller tidak ditemukan.', embeds: [], components: [backRow('panel:products', '\u2190 Products')] });
        return;
    }

    const oldSellerId = service.seller_id;
    const { updateServiceSeller } = await import('../lib/serviceStore');
    await updateServiceSeller(serviceId, null);

    // Remove seller's ViewChannel overwrite from channel
    const chan = interaction.guild.channels.cache.find(c => c.name === service.name && c.isTextBased()) as GuildChannel | undefined;
    if (chan) {
        await chan.permissionOverwrites.delete(oldSellerId).catch(() => {});
    }

    await interaction.update({
        embeds: [
            new EmbedBuilder().setTitle('\u2705 Seller Dihapus dari Produk').setColor('#FF6600')
                .addFields(
                    { name: '\u{1F4E6} Produk', value: `${service.emoji} ${service.title}`, inline: true },
                    { name: 'Seller Lama', value: `<@${oldSellerId}>`, inline: true },
                ),
        ],
        components: [backRow('panel:products', '\u2190 Products')],
    });
}
