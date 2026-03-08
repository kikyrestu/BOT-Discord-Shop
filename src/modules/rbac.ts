import {
    ChatInputCommandInteraction,
    ButtonInteraction,
    UserSelectMenuInteraction,
    RoleSelectMenuInteraction,
    ChannelSelectMenuInteraction,
    StringSelectMenuInteraction,
    ModalSubmitInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    UserSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    ChannelType,
    GuildChannel,
    GuildMember,
} from 'discord.js';
import { OWNER_ID } from '../config';

type PermKey = 'ViewChannel' | 'SendMessages' | 'ReadMessageHistory' | 'ManageMessages' | 'AttachFiles' | 'EmbedLinks';

const ALLOW_PRESETS: Record<string, Partial<Record<PermKey, boolean>>> = {
    view:     { ViewChannel: true,  ReadMessageHistory: true },
    send:     { ViewChannel: true,  SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true },
    readonly: { ViewChannel: true,  ReadMessageHistory: true, SendMessages: false },
    manage:   { ViewChannel: true,  SendMessages: true, ReadMessageHistory: true, ManageMessages: true, AttachFiles: true, EmbedLinks: true },
};

const DENY_PRESETS: Record<string, Partial<Record<PermKey, boolean>>> = {
    all:  { ViewChannel: false, SendMessages: false },
    send: { SendMessages: false },
    view: { ViewChannel: false },
};

function isAdmin(member: GuildMember | null, userId: string): boolean {
    if (userId === OWNER_ID) return true;
    return member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
}

async function rbacLog(guild: any, action: string, by: string): Promise<void> {
    const lc = guild.channels.cache.find((c: any) => c.name === 'rbac-log' && c.isTextBased());
    if (!lc) return;
    await lc.send({
        embeds: [new EmbedBuilder().setTitle('RBAC Log').setDescription(action)
            .setFooter({ text: by }).setTimestamp().setColor('#FFA500')]
    }).catch(() => {});
}

function mainMenuComponents(): ActionRowBuilder<ButtonBuilder>[] {
    return [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('rbac:role_menu').setLabel('Kelola Role').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('rbac:chan_menu').setLabel('Kelola Channel').setStyle(ButtonStyle.Success),
    )];
}

function mainEmbed(): EmbedBuilder {
    return new EmbedBuilder().setTitle('RBAC Panel').setColor('#5865F2').setDescription('Pilih kategori:');
}

function backToMain(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('rbac:main').setLabel('Menu Utama').setStyle(ButtonStyle.Secondary),
    );
}

// ── Entry ──────────────────────────────────────────────────────────────────────

export async function handleRbacCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'Hanya Owner/Admin.', ephemeral: true }); return;
    }
    await interaction.reply({ embeds: [mainEmbed()], components: mainMenuComponents(), ephemeral: true });
}

export async function handleRbacMain(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    await interaction.update({ embeds: [mainEmbed()], components: mainMenuComponents() });
}

// ── Role Menu ──────────────────────────────────────────────────────────────────

export async function handleRbacRoleMenu(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Kelola Role').setColor('#5865F2').setDescription('Pilih aksi:')],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('rbac:role_create').setLabel('+ Buat').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('rbac:role_delete').setLabel('Hapus').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('rbac:role_assign').setLabel('Assign').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('rbac:role_revoke').setLabel('Cabut').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rbac:role_list').setLabel('List').setStyle(ButtonStyle.Secondary),
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacRoleCreate(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const modal = new ModalBuilder().setCustomId('rbac:role_create_modal').setTitle('Buat Role Baru');
    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('name').setLabel('Nama Role').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('color').setLabel('Warna Hex (opsional)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('#FF5500')
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('hoist').setLabel('Tampil terpisah? ya/tidak').setStyle(TextInputStyle.Short).setRequired(false)
        ),
    );
    await interaction.showModal(modal);
}

