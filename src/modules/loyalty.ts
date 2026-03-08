import { GuildMember } from 'discord.js';
import { ROLE_NAMES } from '../config';
import { pool } from '../lib/db';
import { getBotConfig } from '../lib/botConfig';

function generateVoucherCode(userId: string, orderNum: number): string {
    const suffix = Date.now().toString(36).toUpperCase();
    return `LOYAL-${userId.slice(-4).toUpperCase()}-${orderNum}X-${suffix}`;
}

export async function getCustomerInfo(userId: string) {
    const { rows } = await pool.query(
        `INSERT INTO customer_loyalty(user_id, order_count, points, vouchers)
         VALUES($1, 0, 0, '[]'::jsonb)
         ON CONFLICT(user_id) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING *`,
        [userId]
    );
    return rows[0];
}

export async function recordOrder(member: GuildMember): Promise<{
    orderCount:     number;
    points:         number;
    loyaltyReached: boolean;
    voucher?:       string;
}> {
    // Atomic increment order_count & points
    const { rows } = await pool.query(
        `INSERT INTO customer_loyalty(user_id, order_count, points, vouchers)
         VALUES($1, 1, 10, '[]'::jsonb)
         ON CONFLICT(user_id) DO UPDATE
         SET order_count = customer_loyalty.order_count + 1,
             points      = customer_loyalty.points + $2
         RETURNING *`,
        [member.id, (await getBotConfig()).loyalty_points]
    );
    const data = rows[0];

    // Auto-assign role Customer di order pertama
    const customerRole = member.guild.roles.cache.find(r => r.name === ROLE_NAMES.CUSTOMER);
    if (customerRole && !member.roles.cache.has(customerRole.id)) {
        await member.roles.add(customerRole).catch(() => {});
    }

    let voucher: string | undefined;
    let loyaltyReached = false;

    const cfg = await getBotConfig();
    if (data.order_count % cfg.loyalty_threshold === 0) {
        loyaltyReached = true;
        voucher = generateVoucherCode(member.id, data.order_count);

        await pool.query(
            `UPDATE customer_loyalty SET vouchers = vouchers || $1::jsonb WHERE user_id = $2`,
            [JSON.stringify([voucher]), member.id]
        );

        const loyalRole = member.guild.roles.cache.find(r => r.name === ROLE_NAMES.LOYAL);
        if (loyalRole && !member.roles.cache.has(loyalRole.id)) {
            await member.roles.add(loyalRole).catch(() => {});
        }
    }

    return { orderCount: data.order_count, points: data.points, loyaltyReached, voucher };
}

export async function redeemVoucher(userId: string, code: string): Promise<'ok' | 'not_found' | 'already_used'> {
    const { rows } = await pool.query(
        `SELECT vouchers FROM customer_loyalty WHERE user_id = $1`, [userId]
    );
    if (!rows[0]) return 'not_found';

    const vouchers: string[] = rows[0].vouchers;
    if (!vouchers.includes(code)) return 'not_found';

    // Hapus voucher setelah dipakai (mark as used)
    const updated = vouchers.filter(v => v !== code);
    await pool.query(
        `UPDATE customer_loyalty SET vouchers = $1::jsonb WHERE user_id = $2`,
        [JSON.stringify(updated), userId]
    );
    return 'ok';
}
