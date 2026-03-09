import { GuildMember, EmbedBuilder, TextChannel, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import * as path from 'path';

export const WELCOME_CHANNEL_NAME = '👋-welcome';

// Register custom font jika ada (opsional, fallback ke system font)
try {
    GlobalFonts.registerFromPath(
        path.join(__dirname, '../../assets/fonts/Poppins-Bold.ttf'),
        'Poppins'
    );
} catch { /* skip kalau font file tidak ada */ }

const FONT_BOLD   = 'bold 44px Poppins, Arial';
const FONT_MEDIUM = 'bold 26px Poppins, Arial';
const FONT_SMALL  = '22px Poppins, Arial';

async function buildWelcomeBanner(member: GuildMember): Promise<Buffer> {
    // ── Canvas setup ──────────────────────────────────────────────────────────
    const W = 900, H = 300;
    const canvas  = createCanvas(W, H);
    const ctx     = canvas.getContext('2d');

    // ── Background: dark gradient ─────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0,   '#0d0d1a');
    bg.addColorStop(0.5, '#0f1535');
    bg.addColorStop(1,   '#0d0d1a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Decorative glowing circles (background accent) ────────────────────────
    function drawGlow(x: number, y: number, r: number, color: string) {
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, color);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    drawGlow(80,  H / 2, 120, 'rgba(88, 101, 242, 0.25)');  // blurple left
    drawGlow(W - 80, H / 2, 100, 'rgba(0, 255, 180, 0.12)'); // teal right
    drawGlow(W / 2, 0, 80, 'rgba(255, 215, 0, 0.08)');       // gold top

    // ── Outer rounded border ──────────────────────────────────────────────────
    const brd = ctx.createLinearGradient(0, 0, W, H);
    brd.addColorStop(0,   '#5865F2');
    brd.addColorStop(0.5, '#00FFB4');
    brd.addColorStop(1,   '#FFD700');
    ctx.strokeStyle = brd;
    ctx.lineWidth   = 3;
    roundRect(ctx, 2, 2, W - 4, H - 4, 20);
    ctx.stroke();

    // ── Divider line (vertical) ───────────────────────────────────────────────
    const divX = 260;
    const divGrd = ctx.createLinearGradient(divX, 30, divX, H - 30);
    divGrd.addColorStop(0,   'rgba(88,101,242,0)');
    divGrd.addColorStop(0.5, 'rgba(88,101,242,0.6)');
    divGrd.addColorStop(1,   'rgba(88,101,242,0)');
    ctx.strokeStyle = divGrd;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(divX, 30);
    ctx.lineTo(divX, H - 30);
    ctx.stroke();

    // ── Avatar ────────────────────────────────────────────────────────────────
    const avatarSize = 130;
    const avatarX    = 130; // center of avatar area
    const avatarY    = H / 2;
    const avatarUrl  = member.user.displayAvatarURL({ extension: 'png', size: 256 });

    // Glow ring behind avatar
    const avGlow = ctx.createRadialGradient(avatarX, avatarY, avatarSize / 2 - 5, avatarX, avatarY, avatarSize / 2 + 20);
    avGlow.addColorStop(0,   'rgba(88, 101, 242, 0.7)');
    avGlow.addColorStop(1,   'rgba(88, 101, 242, 0)');
    ctx.fillStyle = avGlow;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2 + 20, 0, Math.PI * 2);
    ctx.fill();

    // Gradient ring
    const ringGrd = ctx.createLinearGradient(
        avatarX - avatarSize / 2, avatarY,
        avatarX + avatarSize / 2, avatarY
    );
    ringGrd.addColorStop(0,   '#5865F2');
    ringGrd.addColorStop(0.5, '#00FFB4');
    ringGrd.addColorStop(1,   '#FFD700');
    ctx.strokeStyle = ringGrd;
    ctx.lineWidth   = 5;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2 + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Clip & draw avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    try {
        const avatar = await loadImage(avatarUrl);
        ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
    } catch {
        ctx.fillStyle = '#2c2f33';
        ctx.fill();
    }
    ctx.restore();

    // ── Right panel: text ─────────────────────────────────────────────────────
    const textX = divX + 30;
    const cy    = H / 2;

    // "SELAMAT DATANG" label (small, accent color)
    ctx.font      = FONT_SMALL;
    ctx.fillStyle = '#00FFB4';
    ctx.fillText('✦  SELAMAT DATANG  ✦', textX, cy - 70);

    // Username (big, white with glow)
    ctx.save();
    ctx.font        = FONT_BOLD;
    ctx.shadowColor = '#5865F2';
    ctx.shadowBlur  = 18;
    ctx.fillStyle   = '#FFFFFF';
    const displayName = member.user.username.length > 18
        ? member.user.username.slice(0, 18) + '…'
        : member.user.username;
    ctx.fillText(displayName, textX, cy - 22);
    ctx.restore();

    // Guild name
    ctx.font      = FONT_MEDIUM;
    ctx.fillStyle = '#B0B8FF';
    const guildName = member.guild.name.length > 24
        ? member.guild.name.slice(0, 24) + '…'
        : member.guild.name;
    ctx.fillText(`di ${guildName}`, textX, cy + 20);

    // Member count badge
    const memberNum = member.guild.memberCount;
    const badgeX    = textX;
    const badgeY    = cy + 48;
    const badgeW    = 200;
    const badgeH    = 34;

    const badgeBg = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY);
    badgeBg.addColorStop(0, 'rgba(88, 101, 242, 0.4)');
    badgeBg.addColorStop(1, 'rgba(0, 255, 180, 0.15)');
    ctx.fillStyle   = badgeBg;
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);
    ctx.fill();

    ctx.strokeStyle = 'rgba(88, 101, 242, 0.6)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    ctx.font      = FONT_SMALL;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`👥  Member ke-${memberNum}`, badgeX + 12, badgeY + 22);

    return canvas.toBuffer('image/png');
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

