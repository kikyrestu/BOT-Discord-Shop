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

function hasSeller(member: GuildMember): boolean {
    return member.id === OWNER_ID ||
        member.roles.cache.some(r =>
            [ROLE_NAMES.OWNER, ROLE_NAMES.ADMIN, ROLE_NAMES.SELLER].includes(r.name as any)
        );
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

// ── Seller Dashboard ──────────────────────────────────────────────────────────
export async function handleSellerDashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;

    const member = interaction.member as GuildMember;
    if (!hasSeller(member)) {
        await interaction.reply({ content: '❌ Hanya Seller, Admin, atau Owner yang bisa akses seller dashboard.', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    const [activeStats, serviceStats, reviewStats, paymentRow] = await Promise.all([
        pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE status IN ('open','in_progress','revision')) AS total_active,
                COUNT(*) FILTER (WHERE status = 'open')        AS open,
                COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
                COUNT(*) FILTER (WHERE status = 'revision')    AS revision,
                COUNT(*) FILTER (WHERE status = 'done'
                    AND updated_at >= NOW() - INTERVAL '7 days')    AS done_week
            FROM orders
        `),
        pool.query(`
            SELECT
                service_id,
                COUNT(*)                                                           AS total_orders,
                COUNT(*) FILTER (WHERE status = 'done')                          AS completed,
                COUNT(*) FILTER (WHERE status IN ('open','in_progress','revision')) AS active
            FROM orders
            GROUP BY service_id
            ORDER BY total_orders DESC
            LIMIT 10
        `),
        pool.query(`
            SELECT service_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS total_reviews
            FROM reviews
            GROUP BY service_id
        `),
        pool.query(`SELECT methods FROM payment_methods WHERE seller_id = $1`, [interaction.user.id]),
    ]);

    const ao = activeStats.rows[0];
    const ratingMap = new Map(reviewStats.rows.map((r: any) => [r.service_id, r]));

    const serviceText = serviceStats.rows.length > 0
        ? serviceStats.rows.map((r: any) => {
            const rv = ratingMap.get(r.service_id) as any;
            const star = rv ? `⭐ ${rv.avg_rating} (${rv.total_reviews} ulasan)` : '–';
            return `**${r.service_id.toUpperCase()}** · ${r.total_orders} order · ✅ ${r.completed} selesai · 🔄 ${r.active} aktif · ${star}`;
          }).join('\n')
        : 'Belum ada order masuk';

    const myMethods: any[] = paymentRow.rows[0]?.methods ?? [];
    const paymentText = myMethods.length > 0
        ? myMethods.map((m: any) =>
            `${m.emoji ?? '💳'} **${m.name}** — ${m.account_name}  \`${m.account_number}\``
          ).join('\n')
        : '⚠️ Belum setup metode pembayaran — gunakan `/payment add`';

    const embed = new EmbedBuilder()
        .setTitle('🏪 Dashboard Seller')
        .setColor('#FFCC00')
        .setDescription(`Halo ${interaction.user}! Berikut rekap status toko kamu saat ini.`)
        .addFields(
            {
                name: '📦 Order Aktif',
                value:
                    `🟡 Menunggu: **${ao.open}**  ·  🔵 Diproses: **${ao.in_progress}**  ·  🟠 Revisi: **${ao.revision}**\n` +
                    `✅ Selesai 7 hari: **${ao.done_week}**  ·  Total aktif: **${ao.total_active}**`,
                inline: false,
            },
            {
                name: '📊 Statistik per Layanan',
                value: serviceText,
                inline: false,
            },
            {
                name: '💳 Metode Pembayaran Kamu',
                value: paymentText,
                inline: false,
            },
        )
        .setFooter({ text: 'Seller Dashboard • Data real-time' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}
