import {
    Interaction, ButtonInteraction, ModalSubmitInteraction,
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, TextChannel, Client,
    ColorResolvable,
} from 'discord.js';
import { pool } from '../lib/db';
import { OWNER_ID } from '../config';

const REVIEW_CHANNEL_NAME = '⭐-reviews';

// ── Helpers ───────────────────────────────────────────────────────────────────

function starsDisplay(rating: number): string {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
}

function reviewColor(rating: number): ColorResolvable {
    if (rating >= 4) return '#00FF88';
    if (rating === 3) return '#FFD700';
    return '#FF4444';
}

async function findReviewChannel(client: Client, guildId: string): Promise<TextChannel | null> {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return null;
    const chan = guild.channels.cache.find(
        c => c.name === REVIEW_CHANNEL_NAME && c.isTextBased()
    ) as TextChannel | undefined;
    return chan ?? null;
}

// ── Step 1: DM buyer minta review ────────────────────────────────────────────

export async function sendReviewPrompt(
    buyerId: string,
    serviceId: string,
    orderChannel: string,
    guildId: string,
    client: Client,
): Promise<void> {
    try {
        const user = await client.users.fetch(buyerId);
        const embed = new EmbedBuilder()
            .setTitle('⭐ Bagaimana Pengalaman Kamu?')
            .setDescription(
                `Order **${serviceId.toUpperCase()}** kamu sudah selesai!\n\n` +
                `Kasih rating untuk membantu calon buyer lain ya 🙏\n\n` +
                `Pilih bintang di bawah, lalu kamu bisa tambahkan komentar.`
            )
            .setColor('#FFD700');

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            [1, 2, 3, 4, 5].map(n =>
                new ButtonBuilder()
                    .setCustomId(`review:rate:${n}:${serviceId}:${orderChannel}:${guildId}`)
                    .setLabel('⭐'.repeat(n))
                    .setStyle(ButtonStyle.Secondary)
            )
        );

        await user.send({ embeds: [embed], components: [row] });
    } catch {
        // DM ditutup user, skip
    }
}

// ── Step 2: Klik bintang → tampilkan modal komentar ──────────────────────────

export async function handleReviewButton(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.customId.startsWith('review:rate:')) return;

    const parts = interaction.customId.split(':');
    // review:rate:<rating>:<serviceId>:<orderChannel>:<guildId>
    const rating      = parseInt(parts[2]);
    const serviceId   = parts[3];
    const orderChannel = parts[4];
    const guildId     = parts[5];

    if (isNaN(rating) || rating < 1 || rating > 5) return;

    // Cek sudah review belum
    const { rows: existing } = await pool.query(
        `SELECT 1 FROM reviews WHERE order_channel = $1 AND reviewer_id = $2`,
        [orderChannel, interaction.user.id]
    );
    if (existing.length > 0) {
        await interaction.reply({ content: '❌ Kamu sudah memberikan review untuk order ini.', ephemeral: true });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId(`review:submit:${rating}:${serviceId}:${orderChannel}:${guildId}`)
        .setTitle(`Review ${starsDisplay(rating)} (${rating}/5)`);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('comment')
                .setLabel('Komentar / Feedback (opsional)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Ceritakan pengalaman order kamu... (boleh dikosongkan)')
                .setRequired(false)
                .setMaxLength(500)
        )
    );

    await interaction.showModal(modal);
}

// ── Step 3: Submit modal → simpan ke DB + post ke channel ────────────────────

