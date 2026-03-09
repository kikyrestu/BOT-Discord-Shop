import { GuildMember, EmbedBuilder, TextChannel, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import * as path from 'path';

export const WELCOME_CHANNEL_NAME = 'ðŸ‘‹-welcome';

try {
    GlobalFonts.registerFromPath(
        path.join(__dirname, '../../assets/fonts/Poppins-Bold.ttf'),
        'Poppins'
    );
} catch { /* fallback to system font */ }

const FONT_BOLD   = 'bold 46px Poppins, Arial';
const FONT_MEDIUM = 'bold 26px Poppins, Arial';
const FONT_SMALL  = '20px Poppins, Arial';
const FONT_TINY   = '15px Poppins, Arial';

// â”€â”€ Seeded pseudo-random (deterministic per member) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function seededRand(seed: number) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
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

async function buildWelcomeBanner(member: GuildMember): Promise<Buffer> {
    const W = 930, H = 310;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');
    const rand   = seededRand(parseInt(member.user.id.slice(-8), 10) || 42);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LAYER 1 â€” Base deep space gradient
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    const baseBg = ctx.createLinearGradient(0, 0, W, H);
    baseBg.addColorStop(0,    '#050510');
    baseBg.addColorStop(0.3,  '#080c22');
    baseBg.addColorStop(0.7,  '#0a0f2e');
    baseBg.addColorStop(1,    '#050510');
    ctx.fillStyle = baseBg;
    ctx.fillRect(0, 0, W, H);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LAYER 2 â€” Aurora blobs (large soft color clouds)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function aurora(x: number, y: number, rx: number, ry: number, color: string, alpha: number) {
        ctx.save();
        ctx.globalAlpha = alpha;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
        grd.addColorStop(0,   color);
        grd.addColorStop(0.5, color.replace(')', ', 0.3)').replace('rgb', 'rgba'));
        grd.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.save();
        ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
        ctx.beginPath();
        ctx.arc(
            x * Math.max(rx, ry) / rx,
            y * Math.max(rx, ry) / ry,
            Math.max(rx, ry), 0, Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
        ctx.restore();
    }
    // Left aurora â€” blurple
    aurora(100, H * 0.5, 220, 160, 'rgba(88,101,242,1)', 0.35);
    // Top-right aurora â€” cyan
    aurora(W * 0.75, 30, 200, 130, 'rgba(0,220,255,1)', 0.2);
    // Bottom-center aurora â€” purple
    aurora(W * 0.5, H + 20, 300, 120, 'rgba(150,0,255,1)', 0.18);
    // Right edge aurora â€” teal
    aurora(W - 60, H * 0.6, 180, 140, 'rgba(0,255,180,1)', 0.15);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LAYER 3 â€” Hexagon grid (right half, faint)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    {
        const hSize  = 28;   // hex radius
        const hW     = hSize * Math.sqrt(3);
        const hH     = hSize * 2;
        const startX = 270;

        ctx.save();
        ctx.globalAlpha = 0.09;
        ctx.strokeStyle = '#7289DA';
        ctx.lineWidth   = 1;

        for (let col = 0; col * hW < W - startX + hW; col++) {
            for (let row = -1; row * hH * 0.75 < H + hH; row++) {
                const offset = col % 2 === 0 ? 0 : hH * 0.375;
                const cx = startX + col * hW + hW / 2;
                const cy = row * hH * 0.75 + offset + hH / 2;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 180) * (60 * i - 30);
                    const hx = cx + hSize * Math.cos(angle);
                    const hy = cy + hSize * Math.sin(angle);
                    i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LAYER 4 â€” Glowing hexagons (highlighted, accent)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    {
        const accents = [
            { x: 420, y: 60,  s: 22, c: 'rgba(88,101,242,0.5)' },
            { x: 720, y: 190, s: 18, c: 'rgba(0,220,255,0.4)'  },
            { x: 580, y: 250, s: 16, c: 'rgba(0,255,180,0.35)' },
            { x: 830, y: 70,  s: 20, c: 'rgba(150,0,255,0.4)'  },
            { x: 350, y: 210, s: 14, c: 'rgba(255,200,0,0.3)'  },
        ];
        for (const a of accents) {
            ctx.save();
            ctx.shadowColor = a.c;
            ctx.shadowBlur  = 20;
            ctx.strokeStyle = a.c;
            ctx.lineWidth   = 1.5;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 180) * (60 * i - 30);
                const hx = a.x + a.s * Math.cos(angle);
                const hy = a.y + a.s * Math.sin(angle);
                i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LAYER 5 â€” Floating particles / stars
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    const starColors = ['#ffffff', '#7289da', '#00ffd0', '#a78bfa', '#60d3ff'];
    for (let i = 0; i < 80; i++) {
        const px     = rand() * W;
        const py     = rand() * H;
        const pr     = rand() * 1.8 + 0.3;
        const alpha  = rand() * 0.6 + 0.15;
        const color  = starColors[Math.floor(rand() * starColors.length)];
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = color;
        ctx.shadowColor = color;
        ctx.shadowBlur  = pr > 1.2 ? 6 : 2;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LAYER 6 â€” Diagonal circuit / scan lines
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1;
    for (let y = -H; y < H * 2; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y + H * 0.3);
        ctx.stroke();
    }
    ctx.restore();

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LAYER 7 â€” Left panel dark overlay (avatar area)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    {
        const panelGrd = ctx.createLinearGradient(0, 0, 275, 0);
        panelGrd.addColorStop(0,   'rgba(5,5,16,0.85)');
        panelGrd.addColorStop(0.8, 'rgba(5,5,16,0.6)');
        panelGrd.addColorStop(1,   'rgba(5,5,16,0)');
        ctx.fillStyle = panelGrd;
        ctx.fillRect(0, 0, 275, H);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LAYER 8 â€” Glowing border
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    {
        const brd = ctx.createLinearGradient(0, 0, W, H);
        brd.addColorStop(0,    '#5865F2');
        brd.addColorStop(0.35, '#00DCFF');
        brd.addColorStop(0.65, '#00FFB4');
        brd.addColorStop(1,    '#9600FF');

        ctx.save();
        ctx.shadowColor = '#5865F2';
        ctx.shadowBlur  = 18;
        ctx.strokeStyle = brd;
        ctx.lineWidth   = 3;
        roundRect(ctx, 2, 2, W - 4, H - 4, 22);
        ctx.stroke();
        ctx.restore();

        // Inner subtle glow line
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 1;
        roundRect(ctx, 4, 4, W - 8, H - 8, 20);
        ctx.stroke();
        ctx.restore();
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LAYER 9 â€” Vertical divider
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    {
        const divX   = 270;
        const divGrd = ctx.createLinearGradient(divX, 20, divX, H - 20);
        divGrd.addColorStop(0,   'rgba(88,101,242,0)');
        divGrd.addColorStop(0.3, 'rgba(0,220,255,0.7)');
        divGrd.addColorStop(0.7, 'rgba(0,255,180,0.7)');
        divGrd.addColorStop(1,   'rgba(88,101,242,0)');

        ctx.save();
        ctx.shadowColor = '#00DCFF';
        ctx.shadowBlur  = 10;
        ctx.strokeStyle = divGrd;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(divX, 20);
        ctx.lineTo(divX, H - 20);
        ctx.stroke();
        ctx.restore();
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LAYER 10 â€” Avatar
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    const avatarSize = 140;
    const avatarX    = 135;
    const avatarY    = H / 2;
    const avatarUrl  = member.user.displayAvatarURL({ extension: 'png', size: 256 });

    // Outer pulse ring (faint, large)
    ctx.save();
    ctx.globalAlpha = 0.18;
    const pulseGrd = ctx.createRadialGradient(avatarX, avatarY, avatarSize / 2 + 8, avatarX, avatarY, avatarSize / 2 + 40);
    pulseGrd.addColorStop(0, 'rgba(88,101,242,1)');
    pulseGrd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pulseGrd;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2 + 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Gradient ring
    const ringGrd = ctx.createLinearGradient(
        avatarX - avatarSize / 2, avatarY - avatarSize / 2,
        avatarX + avatarSize / 2, avatarY + avatarSize / 2
    );
    ringGrd.addColorStop(0,    '#5865F2');
    ringGrd.addColorStop(0.35, '#00DCFF');
    ringGrd.addColorStop(0.65, '#00FFB4');
    ringGrd.addColorStop(1,    '#9600FF');

    ctx.save();
    ctx.shadowColor = '#00DCFF';
    ctx.shadowBlur  = 24;
    ctx.strokeStyle = ringGrd;
    ctx.lineWidth   = 5;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2 + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Draw avatar clipped to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    try {
        const avatar = await loadImage(avatarUrl);
        ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
    } catch {
        ctx.fillStyle = '#1a1d2e';
        ctx.fill();
    }
    ctx.restore();

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LAYER 11 â€” Text panel
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    const textX = 300;
    const cy    = H / 2;

    // "WELCOME" tag line
    ctx.save();
    ctx.font        = FONT_TINY;
    ctx.letterSpacing = '4px';
    ctx.fillStyle   = '#00DCFF';
    ctx.shadowColor = '#00DCFF';
    ctx.shadowBlur  = 10;
    ctx.fillText('âœ¦  W E L C O M E  âœ¦', textX, cy - 78);
    ctx.restore();

    // Thin accent line under tag
    {
        const lineGrd = ctx.createLinearGradient(textX, 0, textX + 280, 0);
        lineGrd.addColorStop(0,   '#00DCFF');
        lineGrd.addColorStop(0.6, 'rgba(0,220,255,0.2)');
        lineGrd.addColorStop(1,   'rgba(0,220,255,0)');
        ctx.save();
        ctx.strokeStyle = lineGrd;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(textX, cy - 66);
        ctx.lineTo(textX + 280, cy - 66);
        ctx.stroke();
        ctx.restore();
    }

    // Username big
    ctx.save();
    ctx.font        = FONT_BOLD;
    ctx.shadowColor = '#5865F2';
    ctx.shadowBlur  = 22;
    ctx.fillStyle   = '#FFFFFF';
    const displayName = member.user.username.length > 17
        ? member.user.username.slice(0, 17) + 'â€¦'
        : member.user.username;
    ctx.fillText(displayName, textX, cy - 22);
    ctx.restore();

    // Guild name
    ctx.save();
    ctx.font        = FONT_MEDIUM;
    ctx.fillStyle   = '#a5b4fc';
    ctx.shadowColor = 'rgba(165,180,252,0.3)';
    ctx.shadowBlur  = 8;
    const guildName = member.guild.name.length > 24
        ? member.guild.name.slice(0, 24) + 'â€¦'
        : member.guild.name;
    ctx.fillText(`di  ${guildName}`, textX, cy + 18);
    ctx.restore();

    // Member count pill badge
    {
        const memberNum = member.guild.memberCount;
        const bx  = textX;
        const by  = cy + 38;
        const bw  = 220;
        const bh  = 36;

        // Pill background
        ctx.save();
        ctx.shadowColor = '#00FFB4';
        ctx.shadowBlur  = 8;
        const pillBg = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
        pillBg.addColorStop(0, 'rgba(0,255,180,0.18)');
        pillBg.addColorStop(1, 'rgba(88,101,242,0.12)');
        ctx.fillStyle = pillBg;
        roundRect(ctx, bx, by, bw, bh, 18);
        ctx.fill();

        const pillBorder = ctx.createLinearGradient(bx, by, bx + bw, by);
        pillBorder.addColorStop(0, 'rgba(0,255,180,0.6)');
        pillBorder.addColorStop(1, 'rgba(88,101,242,0.3)');
        ctx.strokeStyle = pillBorder;
        ctx.lineWidth   = 1;
        ctx.stroke();
        ctx.restore();

        ctx.font      = FONT_SMALL;
        ctx.fillStyle = '#E0FFF6';
        ctx.fillText(`ðŸ‘¥  Member ke-${memberNum}`, bx + 14, by + 24);
    }

    // Bottom right â€” account age label
    {
        const accountTs  = Math.floor(member.user.createdTimestamp / 1000);
        const ageLabel   = `â±  Akun sejak <t:${accountTs}:D>`.replace(/<[^>]+>/g, '');
        const yr = new Date(member.user.createdTimestamp).getFullYear();
        ctx.save();
        ctx.font        = FONT_TINY;
        ctx.fillStyle   = 'rgba(160,170,220,0.5)';
        ctx.fillText(`Akun dibuat ${yr}`, W - 170, H - 18);
        ctx.restore();
    }

    return canvas.toBuffer('image/png');
}

export async function handleMemberJoin(member: GuildMember): Promise<void> {
    const guild = member.guild;

    const chan = guild.channels.cache.find(
        c => c.name === WELCOME_CHANNEL_NAME && c.isTextBased()
    ) as TextChannel | undefined;

    if (!chan) return;

    const joinedTs  = Math.floor(Date.now() / 1000);
    const accountTs = Math.floor(member.user.createdTimestamp / 1000);
    const rulesId   = guild.channels.cache.find(c => c.name === 'ðŸ“œ-rules')?.id;

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
            `${member} baru aja gabung! ðŸŽ‰\n\n` +
            (rulesId ? `ðŸ“œ Baca <#${rulesId}> dulu ya bro.\n` : '') +
            `ðŸ›’ Jelajahi **ðŸ›’ MARKETPLACE** untuk lihat layanan kami.\n` +
            `â“ Drop di ðŸ’¬-general kalau ada yang mau ditanyain.`
        )
        .addFields(
            { name: 'ðŸ“… Akun',    value: `<t:${accountTs}:D>`,   inline: true },
            { name: 'ðŸ• Join',    value: `<t:${joinedTs}:R>`,    inline: true },
            { name: 'ðŸ”¢ Member',  value: `#${guild.memberCount}`, inline: true },
        )
        .setFooter({ text: `${guild.name} â€¢ Selamat bergabung!` })
        .setTimestamp();

    if (attachment) {
        embed.setImage('attachment://welcome.png');
        await chan.send({ content: `${member}`, embeds: [embed], files: [attachment] });
    } else {
        embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
        await chan.send({ content: `${member}`, embeds: [embed] });
    }
}
