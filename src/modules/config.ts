import {
    ChatInputCommandInteraction,
    ButtonInteraction,
    StringSelectMenuInteraction,
    ModalSubmitInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    ButtonStyle,
    TextInputStyle,
} from 'discord.js';
import { OWNER_ID } from '../config';
import { getBotConfig, setBotConfig, BotConfig } from '../lib/botConfig';

const CONFIG_META: Record<keyof BotConfig, { label: string; desc: string; unit?: string }> = {
    agency_name:       { label: 'Nama Agency',       desc: 'Nama yang muncul di footer semua embed' },
    promo_cooldown_h:  { label: 'Cooldown Promo',    desc: 'Jeda waktu share server (jam)',  unit: 'jam' },
    loyalty_threshold: { label: 'Loyalty Threshold', desc: 'Jumlah order untuk dapat voucher' },
    loyalty_points:    { label: 'Poin per Order',    desc: 'Poin yang didapat tiap order' },
    voucher_discount:  { label: 'Diskon Voucher',    desc: 'Teks diskon pada voucher (contoh: 10%)' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function buildConfigEmbed(): Promise<EmbedBuilder> {
    const cfg = await getBotConfig();
    return new EmbedBuilder()
        .setTitle('⚙️  Konfigurasi Bot')
        .setColor('#5865F2')
        .setDescription('Pilih aksi di bawah untuk mengubah atau mereset pengaturan.')
        .addFields(
            (Object.entries(CONFIG_META) as [keyof BotConfig, typeof CONFIG_META[keyof BotConfig]][])
                .map(([k, meta]) => ({
                    name:   meta.label,
                    value:  `\`${cfg[k]}\`${meta.unit ? ` ${meta.unit}` : ''}\n-# ${meta.desc}`,
                    inline: true,
                }))
        )
        .setFooter({ text: `${cfg.agency_name} • Config Panel` })
        .setTimestamp();
}

function buildConfigButtons(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('cfg:set_select').setLabel('✏️ Ubah Setting').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfg:reset_select').setLabel('🔄 Reset ke Default').setStyle(ButtonStyle.Secondary),
    );
}

function buildKeySelectMenu(customId: string, placeholder: string): ActionRowBuilder<StringSelectMenuBuilder> {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder)
            .addOptions(
                (Object.entries(CONFIG_META) as [keyof BotConfig, typeof CONFIG_META[keyof BotConfig]][])
                    .map(([k, meta]) => ({
                        label:       meta.label,
                        description: meta.desc,
                        value:       k,
                    }))
            )
    );
}

// ─── Entry point — /config ────────────────────────────────────────────────────

export async function handleConfigCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.user.id !== OWNER_ID) {
        await interaction.reply({ content: '❌ Hanya Owner yang bisa mengubah konfigurasi bot.', ephemeral: true });
        return;
    }
    const embed = await buildConfigEmbed();
    await interaction.reply({ embeds: [embed], components: [buildConfigButtons()], ephemeral: true });
}

// ─── Button: "Ubah Setting" → tampilkan select menu key ──────────────────────

export async function handleConfigSetSelect(interaction: ButtonInteraction): Promise<void> {
    if (interaction.user.id !== OWNER_ID) { await interaction.reply({ content: '❌', ephemeral: true }); return; }
    await interaction.update({
        content:    '**Pilih pengaturan yang ingin diubah:**',
        embeds:     [],
        components: [buildKeySelectMenu('cfg:set_key', 'Pilih setting...')],
    });
}

// ─── Button: "Reset ke Default" → tampilkan select menu key ──────────────────

export async function handleConfigResetSelect(interaction: ButtonInteraction): Promise<void> {
    if (interaction.user.id !== OWNER_ID) { await interaction.reply({ content: '❌', ephemeral: true }); return; }
    await interaction.update({
        content:    '**Pilih pengaturan yang ingin direset ke default:**',
        embeds:     [],
        components: [buildKeySelectMenu('cfg:reset_key', 'Pilih setting...')],
    });
}

// ─── Select: pilih key untuk di-set → tampilkan modal ────────────────────────

