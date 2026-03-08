import { Client, EmbedBuilder } from 'discord.js';
import { pool } from '../lib/db';
import { getService } from '../lib/serviceStore';
import { getBotConfig } from '../lib/botConfig';

export interface InvoiceData {
    orderId:     string;
    buyerId:     string;
    serviceId:   string;
    channelName: string;
    guild:       { name: string; iconURL: () => string | null };
}

// Buat nomor invoice unik: INV-YYYYMMDD-XXXXX
function generateInvoiceNumber(): string {
    const date = new Date();
    const ymd  = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(10000 + Math.random() * 90000);
    return `INV-${ymd}-${rand}`;
}

export async function sendInvoiceDM(client: Client, data: InvoiceData): Promise<void> {
    try {
        const service = await getService(data.serviceId);
        const invoiceNo = generateInvoiceNumber();

        // Simpan ke tabel orders
        await pool.query(
            `INSERT INTO orders (id, invoice_no, buyer_id, service_id, channel_name, status, created_at)
             VALUES ($1, $2, $3, $4, $5, 'open', NOW())
             ON CONFLICT (id) DO NOTHING`,
            [data.orderId, invoiceNo, data.buyerId, data.serviceId, data.channelName]
        );

        const now       = new Date();
        const timestamp = Math.floor(now.getTime() / 1000);
        const dateStr   = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        const timeStr   = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
        const serviceName = service ? `${service.emoji} ${service.title}` : data.serviceId.toUpperCase();

        const embed = new EmbedBuilder()
            .setColor('#2B2D31')
            .setAuthor({
                name: data.guild.name,
                iconURL: data.guild.iconURL() ?? undefined,
            })
            .setTitle('🧾  INVOICE / BUKTI ORDER')
            .setDescription(
                '```\n' +
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                `  No. Invoice : ${invoiceNo}\n` +
                `  Tanggal     : ${dateStr}\n` +
                `  Waktu       : ${timeStr}\n` +
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                `  Jasa        : ${service?.title ?? data.serviceId.toUpperCase()}\n` +
                `  Harga Est.  : ${service?.price ?? '-'}\n` +
                `  Estimasi    : ${service?.eta   ?? '-'}\n` +
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                '  STATUS      : MENUNGGU KONFIRMASI\n' +
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                '```'
            )
            .addFields(
                {
                    name:  '📋 Langkah Selanjutnya',
                    value: '1️⃣ Cantumkan detail project di channel tiket\n2️⃣ Sepakati harga & deadline dengan seller\n3️⃣ Lakukan pembayaran ke metode yang ditunjuk\n4️⃣ Kirim bukti bayar di channel tiket',
                    inline: false,
                },
                {
                    name:  '🔔 Notifikasi',
                    value: `Kamu akan dapat DM otomatis saat status order berubah.`,
                    inline: false,
                },
            )
            .setFooter({
                text: `${data.guild.name} • Simpan invoice ini sebagai bukti order kamu`,
                iconURL: data.guild.iconURL() ?? undefined,
            })
            .setTimestamp();

        const buyer = await client.users.fetch(data.buyerId).catch(() => null);
        if (buyer) {
            await buyer.send({ embeds: [embed] }).catch(() => {
                console.warn(`⚠️ Gagal kirim invoice DM ke ${data.buyerId} (DM mungkin dimatikan)`);
            });
        }

        // Update buyer stat channel
        try {
            const guild = client.guilds.cache.find(g => g.members.cache.has(data.buyerId))
                       ?? client.guilds.cache.first();
            if (guild) {
                const { updateBuyerStat } = await import('./stats');
                await updateBuyerStat(guild);
            }
        } catch {}
    } catch (err) {
        console.error('sendInvoiceDM error:', err);
    }
}

// Kirim updated invoice (saat status berubah)
export async function sendStatusUpdateDM(
    client: Client,
    buyerId: string,
    invoiceNo: string,
    newStatus: string,
    note: string,
    guildName: string
): Promise<void> {
    const statusMap: Record<string, { label: string; bar: string; color: string }> = {
        open:        { label: 'MENUNGGU KONFIRMASI', bar: '🟡🟡🟡🟡🟡🟡🟡🟡🟡🟡', color: '#FFA500' },
        in_progress: { label: 'SEDANG DIKERJAKAN',   bar: '🔵🔵🔵🔵🔵🔵🔵⬛⬛⬛', color: '#5865F2' },
        revision:    { label: 'DALAM REVISI',         bar: '🟠🟠🟠🟠🟠🟠🟠🟠⬛⬛', color: '#FF8C00' },
        done:        { label: 'SELESAI ✓',            bar: '🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢', color: '#00FF88' },
        cancelled:   { label: 'DIBATALKAN ✗',         bar: '🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴', color: '#FF0000' },
    };

    const s    = statusMap[newStatus] ?? { label: newStatus.toUpperCase(), bar: '', color: '#FFA500' };
    const cfg  = await getBotConfig();
    const now  = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';

    const embed = new EmbedBuilder()
        .setColor(s.color as any)
        .setTitle('📬  UPDATE STATUS ORDER')
        .setDescription(
            '```\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            `  No. Invoice : ${invoiceNo}\n` +
            `  Update      : ${dateStr} ${timeStr}\n` +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            `  STATUS BARU : ${s.label}\n` +
            `  Progress    : ${s.bar}\n` +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            '```'
        )
        .setFooter({ text: `${cfg.agency_name} • Hubungi staff jika ada pertanyaan` })
        .setTimestamp();

    if (note) {
        embed.addFields({ name: '📝 Catatan dari Staff', value: note, inline: false });
    }

    if (newStatus === 'done') {
        embed.addFields({
            name:  '🎉 Order Selesai!',
            value: 'Terima kasih sudah mempercayakan project kamu. Jangan lupa tinggalkan review ya!',
            inline: false,
        });
    }

    const buyer = await client.users.fetch(buyerId).catch(() => null);
    if (buyer) {
        await buyer.send({ embeds: [embed] }).catch(() => {});
    }
}
