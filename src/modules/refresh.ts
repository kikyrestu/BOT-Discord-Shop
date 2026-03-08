import { Interaction } from 'discord.js';
import { OWNER_ID } from '../config';
import { getAllServices } from '../lib/serviceStore';
import { refreshCardInChannel } from './card';

export async function handleRefreshCards(interaction: Interaction): Promise<void> {
    if (!interaction.guild || !interaction.isChatInputCommand()) return;
    if (interaction.user.id !== OWNER_ID) {
        await interaction.reply({ content: '❌ Hanya Owner yang bisa refresh cards.', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    const results: string[] = [];

    for (const s of await getAllServices()) {
        const result = await refreshCardInChannel(interaction.guild, s);
        if (result === 'updated')    results.push(`✅ Card \`${s.name}\` berhasil diupdate.`);
        else if (result === 'created')    results.push(`🆕 Card \`${s.name}\` dibuat baru.`);
        else                             results.push(`⚠️ Channel \`${s.name}\` tidak ditemukan, skip.`);
    }

    await interaction.editReply({ content: results.join('\n') });
}
