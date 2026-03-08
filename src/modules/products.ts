import {
    Interaction,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from 'discord.js';
import { OWNER_ID } from '../config';
import { getAllServices, getService, updateService } from '../lib/serviceStore';
import { refreshCardInChannel } from './card';

export async function handleProductCommand(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (interaction.user.id !== OWNER_ID) {
        await interaction.reply({ content: '❌ Hanya Owner yang bisa kelola produk.', ephemeral: true });
        return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
        const services = await getAllServices();
        const embed = new EmbedBuilder()
            .setTitle('📦 Daftar Produk / Jasa')
            .setColor('#5865F2')
            .setDescription(
                services.map(s =>
                    `**${s.emoji} ${s.title}** \`id: ${s.id}\`\n` +
                    `💰 ${s.price} · ⏱️ ${s.eta}`
                ).join('\n\n')
            )
            .setFooter({ text: 'Gunakan /product edit lalu ketik ID produk' });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    if (sub === 'edit') {
        const id = interaction.options.getString('id', true);
        const service = await getService(id);

        if (!service) {
            await interaction.reply({ content: `❌ Produk dengan id \`${id}\` tidak ditemukan.`, ephemeral: true });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(`modal_edit_${id}`)
            .setTitle(`Edit: ${service.title}`);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder().setCustomId('field_desc').setLabel('Deskripsi Singkat')
                    .setStyle(TextInputStyle.Paragraph).setValue(service.desc).setRequired(true)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder().setCustomId('field_price').setLabel('Harga (contoh: Mulai Rp 150.000)')
                    .setStyle(TextInputStyle.Short).setValue(service.price).setRequired(true)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder().setCustomId('field_eta').setLabel('Estimasi (contoh: 3 – 14 hari)')
                    .setStyle(TextInputStyle.Short).setValue(service.eta).setRequired(true)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder().setCustomId('field_stack').setLabel('Tech Stack (pisahkan dengan koma)')
                    .setStyle(TextInputStyle.Short).setValue(service.stack.join(', ')).setRequired(true)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder().setCustomId('field_features').setLabel('Fitur yang Didapat (satu per baris)')
                    .setStyle(TextInputStyle.Paragraph).setValue(service.features.join('\n')).setRequired(true)
            ),
        );

        await interaction.showModal(modal);
    }
}

export async function handleProductModal(interaction: Interaction): Promise<void> {
    if (!interaction.isModalSubmit() || !interaction.guild) return;
    if (!interaction.customId.startsWith('modal_edit_')) return;

    const id       = interaction.customId.replace('modal_edit_', '');
    const desc     = interaction.fields.getTextInputValue('field_desc').trim();
    const price    = interaction.fields.getTextInputValue('field_price').trim();
    const eta      = interaction.fields.getTextInputValue('field_eta').trim();
    const stack    = interaction.fields.getTextInputValue('field_stack').split(',').map(s => s.trim()).filter(Boolean);
    const features = interaction.fields.getTextInputValue('field_features').split('\n').map(s => s.trim()).filter(Boolean);

    const updated = await updateService(id, { desc, price, eta, stack, features });
    if (!updated) {
        await interaction.reply({ content: `❌ Gagal update — produk \`${id}\` tidak ditemukan.`, ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await refreshCardInChannel(interaction.guild, updated);
    const statusMsg: Record<string, string> = {
        updated:    `✅ **${updated.title}** berhasil diupdate! Card di channel sudah diperbarui.`,
        created:    `✅ Data disimpan. Card baru dikirim ke channel.`,
        no_channel: `✅ Data disimpan ke database, tapi channel \`${updated.name}\` tidak ditemukan di server.`,
    };

    await interaction.editReply({ content: statusMsg[result] });
}

export async function handleProductAutocomplete(interaction: Interaction): Promise<void> {
    if (!interaction.isAutocomplete()) return;
    const focused  = interaction.options.getFocused().toLowerCase();
    const services = await getAllServices();
    const choices  = services
        .filter(s => s.id.includes(focused) || s.title.toLowerCase().includes(focused))
        .slice(0, 25)
        .map(s => ({ name: `${s.emoji} ${s.title}`, value: s.id }));
    await interaction.respond(choices);
}
