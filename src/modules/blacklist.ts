import {
    ChatInputCommandInteraction,
    ButtonInteraction,
    UserSelectMenuInteraction,
    ModalSubmitInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    UserSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    ButtonStyle,
    TextInputStyle,
    GuildMember,
} from "discord.js";
import { pool } from "../lib/db";
import { ROLE_NAMES, OWNER_ID } from "../config";

function isAdmin(member: GuildMember | null, userId: string): boolean {
    if (userId === OWNER_ID) return true;
    return member?.roles.cache.some(r => [ROLE_NAMES.OWNER, ROLE_NAMES.ADMIN].includes(r.name as any)) ?? false;
}

function mainRow(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("bl:add").setLabel("🚫 Blacklist User").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("bl:remove").setLabel("✅ Hapus Blacklist").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("bl:check").setLabel("🔍 Cek User").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("bl:list").setLabel("📋 Lihat Semua").setStyle(ButtonStyle.Secondary),
    );
}

function backRow(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("bl:back").setLabel("← Kembali").setStyle(ButtonStyle.Secondary),
    );
}

// ─── Entry: /blacklist ───────────────────────────────────────────────────────

export async function handleBlacklistCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) {
        await interaction.reply({ content: "❌ Hanya Admin/Owner yang bisa mengelola blacklist.", ephemeral: true });
        return;
    }
    await interaction.reply({
        embeds: [new EmbedBuilder().setTitle("🚫 Blacklist Manager").setColor("#FF0000").setDescription("Kelola daftar hitam buyer lewat panel di bawah.")],
        components: [mainRow()],
        ephemeral: true,
    });
}

// ─── Back ────────────────────────────────────────────────────────────────────

export async function handleBlacklistBack(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) { await interaction.reply({ content: "❌", ephemeral: true }); return; }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle("🚫 Blacklist Manager").setColor("#FF0000").setDescription("Kelola daftar hitam buyer lewat panel di bawah.")],
        components: [mainRow()],
    });
}

// ─── Add: UserSelectMenu → Modal alasan ─────────────────────────────────────

export async function handleBlacklistAdd(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) { await interaction.reply({ content: "❌", ephemeral: true }); return; }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle("🚫 Blacklist User — 1/2").setColor("#FF0000").setDescription("Pilih user yang akan diblacklist:")],
        components: [
            new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(new UserSelectMenuBuilder().setCustomId("bl:add_user").setPlaceholder("Pilih user...")),
            backRow(),
        ],
    });
}

export async function handleBlacklistAddUser(interaction: UserSelectMenuInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) { await interaction.reply({ content: "❌", ephemeral: true }); return; }
    const user = interaction.users.first();
    if (!user) return;
    const modal = new ModalBuilder().setCustomId(`bl:add_modal:${user.id}`).setTitle(`Blacklist ${user.username}`);
    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("reason").setLabel("Alasan blacklist (opsional)").setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder("Contoh: Scammer, tidak bayar, dll...")
        )
    );
    await interaction.showModal(modal);
}

export async function handleBlacklistAddModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guild) return;
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) { await interaction.reply({ content: "❌", ephemeral: true }); return; }
    const userId = interaction.customId.replace("bl:add_modal:", "");
    const reason = interaction.fields.getTextInputValue("reason").trim() || "Tidak ada alasan";
    await pool.query(
        `INSERT INTO blacklist (user_id, reason, added_by, added_at) VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id) DO UPDATE SET reason = $2, added_by = $3, added_at = NOW()`,
        [userId, reason, interaction.user.id]
    );
    await interaction.reply({
        embeds: [
            new EmbedBuilder().setTitle("✅ User Diblacklist").setColor("#FF0000")
                .addFields(
                    { name: "User", value: `<@${userId}> (\`${userId}\`)`, inline: false },
                    { name: "Alasan", value: reason, inline: false },
                    { name: "Oleh", value: `${interaction.user}`, inline: false },
                ).setTimestamp()
        ],
        components: [backRow()],
        ephemeral: true,
    });
}

// ─── Remove: UserSelectMenu → konfirmasi ────────────────────────────────────