export async function handleMemberJoin(member: GuildMember): Promise<void> {
    const guild = member.guild;

    const chan = guild.channels.cache.find(
        c => c.name === WELCOME_CHANNEL_NAME && c.isTextBased()
    ) as TextChannel | undefined;

    if (!chan) return;

    const joinedTs  = Math.floor(Date.now() / 1000);
    const accountTs = Math.floor(member.user.createdTimestamp / 1000);
    const rulesId   = guild.channels.cache.find(c => c.name === '📜-rules')?.id;

    // Generate banner image
    let attachment: AttachmentBuilder | null = null;
    try {
        const buffer = await buildWelcomeBanner(member);
        attachment   = new AttachmentBuilder(buffer, { name: 'welcome.png' });
    } catch (err) {
        console.error('Welcome banner generation failed:', err);
    }

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setDescription(
            `${member} baru aja gabung! 🎉\n\n` +
            (rulesId ? `📜 Baca <#${rulesId}> dulu ya bro.\n` : '') +
            `🛒 Jelajahi **🛒 MARKETPLACE** untuk lihat layanan kami.\n` +
            `❓ Ada pertanyaan? Drop di 💬-general.`
        )
        .addFields(
            { name: '📅 Akun Dibuat', value: `<t:${accountTs}:D>`,         inline: true },
            { name: '🕐 Join',        value: `<t:${joinedTs}:R>`,          inline: true },
            { name: '🔢 Member',      value: `#${guild.memberCount}`,       inline: true },
        )
        .setFooter({ text: `${guild.name} • Selamat bergabung!` })
        .setTimestamp();

    if (attachment) {
        embed.setImage('attachment://welcome.png');
        await chan.send({ content: `${member}`, embeds: [embed], files: [attachment] });
    } else {
        embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
        await chan.send({ content: `${member}`, embeds: [embed] });
    }
}
