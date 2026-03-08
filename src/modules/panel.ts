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
import { OWNER_ID } from '../config';

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
            '\u{1F465} **Roles** — Buat, hapus, assign ke user & channel\n' +
            '\u2699\uFE0F **Config** — Pengaturan bot\n' +
            '\u{1F6AB} **Blacklist** — Kelola daftar hitam buyer',
        )
        .setFooter({ text: 'Owner Only Panel' });
}

function mainRows(): ActionRowBuilder<ButtonBuilder>[] {
    return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('panel:channels').setLabel('\u{1F4CB} Channels').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('panel:roles').setLabel('\u{1F465} Roles').setStyle(ButtonStyle.Success),
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
