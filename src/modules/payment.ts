import {
    Interaction,
    ModalSubmitInteraction,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    TextChannel,
    Guild,
    GuildMember,
} from 'discord.js';
import { pool } from '../lib/db';
import { ROLE_NAMES } from '../config';

export const PAYMENT_CHANNEL_NAME = '💳-cara-pembayaran';

interface PaymentMethod {
    name: string;
    account_number: string;
    account_name: string;
    emoji: string;
}

// Warna per jenis metode (lowercase match)
const METHOD_COLORS: Record<string, string> = {
    gopay:    '#00AED6',
    ovo:      '#4C3494',
    dana:     '#108BE3',
    shopeepay:'#EE4D2D',
    linkaja:  '#E82529',
    bca:      '#005BAC',
    bni:      '#F68B1F',
    bri:      '#003087',
    mandiri:  '#003087',
    jenius:   '#00C3E3',
};

function getMethodColor(name: string): string {
    const key = name.toLowerCase().replace(/\s/g, '');
    for (const [k, v] of Object.entries(METHOD_COLORS)) {
        if (key.includes(k)) return v;
    }
    return '#F5A623';
}

// Build embed card untuk satu seller
export function buildPaymentCard(
    sellerTag: string,
    sellerAvatarUrl: string | null,
    sellerId: string,
    methods: PaymentMethod[]
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle(`💳  Payment Methods`)
        .setDescription(`<@${sellerId}>`)
        .setColor(getMethodColor(methods[0]?.name ?? '') as any)
        .setFooter({ text: 'Maheswara Agency • Konfirmasi ke seller setelah transfer' })
        .setTimestamp();

    if (sellerAvatarUrl) embed.setThumbnail(sellerAvatarUrl);

    for (const m of methods) {
        embed.addFields({
            name:   `${m.emoji}  ${m.name}`,
            value:  `**No :** \`${m.account_number}\`\n**a/n:** ${m.account_name}`,
            inline: true,
        });
    }

    return embed;
}

// Refresh atau buat card seller di channel pembayaran
async function upsertPaymentCard(guild: Guild, sellerId: string): Promise<void> {
    const chan = guild.channels.cache.find(
        c => c.isTextBased() && c.name === PAYMENT_CHANNEL_NAME
    ) as TextChannel | undefined;
    if (!chan) return;

    const { rows } = await pool.query<{ methods: PaymentMethod[]; message_id: string | null }>(
        'SELECT methods, message_id FROM payment_methods WHERE seller_id = $1',
        [sellerId]
    );
    if (!rows.length) return;

    const { methods, message_id } = rows[0];
    const member = await guild.members.fetch(sellerId).catch(() => null);
    if (!member) return;

    // Kalau methods kosong, hapus card
    if (methods.length === 0) {
        if (message_id) {
            await chan.messages.delete(message_id).catch(() => {});
            await pool.query(
                'UPDATE payment_methods SET message_id = NULL WHERE seller_id = $1',
                [sellerId]
            );
        }
        return;
    }

    const embed = buildPaymentCard(
        member.user.tag,
        member.user.displayAvatarURL(),
        sellerId,
        methods
    );

    if (message_id) {
        const existing = await chan.messages.fetch(message_id).catch(() => null);
        if (existing) {
            await existing.edit({ embeds: [embed] });
            return;
        }
    }

    // Buat pesan baru
    const msg = await chan.send({ embeds: [embed] });
    await pool.query(
        'UPDATE payment_methods SET message_id = $1 WHERE seller_id = $2',
        [msg.id, sellerId]
    );
}

// Cek apakah user punya role Seller/Admin/Owner
function isSeller(member: GuildMember): boolean {
    return member.roles.cache.some(r =>
        [ROLE_NAMES.SELLER, ROLE_NAMES.ADMIN, ROLE_NAMES.OWNER].includes(r.name as any)
    );
}

