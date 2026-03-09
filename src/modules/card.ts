import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Guild,
    TextChannel,
} from 'discord.js';
import { Service } from '../config';
import { getBotConfig } from '../lib/botConfig';

export async function buildServiceCard(s: Service): Promise<{
    embed: EmbedBuilder;
    row: ActionRowBuilder<ButtonBuilder>;
}> {
    const cfg       = await getBotConfig();
    const stackText = s.stack.join(' • ');

    const embed = new EmbedBuilder()
        .setColor(s.color as any)
        .setTitle(`${s.emoji}  ${s.title.toUpperCase()}`)
        .setDescription(s.desc)
        .addFields({ name: '🛠️ Tech Stack / Tools', value: stackText, inline: false })
        .setFooter({ text: `${cfg.agency_name} • Klik tombol di bawah untuk order` })
        .setTimestamp();

    if (s.thumbnail) embed.setThumbnail(s.thumbnail);

    if (s.packages && s.packages.length > 0) {
        // Render per-paket sebagai kolom terpisah
        for (const pkg of s.packages.slice(0, 3)) {
            const featText = pkg.features.map(f => `› ${f}`).join('\n');
            const etaText  = pkg.eta ?? s.eta;
            embed.addFields({
                name:   `📦 ${pkg.name}`,
                value:  `${featText}\n\n💰 **Rp ${pkg.price.toLocaleString('id-ID')}**\n⏱️ ${etaText}`,
                inline: true,
            });
        }
    } else {
        // Fallback: tampilan lama tanpa paket
        const featuresText = s.features.map(f => `› ${f}`).join('\n');
        embed.addFields(
            { name: '✨ Yang Kamu Dapat',       value: featuresText, inline: false },
            { name: '💰 Harga',                 value: s.price,      inline: true  },
            { name: '⏱️ Estimasi Pengerjaan',   value: s.eta,        inline: true  },
        );
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`buy_${s.id}`)
            .setLabel('Order Sekarang')
            .setEmoji('🛒')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`info_${s.id}`)
            .setLabel('Tanya Dulu')
            .setEmoji('💬')
            .setStyle(ButtonStyle.Secondary),
    );

    return { embed, row };
}

// Cari message card bot di channel service, lalu edit in-place (atau kirim baru kalau belum ada)
export async function refreshCardInChannel(guild: Guild, service: Service): Promise<'updated' | 'created' | 'no_channel'> {
    const channel = guild.channels.cache.find(
        c => c.name === service.name && c.isTextBased()
    ) as TextChannel | undefined;

    if (!channel) return 'no_channel';

    const messages = await channel.messages.fetch({ limit: 10 });
    const botMsg   = messages.find(m => m.author.id === guild.client.user!.id);
    const { embed, row } = await buildServiceCard(service);

    if (botMsg) {
        await botMsg.edit({ embeds: [embed], components: [row] });
        return 'updated';
    }

    await channel.send({ embeds: [embed], components: [row] });
    return 'created';
}