export async function handleBlacklistRemove(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) { await interaction.reply({ content: "❌", ephemeral: true }); return; }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle("✅ Hapus dari Blacklist").setColor("#00FF88").setDescription("Pilih user yang akan dihapus dari blacklist:")],
        components: [
            new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(new UserSelectMenuBuilder().setCustomId("bl:remove_user").setPlaceholder("Pilih user...")),
            backRow(),
        ],
    });
}

export async function handleBlacklistRemoveUser(interaction: UserSelectMenuInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) { await interaction.reply({ content: "❌", ephemeral: true }); return; }
    const user = interaction.users.first();
    if (!user) return;
    const { rowCount } = await pool.query("DELETE FROM blacklist WHERE user_id = $1", [user.id]);
    if (!rowCount || rowCount === 0) {
        await interaction.update({ content: `ℹ️ ${user} tidak ada di blacklist.`, embeds: [], components: [backRow()] });
    } else {
        await interaction.update({ content: `✅ ${user} berhasil dihapus dari blacklist.`, embeds: [], components: [backRow()] });
    }
}

// ─── Check: UserSelectMenu → tampilkan status ────────────────────────────────

export async function handleBlacklistCheck(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) { await interaction.reply({ content: "❌", ephemeral: true }); return; }
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle("🔍 Cek Status Blacklist").setColor("#5865F2").setDescription("Pilih user yang ingin dicek:")],
        components: [
            new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(new UserSelectMenuBuilder().setCustomId("bl:check_user").setPlaceholder("Pilih user...")),
            backRow(),
        ],
    });
}

export async function handleBlacklistCheckUser(interaction: UserSelectMenuInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) { await interaction.reply({ content: "❌", ephemeral: true }); return; }
    const user = interaction.users.first();
    if (!user) return;
    const { rows } = await pool.query("SELECT reason, added_by, added_at FROM blacklist WHERE user_id = $1", [user.id]);
    if (rows.length === 0) {
        await interaction.update({
            embeds: [new EmbedBuilder().setTitle("✅ Tidak di Blacklist").setColor("#00FF88").setDescription(`${user} tidak ada di blacklist.`)],
            components: [backRow()],
        });
    } else {
        const r = rows[0];
        await interaction.update({
            embeds: [
                new EmbedBuilder().setTitle("🚫 User Terblacklist").setColor("#FF0000")
                    .addFields(
                        { name: "User",        value: `${user}`,                                                    inline: false },
                        { name: "Alasan",      value: r.reason,                                                     inline: false },
                        { name: "Diblacklist", value: `<t:${Math.floor(new Date(r.added_at).getTime() / 1000)}:F>`, inline: true  },
                        { name: "Oleh",        value: `<@${r.added_by}>`,                                           inline: true  },
                    ).setTimestamp()
            ],
            components: [backRow()],
        });
    }
}

// ─── List ────────────────────────────────────────────────────────────────────

export async function handleBlacklistList(interaction: ButtonInteraction): Promise<void> {
    if (!isAdmin(interaction.member as GuildMember, interaction.user.id)) { await interaction.reply({ content: "❌", ephemeral: true }); return; }
    const { rows } = await pool.query("SELECT user_id, reason, added_at FROM blacklist ORDER BY added_at DESC LIMIT 25");
    if (rows.length === 0) {
        await interaction.update({ content: "✅ Blacklist kosong.", embeds: [], components: [backRow()] });
        return;
    }
    const desc = rows.map((r: any, i: number) =>
        `**${i + 1}.** <@${r.user_id}> — ${r.reason} *(${new Date(r.added_at).toLocaleDateString("id-ID")})*`
    ).join("\n");
    await interaction.update({
        embeds: [new EmbedBuilder().setTitle("🚫 Daftar Blacklist").setColor("#FF0000").setDescription(desc).setFooter({ text: `Total: ${rows.length} user` })],
        components: [backRow()],
    });
}

// ─── Utility export (dipakai ticket.ts) ─────────────────────────────────────

export async function isBlacklisted(userId: string): Promise<boolean> {
    const { rows } = await pool.query("SELECT 1 FROM blacklist WHERE user_id = $1", [userId]);
    return rows.length > 0;
}