export async function handleRbacRoleCreateModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const name  = interaction.fields.getTextInputValue('name').trim();
    const color = interaction.fields.getTextInputValue('color').trim() || undefined;
    const hoist = interaction.fields.getTextInputValue('hoist').trim().toLowerCase() === 'ya';
    try {
        const role = await interaction.guild.roles.create({ name, color: color as any, hoist, mentionable: true });
        await rbacLog(interaction.guild, `Buat role ${role.name} (${role.id})`, interaction.user.id);
        await interaction.reply({ content: `Role ${role} berhasil dibuat.`, ephemeral: true });
    } catch (err) {
        await interaction.reply({ content: `Gagal: ${(err as Error).message}`, ephemeral: true });
    }
}

export async function handleRbacRoleDelete(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Hapus Role').setColor('#FF0000').setDescription('Pilih role:')],
        components: [
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder().setCustomId('rbac:role_delete_pick').setPlaceholder('Pilih role...')
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacRoleDeletePick(interaction: RoleSelectMenuInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const role = interaction.roles.first();
    if (!role) return;
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Konfirmasi').setColor('#FF0000').setDescription(`Hapus role ${role}?`)],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`rbac:role_delete_confirm:${role.id}`).setLabel('Ya, Hapus').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('rbac:role_menu').setLabel('Batal').setStyle(ButtonStyle.Secondary),
        )],
    });
}

export async function handleRbacRoleDeleteConfirm(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const roleId = interaction.customId.replace('rbac:role_delete_confirm:', '');
    try {
        const role = await interaction.guild.roles.fetch(roleId);
        if (!role) { await interaction.update({ content: 'Role tidak ditemukan.', embeds: [], components: [] }); return; }
        const n = role.name;
        await role.delete();
        await rbacLog(interaction.guild, `Hapus role ${n} (${roleId})`, interaction.user.id);
        await interaction.update({ content: `Role ${n} dihapus.`, embeds: [], components: [backToMain()] });
    } catch (err) {
        await interaction.update({ content: `Gagal: ${(err as Error).message}`, embeds: [], components: [backToMain()] });
    }
}