// ── Handler utama /payment ────────────────────────────────────────────────────
export async function handlePaymentCommand(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (interaction.commandName !== 'payment') return;

    const member = interaction.member as GuildMember;

    if (!isSeller(member)) {
        await interaction.reply({
            content: '❌ Hanya **Seller** yang bisa setup payment method. Minta role Seller dulu ke Admin.',
            ephemeral: true,
        });
        return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
        const modal = new ModalBuilder()
            .setCustomId('payment_add_modal')
            .setTitle('Tambah Payment Method')
            .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId('pay_name')
                        .setLabel('Nama Metode (GoPay, BCA, DANA, dll)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(50)
                        .setPlaceholder('contoh: GoPay')
                ),
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId('pay_number')
                        .setLabel('Nomor Rekening / No HP')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(50)
                        .setPlaceholder('contoh: 081234567890')
                ),
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId('pay_account_name')
                        .setLabel('Nama Pemilik Akun')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(100)
                        .setPlaceholder('contoh: Budi Santoso')
                ),
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId('pay_emoji')
                        .setLabel('Emoji (opsional)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setMaxLength(8)
                        .setPlaceholder('default: 💳')
                ),
            );
        await interaction.showModal(modal);
        return;
    }

    if (sub === 'remove') {
        const methodName = interaction.options.getString('nama', true);

        const { rows } = await pool.query<{ methods: PaymentMethod[] }>(
            'SELECT methods FROM payment_methods WHERE seller_id = $1',
            [interaction.user.id]
        );
        const existing: PaymentMethod[] = rows[0]?.methods ?? [];

        const updated = existing.filter(m => m.name.toLowerCase() !== methodName.toLowerCase());
        if (updated.length === existing.length) {
            await interaction.reply({ content: `❌ Method \`${methodName}\` tidak ditemukan.`, ephemeral: true });
            return;
        }

        await pool.query(
            'UPDATE payment_methods SET methods = $1 WHERE seller_id = $2',
            [JSON.stringify(updated), interaction.user.id]
        );

        await interaction.deferReply({ ephemeral: true });
        await upsertPaymentCard(interaction.guild, interaction.user.id);
        await interaction.editReply(`✅ Payment method **${methodName}** berhasil dihapus dari card.`);
        return;
    }

    if (sub === 'list') {
        const { rows } = await pool.query<{ methods: PaymentMethod[] }>(
            'SELECT methods FROM payment_methods WHERE seller_id = $1',
            [interaction.user.id]
        );
        const methods: PaymentMethod[] = rows[0]?.methods ?? [];

        if (methods.length === 0) {
            await interaction.reply({ content: '📭 Kamu belum setup payment method apapun.', ephemeral: true });
            return;
        }

        const list = methods
            .map((m, i) => `${i + 1}. ${m.emoji} **${m.name}** — \`${m.account_number}\` (${m.account_name})`)
            .join('\n');
        await interaction.reply({ content: `**💳 Payment Methods Kamu:**\n\n${list}`, ephemeral: true });
        return;
    }

    if (sub === 'refresh') {
        await interaction.deferReply({ ephemeral: true });
        await upsertPaymentCard(interaction.guild, interaction.user.id);
        await interaction.editReply('♻️ Payment card kamu sudah diperbarui di channel!');
        return;
    }
}

// ── Modal submit handler ──────────────────────────────────────────────────────
export async function handlePaymentModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (interaction.customId !== 'payment_add_modal') return;
    if (!interaction.guild) return;

    const name        = interaction.fields.getTextInputValue('pay_name').trim();
    const number      = interaction.fields.getTextInputValue('pay_number').trim();
    const accountName = interaction.fields.getTextInputValue('pay_account_name').trim();
    const emojiRaw    = interaction.fields.getTextInputValue('pay_emoji').trim();
    const emoji       = emojiRaw || '💳';

    const newMethod: PaymentMethod = {
        name,
        account_number: number,
        account_name:   accountName,
        emoji,
    };

    // Ambil methods lama, replace duplikat nama, tambah yang baru
    const { rows } = await pool.query<{ methods: PaymentMethod[] }>(
        'SELECT methods FROM payment_methods WHERE seller_id = $1',
        [interaction.user.id]
    );
    const existing: PaymentMethod[] = rows[0]?.methods ?? [];
    const filtered = existing.filter(m => m.name.toLowerCase() !== name.toLowerCase());
    filtered.push(newMethod);

    await pool.query(
        `INSERT INTO payment_methods (seller_id, methods)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (seller_id) DO UPDATE SET methods = $2::jsonb`,
        [interaction.user.id, JSON.stringify(filtered)]
    );

    await interaction.deferReply({ ephemeral: true });
    await upsertPaymentCard(interaction.guild, interaction.user.id);
    await interaction.editReply(`✅ **${emoji} ${name}** berhasil ditambahkan ke payment card kamu!`);
}

// ── Autocomplete handler untuk /payment remove ────────────────────────────────
export async function handlePaymentAutocomplete(interaction: Interaction): Promise<void> {
    if (!interaction.isAutocomplete()) return;
    if (interaction.commandName !== 'payment') return;

    const { rows } = await pool.query<{ methods: PaymentMethod[] }>(
        'SELECT methods FROM payment_methods WHERE seller_id = $1',
        [interaction.user.id]
    );
    const methods: PaymentMethod[] = rows[0]?.methods ?? [];
    const focused = interaction.options.getFocused().toLowerCase();

    const choices = methods
        .filter(m => m.name.toLowerCase().includes(focused))
        .map(m => ({ name: `${m.emoji} ${m.name} — ${m.account_number}`, value: m.name }))
        .slice(0, 25);

    await interaction.respond(choices);
}

/**
 * Kirim payment card seller langsung ke channel tiket.
 * Dipanggil otomatis setelah harga ditetapkan / nego diterima.
 */
export async function postSellerPaymentToTicket(
    sellerId: string,
    channel: TextChannel,
    guild: Guild,
): Promise<void> {
    const { rows } = await pool.query<{ methods: PaymentMethod[] }>(
        'SELECT methods FROM payment_methods WHERE seller_id = $1',
        [sellerId]
    );
    const methods: PaymentMethod[] = rows[0]?.methods ?? [];

    if (methods.length === 0) {
        await channel.send({
            embeds: [new EmbedBuilder()
                .setTitle('⚠️ Info Rekening Belum Tersedia')
                .setDescription(
                    `Seller <@${sellerId}> belum setup metode pembayaran.\n` +
                    `Silakan hubungi seller langsung untuk info rekening/transfer.`
                )
                .setColor('#FF6600')
            ],
        });
        return;
    }

    const member = await guild.members.fetch(sellerId).catch(() => null);
    const embed  = buildPaymentCard(
        member?.user.tag ?? 'Seller',
        member?.user.displayAvatarURL() ?? null,
        sellerId,
        methods,
    );

    await channel.send({
        content: '💳 **Transfer ke salah satu rekening berikut:**',
        embeds:  [embed],
    });
}
