import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    GuildMember,
} from 'discord.js';
import { pool } from '../lib/db';
import { ROLE_NAMES, OWNER_ID } from '../config';

function isOwnerOrAdmin(member: GuildMember): boolean {
    return member.id === OWNER_ID ||
        member.roles.cache.some(r => [ROLE_NAMES.OWNER, ROLE_NAMES.ADMIN].includes(r.name as any));
}

export async function handleDashboardCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;

    const member = interaction.member as GuildMember;
    if (!isOwnerOrAdmin(member)) {
        await interaction.reply({ content: '❌ Hanya Owner/Admin yang bisa melihat dashboard.', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    // Ambil semua statistik paralel
    const [orderStats, loyaltyStats, reviewStats, blacklistCount, recentOrders] = await Promise.all([
        pool.query(`
            SELECT
                COUNT(*)                                          AS total,
                COUNT(*) FILTER (WHERE status = 'open')          AS open,
                COUNT(*) FILTER (WHERE status = 'in_progress')   AS in_progress,
                COUNT(*) FILTER (WHERE status = 'revision')      AS revision,
                COUNT(*) FILTER (WHERE status = 'done')          AS done,
                COUNT(*) FILTER (WHERE status = 'cancelled')     AS cancelled
            FROM orders
        `),
        pool.query(`
            SELECT
                COUNT(*)          AS total_customers,
                SUM(order_count)  AS total_orders,
                SUM(points)       AS total_points
            FROM customer_loyalty
        `),
        pool.query(`
            SELECT
                service_id,
                ROUND(AVG(rating), 1) AS avg_rating,
                COUNT(*)              AS total_reviews
            FROM reviews
            GROUP BY service_id
            ORDER BY avg_rating DESC
            LIMIT 5
        `),
        pool.query(`SELECT COUNT(*) AS total FROM blacklist`),
        pool.query(`
            SELECT invoice_no, service_id, status, created_at
            FROM orders
            ORDER BY created_at DESC
            LIMIT 5
        `),
    ]);

    const o  = orderStats.rows[0];
    const l  = loyaltyStats.rows[0];
    const bl = blacklistCount.rows[0];

    const statusBar =
        `🟡 Open: **${o.open}**  ·  🔵 Progress: **${o.in_progress}**  ·  🟠 Revisi: **${o.revision}**\n` +
        `🟢 Done: **${o.done}**  ·  🔴 Cancelled: **${o.cancelled}**`;

    const reviewText = reviewStats.rows.length > 0
        ? reviewStats.rows.map((r: any) =>
            `${r.service_id.toUpperCase()} — ⭐ ${r.avg_rating} (${r.total_reviews} review)`
          ).join('\n')
        : 'Belum ada review';

    const recentText = recentOrders.rows.length > 0
        ? recentOrders.rows.map((r: any) =>
            `\`${r.invoice_no}\` · ${r.service_id.toUpperCase()} · ${r.status} · <t:${Math.floor(new Date(r.created_at).getTime() / 1000)}:R>`
          ).join('\n')
        : 'Belum ada order';

    const embed = new EmbedBuilder()
        .setTitle('📊 Dashboard Maheswara Agency')
        .setColor('#5865F2')
        .addFields(
            {
                name:  '📦 Statistik Order',
                value: `Total: **${o.total}** order\n${statusBar}`,
                inline: false,
            },
            {
                name:  '👥 Statistik Customer',
                value: `Total Customer: **${l.total_customers ?? 0}**\nTotal Order: **${l.total_orders ?? 0}**\nTotal Poin Beredar: **${l.total_points ?? 0} pts**`,
                inline: true,
            },
            {
                name:  '🚫 Blacklist',
                value: `**${bl.total}** user terblacklist`,
                inline: true,
            },
            {
                name:  '⭐ Top Rated Services',
                value: reviewText,
                inline: false,
            },
            {
                name:  '🕐 5 Order Terbaru',
                value: recentText,
                inline: false,
            },
        )
        .setFooter({ text: `${interaction.guild.name} • Data real-time` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}