export async function handleRbacRoleAssign(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Assign Role 1/2').setColor('#00FF88').setDescription('Pilih user:')],
        components: [
            new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
                new UserSelectMenuBuilder().setCustomId('rbac:role_assign_user').setPlaceholder('Pilih user...')
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacRoleAssignUser(interaction: UserSelectMenuInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const user = interaction.users.first();
    if (!user) return;
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Assign Role 2/2').setColor('#00FF88').setDescription(`User: ${user}\nPilih role:`)],
        components: [
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder().setCustomId(`rbac:role_assign_role:${user.id}`).setPlaceholder('Pilih role...')
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacRoleAssignRole(interaction: RoleSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const userId = interaction.customId.replace('rbac:role_assign_role:', '');
    const role   = interaction.roles.first();
    if (!role) return;
    try {
        const member = await interaction.guild.members.fetch(userId);
        await member.roles.add(role.id);
        await rbacLog(interaction.guild, `Assign ${role.name} ke ${userId}`, interaction.user.id);
        await interaction.update({ content: `Role ${role} diberikan ke <@${userId}>.`, embeds: [], components: [backToMain()] });
    } catch (err) {
        await interaction.update({ content: `Gagal: ${(err as Error).message}`, embeds: [], components: [backToMain()] });
    }
}

export async function handleRbacRoleRevoke(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Cabut Role 1/2').setColor('#FF6B35').setDescription('Pilih user:')],
        components: [
            new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
                new UserSelectMenuBuilder().setCustomId('rbac:role_revoke_user').setPlaceholder('Pilih user...')
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacRoleRevokeUser(interaction: UserSelectMenuInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const user = interaction.users.first();
    if (!user) return;
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Cabut Role 2/2').setColor('#FF6B35').setDescription(`User: ${user}\nPilih role:`)],
        components: [
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder().setCustomId(`rbac:role_revoke_role:${user.id}`).setPlaceholder('Pilih role...')
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacRoleRevokeRole(interaction: RoleSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const userId = interaction.customId.replace('rbac:role_revoke_role:', '');
    const role   = interaction.roles.first();
    if (!role) return;
    try {
        const member = await interaction.guild.members.fetch(userId);
        await member.roles.remove(role.id);
        await rbacLog(interaction.guild, `Cabut ${role.name} dari ${userId}`, interaction.user.id);
        await interaction.update({ content: `Role ${role} dicabut dari <@${userId}>.`, embeds: [], components: [backToMain()] });
    } catch (err) {
        await interaction.update({ content: `Gagal: ${(err as Error).message}`, embeds: [], components: [backToMain()] });
    }
}

export async function handleRbacRoleList(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const roles = [...interaction.guild.roles.cache.values()]
        .filter(r => r.id !== interaction.guild!.id)
        .sort((a, b) => b.position - a.position)
        .slice(0, 25);
    const desc = roles.map(r => `${r} — \`${r.id}\``).join('\n') || 'Tidak ada role.';
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Daftar Role').setColor('#5865F2').setDescription(desc)],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('rbac:role_menu').setLabel('Kembali').setStyle(ButtonStyle.Secondary)
        )],
    });
}

// ── Channel Menu ───────────────────────────────────────────────────────────────

export async function handleRbacChanMenu(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Kelola Channel').setColor('#00FF88').setDescription('Pilih aksi:')],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('rbac:chan_allow').setLabel('Allow').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('rbac:chan_deny').setLabel('Deny').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('rbac:chan_reset').setLabel('Reset').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rbac:chan_info').setLabel('Info').setStyle(ButtonStyle.Primary),
            ),
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('rbac:chan_lockdown').setLabel('Lockdown').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('rbac:chan_unlock').setLabel('Unlock').setStyle(ButtonStyle.Success),
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacChanAllow(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Allow 1/3').setColor('#00FF88').setDescription('Pilih channel:')],
        components: [
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('rbac:chan_allow_chan').setPlaceholder('Pilih channel...').addChannelTypes(ChannelType.GuildText)
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacChanAllowChan(interaction: ChannelSelectMenuInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const chan = interaction.channels.first();
    if (!chan) return;
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Allow 2/3').setColor('#00FF88').setDescription(`Channel: <#${chan.id}>\nPilih role:`)],
        components: [
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder().setCustomId(`rbac:chan_allow_role:${chan.id}`).setPlaceholder('Pilih role...')
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacChanAllowRole(interaction: RoleSelectMenuInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const chanId = interaction.customId.replace('rbac:chan_allow_role:', '');
    const role   = interaction.roles.first();
    if (!role) return;
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Allow 3/3').setColor('#00FF88').setDescription(`<#${chanId}> / ${role}\nPilih jenis akses:`)],
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder().setCustomId(`rbac:chan_allow_perm:${chanId}:${role.id}`).setPlaceholder('Pilih...').addOptions([
                    { label: 'View only',   value: 'view'     },
                    { label: 'View + Send', value: 'send'     },
                    { label: 'Read-only',   value: 'readonly' },
                    { label: 'Manage',      value: 'manage'   },
                ])
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacChanAllowPerm(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const parts  = interaction.customId.split(':');
    const chanId = parts[2];
    const roleId = parts[3];
    const perm   = interaction.values[0];
    const preset = ALLOW_PRESETS[perm];
    if (!preset) { await interaction.update({ content: 'Preset tidak dikenal.', embeds: [], components: [backToMain()] }); return; }
    try {
        const chan = interaction.guild.channels.cache.get(chanId) as GuildChannel | undefined;
        if (!chan) { await interaction.update({ content: 'Channel tidak ditemukan.', embeds: [], components: [backToMain()] }); return; }
        await chan.permissionOverwrites.edit(roleId, preset as any);
        await rbacLog(interaction.guild, `Allow ${perm} <@&${roleId}> di <#${chanId}>`, interaction.user.id);
        await interaction.update({ content: `Allow ${perm} set untuk <@&${roleId}> di <#${chanId}>.`, embeds: [], components: [backToMain()] });
    } catch (err) {
        await interaction.update({ content: `Gagal: ${(err as Error).message}`, embeds: [], components: [backToMain()] });
    }
}

export async function handleRbacChanDeny(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Deny 1/3').setColor('#FF0000').setDescription('Pilih channel:')],
        components: [
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('rbac:chan_deny_chan').setPlaceholder('Pilih channel...').addChannelTypes(ChannelType.GuildText)
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacChanDenyChan(interaction: ChannelSelectMenuInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const chan = interaction.channels.first();
    if (!chan) return;
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Deny 2/3').setColor('#FF0000').setDescription(`Channel: <#${chan.id}>\nPilih role:`)],
        components: [
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder().setCustomId(`rbac:chan_deny_role:${chan.id}`).setPlaceholder('Pilih role...')
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacChanDenyRole(interaction: RoleSelectMenuInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const chanId = interaction.customId.replace('rbac:chan_deny_role:', '');
    const role   = interaction.roles.first();
    if (!role) return;
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Deny 3/3').setColor('#FF0000').setDescription(`<#${chanId}> / ${role}\nPilih yang diblokir:`)],
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder().setCustomId(`rbac:chan_deny_perm:${chanId}:${role.id}`).setPlaceholder('Pilih...').addOptions([
                    { label: 'Semua akses', value: 'all'  },
                    { label: 'Kirim pesan', value: 'send' },
                    { label: 'View channel', value: 'view' },
                ])
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacChanDenyPerm(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const parts  = interaction.customId.split(':');
    const chanId = parts[2];
    const roleId = parts[3];
    const perm   = interaction.values[0];
    const preset = DENY_PRESETS[perm];
    if (!preset) { await interaction.update({ content: 'Preset tidak dikenal.', embeds: [], components: [backToMain()] }); return; }
    try {
        const chan = interaction.guild.channels.cache.get(chanId) as GuildChannel | undefined;
        if (!chan) { await interaction.update({ content: 'Channel tidak ditemukan.', embeds: [], components: [backToMain()] }); return; }
        await chan.permissionOverwrites.edit(roleId, preset as any);
        await rbacLog(interaction.guild, `Deny ${perm} <@&${roleId}> di <#${chanId}>`, interaction.user.id);
        await interaction.update({ content: `Deny ${perm} set untuk <@&${roleId}> di <#${chanId}>.`, embeds: [], components: [backToMain()] });
    } catch (err) {
        await interaction.update({ content: `Gagal: ${(err as Error).message}`, embeds: [], components: [backToMain()] });
    }
}

export async function handleRbacChanReset(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Reset 1/2').setColor('#FFA500').setDescription('Pilih channel:')],
        components: [
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('rbac:chan_reset_chan').setPlaceholder('Pilih channel...').addChannelTypes(ChannelType.GuildText)
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacChanResetChan(interaction: ChannelSelectMenuInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const chan = interaction.channels.first();
    if (!chan) return;
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Reset 2/2').setColor('#FFA500').setDescription(`Channel: <#${chan.id}>\nPilih role:`)],
        components: [
            new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
                new RoleSelectMenuBuilder().setCustomId(`rbac:chan_reset_role:${chan.id}`).setPlaceholder('Pilih role...')
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacChanResetRole(interaction: RoleSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const chanId = interaction.customId.replace('rbac:chan_reset_role:', '');
    const role   = interaction.roles.first();
    if (!role) return;
    try {
        const chan = interaction.guild.channels.cache.get(chanId) as GuildChannel | undefined;
        if (!chan) { await interaction.update({ content: 'Channel tidak ditemukan.', embeds: [], components: [backToMain()] }); return; }
        await chan.permissionOverwrites.delete(role.id);
        await rbacLog(interaction.guild, `Reset override <@&${role.id}> di <#${chanId}>`, interaction.user.id);
        await interaction.update({ content: `Override <@&${role.id}> di <#${chanId}> direset.`, embeds: [], components: [backToMain()] });
    } catch (err) {
        await interaction.update({ content: `Gagal: ${(err as Error).message}`, embeds: [], components: [backToMain()] });
    }
}

export async function handleRbacChanInfo(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Info Permission').setColor('#5865F2').setDescription('Pilih channel:')],
        components: [
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('rbac:chan_info_chan').setPlaceholder('Pilih channel...').addChannelTypes(ChannelType.GuildText)
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacChanInfoChan(interaction: ChannelSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const chanId = interaction.channels.first()?.id;
    if (!chanId) return;
    const chan = interaction.guild.channels.cache.get(chanId) as GuildChannel | undefined;
    if (!chan) { await interaction.update({ content: 'Channel tidak ditemukan.', embeds: [], components: [backToMain()] }); return; }
    const overwrites = chan.permissionOverwrites.cache;
    if (!overwrites.size) {
        await interaction.update({ content: `<#${chanId}> tidak punya override.`, embeds: [], components: [backToMain()] }); return;
    }
    const lines: string[] = [];
    for (const [id, ow] of overwrites) {
        const target = ow.type === 0 ? `<@&${id}>` : `<@${id}>`;
        const allows = ow.allow.toArray().join(', ') || 'none';
        const denies = ow.deny.toArray().join(', ') || 'none';
        lines.push(`${target}: allow=${allows} deny=${denies}`);
    }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle(`Overrides #${(chan as any).name ?? chanId}`).setColor('#5865F2').setDescription(lines.slice(0, 10).join('\n'))],
        components: [backToMain()],
    });
}

export async function handleRbacChanLockdown(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Lockdown').setColor('#FF0000').setDescription('Pilih channel yang dikunci:')],
        components: [
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('rbac:chan_lockdown_chan').setPlaceholder('Pilih channel...').addChannelTypes(ChannelType.GuildText)
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacChanLockdownChan(interaction: ChannelSelectMenuInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const chan = interaction.channels.first();
    if (!chan) return;
    const modal = new ModalBuilder().setCustomId(`rbac:lockdown_modal:${chan.id}`).setTitle('Lockdown');
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('Alasan (opsional)').setStyle(TextInputStyle.Short).setRequired(false)
    ));
    await interaction.showModal(modal);
}

export async function handleRbacLockdownModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const chanId = interaction.customId.replace('rbac:lockdown_modal:', '');
    const reason = interaction.fields.getTextInputValue('reason').trim() || 'Tidak ada alasan';
    try {
        const chan = interaction.guild.channels.cache.get(chanId) as GuildChannel | undefined;
        if (!chan) { await interaction.reply({ content: 'Channel tidak ditemukan.', ephemeral: true }); return; }
        await chan.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
        await rbacLog(interaction.guild, `Lockdown <#${chanId}>: ${reason}`, interaction.user.id);
        await interaction.reply({ content: `<#${chanId}> dikunci. Alasan: ${reason}`, ephemeral: true });
    } catch (err) {
        await interaction.reply({ content: `Gagal: ${(err as Error).message}`, ephemeral: true });
    }
}

export async function handleRbacChanUnlock(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Unlock').setColor('#00FF88').setDescription('Pilih channel:')],
        components: [
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder().setCustomId('rbac:chan_unlock_chan').setPlaceholder('Pilih channel...').addChannelTypes(ChannelType.GuildText)
            ),
            backToMain(),
        ],
    });
}

export async function handleRbacChanUnlockChan(interaction: ChannelSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: 'No.', ephemeral: true }); return;
    }
    const chanObj = interaction.channels.first();
    if (!chanObj) return;
    try {
        const chan = interaction.guild.channels.cache.get(chanObj.id) as GuildChannel | undefined;
        if (!chan) { await interaction.update({ content: 'Channel tidak ditemukan.', embeds: [], components: [backToMain()] }); return; }
        await chan.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
        await rbacLog(interaction.guild, `Unlock <#${chanObj.id}>`, interaction.user.id);
        await interaction.update({ content: `<#${chanObj.id}> dibuka kuncinya.`, embeds: [], components: [backToMain()] });
    } catch (err) {
        await interaction.update({ content: `Gagal: ${(err as Error).message}`, embeds: [], components: [backToMain()] });
    }
}