export async function handleConfigSetKeySelect(interaction: StringSelectMenuInteraction): Promise<void> {
    if (interaction.user.id !== OWNER_ID) { await interaction.reply({ content: '❌', ephemeral: true }); return; }

    const key  = interaction.values[0] as keyof BotConfig;
    const meta = CONFIG_META[key];
    const cfg  = await getBotConfig();

    const modal = new ModalBuilder()
        .setCustomId(`cfg:set_modal:${key}`)
        .setTitle(`Ubah: ${meta.label}`);

    const input = new TextInputBuilder()
        .setCustomId('value')
        .setLabel(meta.desc)
        .setStyle(TextInputStyle.Short)
        .setValue(String(cfg[key]))
        .setRequired(true)
        .setMaxLength(100);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
}

// ─── Select: pilih key untuk di-reset → konfirmasi tombol ────────────────────

export async function handleConfigResetKeySelect(interaction: StringSelectMenuInteraction): Promise<void> {
    if (interaction.user.id !== OWNER_ID) { await interaction.reply({ content: '❌', ephemeral: true }); return; }

    const key  = interaction.values[0] as keyof BotConfig;
    const meta = CONFIG_META[key];

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`cfg:reset_confirm:${key}`).setLabel(`Ya, Reset "${meta.label}"`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cfg:back').setLabel('Batal').setStyle(ButtonStyle.Secondary),
    );

    await interaction.update({
        content:    `⚠️ Reset **${meta.label}** ke nilai default?\nNilai default: sesuai kode sumber bot.`,
        embeds:     [],
        components: [row],
    });
}

// ─── Modal submit: nilai baru di-submit ──────────────────────────────────────

export async function handleConfigSetModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (interaction.user.id !== OWNER_ID) { await interaction.reply({ content: '❌', ephemeral: true }); return; }

    const key   = interaction.customId.replace('cfg:set_modal:', '') as keyof BotConfig;
    const value = interaction.fields.getTextInputValue('value').trim();
    const meta  = CONFIG_META[key];

    const numericFields: (keyof BotConfig)[] = ['promo_cooldown_h', 'loyalty_threshold', 'loyalty_points'];
    if (numericFields.includes(key)) {
        const n = Number(value);
        if (isNaN(n) || n <= 0) {
            await interaction.reply({
                content: `❌ Nilai untuk **${meta.label}** harus berupa angka positif.`,
                ephemeral: true,
            });
            return;
        }
    }

    await setBotConfig(key, value);

    const embed = await buildConfigEmbed();
    await interaction.reply({
        content:    `✅ **${meta.label}** diperbarui ke \`${value}\`.`,
        embeds:     [embed],
        components: [buildConfigButtons()],
        ephemeral:  true,
    });
}

// ─── Button: konfirmasi reset ─────────────────────────────────────────────────

export async function handleConfigResetConfirm(interaction: ButtonInteraction): Promise<void> {
    if (interaction.user.id !== OWNER_ID) { await interaction.reply({ content: '❌', ephemeral: true }); return; }

    const key  = interaction.customId.replace('cfg:reset_confirm:', '') as keyof BotConfig;
    const meta = CONFIG_META[key];

    const { pool } = await import('../lib/db');
    await pool.query('DELETE FROM bot_state WHERE key = $1', [`cfg_${key}`]);
    const { invalidateBotConfigCache } = await import('../lib/botConfig');
    invalidateBotConfigCache();

    const embed = await buildConfigEmbed();
    await interaction.update({
        content:    `♻️ **${meta.label}** berhasil direset ke nilai default.`,
        embeds:     [embed],
        components: [buildConfigButtons()],
    });
}

// ─── Button: back → kembali ke tampilan utama ─────────────────────────────────

export async function handleConfigBack(interaction: ButtonInteraction): Promise<void> {
    if (interaction.user.id !== OWNER_ID) { await interaction.reply({ content: '❌', ephemeral: true }); return; }
    const embed = await buildConfigEmbed();
    await interaction.update({ content: null, embeds: [embed], components: [buildConfigButtons()] });
}

