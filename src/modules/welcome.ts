import { GuildMember, EmbedBuilder, TextChannel } from 'discord.js';

export const WELCOME_CHANNEL_NAME = '👋-welcome';

export async function handleMemberJoin(member: GuildMember): Promise<void> {
    const guild = member.guild;

    const chan = guild.channels.cache.find(
        c => c.name === WELCOME_CHANNEL_NAME && c.isTextBased()
    ) as TextChannel | undefined;

    if (!chan) return;

    const avatarUrl  = member.user.displayAvatarURL({ size: 256 });
    const memberNum  = guild.memberCount;
    const joinedTs   = Math.floor(Date.now() / 1000);
    const accountTs  = Math.floor(member.user.createdTimestamp / 1000);

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`👋 Selamat Datang di ${guild.name}!`)
        .setDescription(
            `Halo ${member}! Seneng banget kamu gabung 🎉\n\n` +
            `📜 Baca aturan di <#${guild.channels.cache.find(c => c.name === '📜-rules')?.id ?? ''}> dulu ya.\n` +
            `🛒 Jelajahi layanan kami di kategori **🛒 MARKETPLACE**.\n` +
            `❓ Ada pertanyaan? Chat di 💬-general.`
        )
        .setThumbnail(avatarUrl)
        .setImage(avatarUrl)
        .addFields(
            { name: '👤 Username',        value: `\`${member.user.tag}\``,           inline: true },
            { name: '🆔 ID',              value: `\`${member.user.id}\``,            inline: true },
            { name: '🔢 Member Ke-',      value: `**#${memberNum}**`,               inline: true },
            { name: '📅 Akun Dibuat',     value: `<t:${accountTs}:D>`,              inline: true },
            { name: '🕐 Bergabung',       value: `<t:${joinedTs}:R>`,               inline: true },
        )
        .setFooter({ text: `${guild.name} • Selamat bergabung!` })
        .setTimestamp();

    await chan.send({ content: `${member}`, embeds: [embed] });
}
