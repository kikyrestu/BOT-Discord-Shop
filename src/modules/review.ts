import {
    Interaction, ButtonInteraction, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel
} from 'discord.js';
import { pool } from '../lib/db';

// Dipanggil dari ticket.ts setelah close — DM buyer minta review
export async function sendReviewPrompt(
    buyerId: string,
    serviceId: string,
    orderChannel: string,
    client: { users: { fetch: (id: string) => Promise<any> } }
): Promise<void> {
    try {
        const user = await client.users.fetch(buyerId);

        const embed = new EmbedBuilder()
            .setTitle('⭐ Bagaimana Pengalaman Kamu?')
            .setDescription(
                `Order **${serviceId.toUpperCase()}** kamu sudah selesai!\n\n` +
                `Kasih rating untuk membantu calon buyer lain ya 🙏`
            )
            .setColor('#FFD700');

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            [1, 2, 3, 4, 5].map(n =>
                new ButtonBuilder()
                    .setCustomId(`review_${n}_${serviceId}_${orderChannel}`)
                    .setLabel('⭐'.repeat(n))
                    .setStyle(ButtonStyle.Secondary)
            )
        );

        await user.send({ embeds: [embed], components: [row] });
    } catch {
        // DM mungkin ditutup user, skip saja
    }
}

// Dipanggil saat user klik rating di DM
export async function handleReviewButton(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.customId.startsWith('review_')) return;

    const [, ratingStr, serviceId, orderChannel] = interaction.customId.split('_');
    const rating = parseInt(ratingStr);

    if (isNaN(rating) || rating < 1 || rating > 5) return;

    // Cek apakah user sudah pernah review order ini
    const { rows: existing } = await pool.query(
        `SELECT 1 FROM reviews WHERE order_channel = $1 AND reviewer_id = $2`,
        [orderChannel, interaction.user.id]
    );
    if (existing.length > 0) {
        await interaction.reply({ content: '❌ Kamu sudah memberikan review untuk order ini.', ephemeral: true });
        return;
    }

    await pool.query(
        `INSERT INTO reviews(order_channel, reviewer_id, service_id, rating)
         VALUES($1,$2,$3,$4)`,
        [orderChannel, interaction.user.id, serviceId, rating]
    );

    const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
    const embed = new EmbedBuilder()
        .setTitle('✅ Review Tersimpan!')
        .setDescription(`Rating **${stars}** (${rating}/5) untuk order **${serviceId.toUpperCase()}** sudah dicatat.\n\nMakasih udah kasih feedback ya! 🙏`)
        .setColor('#00FF88');

    await interaction.update({ embeds: [embed], components: [] });
}

// /reviews — lihat rating rata-rata semua jasa
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
        .setTitle('⭐ Rating Jasa Maheswara Agency')
        .setColor('#FFD700')
        .setDescription(
            rows.map(r => {
                const stars = '⭐'.repeat(Math.round(Number(r.avg_rating)));
                return `**${r.service_id.toUpperCase()}** — ${stars} **${r.avg_rating}**/5 (${r.total} review)`;
            }).join('\n')
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}