export async function handleReviewModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.customId.startsWith('review:submit:')) return;

    await interaction.deferReply({ ephemeral: true });

    const parts = interaction.customId.split(':');
    const rating       = parseInt(parts[2]);
    const serviceId    = parts[3];
    const orderChannel = parts[4];
    const guildId      = parts[5];
    const comment      = interaction.fields.getTextInputValue('comment').trim();

    // Cek double review
    const { rows: existing } = await pool.query(
        `SELECT 1 FROM reviews WHERE order_channel = $1 AND reviewer_id = $2`,
        [orderChannel, interaction.user.id]
    );
    if (existing.length > 0) {
        await interaction.editReply({ content: '❌ Kamu sudah memberikan review untuk order ini.' });
        return;
    }

    // Simpan ke DB
    await pool.query(
        `INSERT INTO reviews(order_channel, reviewer_id, service_id, rating, comment)
         VALUES($1,$2,$3,$4,$5)`,
        [orderChannel, interaction.user.id, serviceId, rating, comment]
    );

    // Konfirmasi ke user
    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('✅ Review Tersimpan!')
            .setDescription(`Rating **${starsDisplay(rating)}** (${rating}/5) sudah dicatat.\nMakasih ya udah kasih feedback! 🙏`)
            .setColor(reviewColor(rating))
        ],
    });

    // Post ke channel ⭐-reviews
    const reviewChan = await findReviewChannel(interaction.client, guildId);
    if (!reviewChan) return;

    const reviewEmbed = new EmbedBuilder()
        .setTitle(`${starsDisplay(rating)}  Review Baru`)
        .setColor(reviewColor(rating))
        .addFields(
            { name: 'Layanan',   value: serviceId.toUpperCase(), inline: true },
            { name: 'Rating',    value: `${rating}/5`,           inline: true },
            { name: 'Reviewer',  value: `<@${interaction.user.id}>`, inline: true },
        )
        .setTimestamp();

    if (comment) {
        reviewEmbed.addFields({ name: '💬 Komentar', value: comment });
    }

    // Bintang 1-3 → tambahkan button lapor owner
    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (rating <= 3) {
        reviewEmbed.setFooter({ text: '⚠️ Rating rendah — Owner bisa klik tombol di bawah untuk tindak lanjut' });
        components.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`review:report:${orderChannel}:${interaction.user.id}`)
                    .setLabel('🚨 Laporkan ke Owner')
                    .setStyle(ButtonStyle.Danger),
            )
        );
    }

    await reviewChan.send({ embeds: [reviewEmbed], components });
}

// ── Step 4: Button lapor owner (diklik staff di channel reviews) ──────────────

export async function handleReviewReport(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.customId.startsWith('review:report:')) return;

    const parts       = interaction.customId.split(':');
    const orderChannel = parts[2];
    const reviewerId  = parts[3];

    // Disable tombol supaya tidak bisa diklik dua kali
    await interaction.update({
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('review:reported')
                    .setLabel('✅ Sudah Dilaporkan')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            )
        ]
    });

    // DM ke owner
    try {
        const owner = await interaction.client.users.fetch(OWNER_ID);
        const embed = new EmbedBuilder()
            .setTitle('🚨 Laporan Review Buruk')
            .setColor('#FF0000')
            .setDescription(
                `Ada review buruk yang perlu ditindaklanjuti.\n\n` +
                `**Reviewer:** <@${reviewerId}>\n` +
                `**Order Channel:** \`${orderChannel}\`\n` +
                `**Dilaporkan oleh:** <@${interaction.user.id}>\n\n` +
                `Silakan cek channel **${REVIEW_CHANNEL_NAME}** untuk detail lengkap.`
            )
            .setTimestamp();
        await owner.send({ embeds: [embed] });
    } catch {
        // Owner DM tertutup
    }
}

// ── /reviews command ──────────────────────────────────────────────────────────

export async function handleReviewsCommand(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const { rows } = await pool.query(`
        SELECT service_id,
               ROUND(AVG(rating), 1) AS avg_rating,
               COUNT(*) AS total
        FROM reviews
        GROUP BY service_id
        ORDER BY avg_rating DESC
    `);

    if (rows.length === 0) {
        await interaction.reply({ content: '📭 Belum ada review masuk.', ephemeral: true });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('⭐ Rating Jasa')
        .setColor('#FFD700')
        .setDescription(
            rows.map(r => {
                const stars = starsDisplay(Math.round(Number(r.avg_rating)));
                return `**${r.service_id.toUpperCase()}** — ${stars} **${r.avg_rating}**/5 (${r.total} review)`;
            }).join('\n')
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}
