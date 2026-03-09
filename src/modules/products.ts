import {
    Interaction,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    ModalSubmitInteraction,
} from 'discord.js';
import { OWNER_ID, ServicePackage } from '../config';
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
        return;
    }

    if (sub === 'package') {
        const id      = interaction.options.getString('id', true);
        const action  = interaction.options.getString('action', true) as 'add' | 'edit' | 'delete' | 'list';
        const service = await getService(id);

        if (!service) {
            await interaction.reply({ content: `❌ Produk \`${id}\` tidak ditemukan.`, ephemeral: true });
            return;
        }

        if (action === 'list') {
            if (!service.packages || service.packages.length === 0) {
                await interaction.reply({ content: `ℹ️ **${service.title}** belum punya paket. Gunakan \`/product package action:Tambah Paket\`.`, ephemeral: true });
                return;
            }
            const embed = new EmbedBuilder()
                .setTitle(`📦 Paket — ${service.emoji} ${service.title}`)
                .setColor('#5865F2');
            service.packages.forEach((p, i) => {
                embed.addFields({
                    name: `#${i + 1} ${p.name}`,
                    value: `💰 **Rp ${p.price.toLocaleString('id-ID')}**\n` +
                        (p.eta ? `⏱️ ${p.eta}\n` : '') +
                        `📋 ${p.features.join(', ')}`,
                    inline: true,
                });
            });
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        if (action === 'add') {
            if (service.packages && service.packages.length >= 3) {
                await interaction.reply({ content: '❌ Maksimal 3 paket per produk. Hapus salah satu dulu.', ephemeral: true });
                return;
            }
            const modal = new ModalBuilder()
                .setCustomId(`pkg:add_modal:${id}`)
                .setTitle(`Tambah Paket — ${service.title}`);
            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder().setCustomId('pkg_name').setLabel('Nama Paket').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Paket Basic')
                ),
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder().setCustomId('pkg_price').setLabel('Harga (angka saja, Rp)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('150000')
                ),
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder().setCustomId('pkg_features').setLabel('Fitur (satu per baris)').setStyle(TextInputStyle.Paragraph).setRequired(true)
                ),
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder().setCustomId('pkg_eta').setLabel('Estimasi (opsional)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('3–7 hari')
                ),
            );
            await interaction.showModal(modal);
            return;
        }

        if (action === 'edit' || action === 'delete') {
            if (!service.packages || service.packages.length === 0) {
                await interaction.reply({ content: `ℹ️ **${service.title}** belum punya paket.`, ephemeral: true });
                return;
            }
            const label   = action === 'edit' ? 'Edit' : 'Hapus';
            const customId = action === 'edit' ? `pkg:edit_pick:${id}` : `pkg:delete_pick:${id}`;
            const menu = new StringSelectMenuBuilder()
                .setCustomId(customId)
                .setPlaceholder(`Pilih paket yang ingin di-${label.toLowerCase()}`)
                .addOptions(service.packages.map((p, i) => ({
                    label: p.name,
                    description: `Rp ${p.price.toLocaleString('id-ID')}`,
                    value: String(i),
                })));
            await interaction.reply({
                content: `Pilih paket yang ingin di-**${label.toLowerCase()}**:`,
                components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
                ephemeral: true,
            });
            return;
        }
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

// ── Package handlers ──────────────────────────────────────────────────────────

// StringSelectMenu: pkg:edit_pick:<serviceId>
export async function handlePackageEditPick(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    const parts    = interaction.customId.split(':'); // ['pkg','edit_pick','<id>']
    const serviceId = parts[2];
    const pkgIndex  = parseInt(interaction.values[0], 10);
    const service   = await getService(serviceId);
    if (!service || !service.packages || !service.packages[pkgIndex]) {
        await interaction.reply({ content: '❌ Paket tidak ditemukan.', ephemeral: true });
        return;
    }

    const pkg = service.packages[pkgIndex];
    const modal = new ModalBuilder()
        .setCustomId(`pkg:edit_modal:${serviceId}:${pkgIndex}`)
        .setTitle(`Edit Paket — ${pkg.name}`);
    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('pkg_name').setLabel('Nama Paket').setStyle(TextInputStyle.Short).setRequired(true).setValue(pkg.name)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('pkg_price').setLabel('Harga (angka saja, Rp)').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(pkg.price))
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('pkg_features').setLabel('Fitur (satu per baris)').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(pkg.features.join('\n'))
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('pkg_eta').setLabel('Estimasi (opsional)').setStyle(TextInputStyle.Short).setRequired(false).setValue(pkg.eta ?? '')
        ),
    );
    await interaction.showModal(modal);
}

// StringSelectMenu: pkg:delete_pick:<serviceId>
export async function handlePackageDeletePick(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) return;
    const parts     = interaction.customId.split(':');
    const serviceId = parts[2];
    const pkgIndex  = parseInt(interaction.values[0], 10);
    const service   = await getService(serviceId);
    if (!service || !service.packages || !service.packages[pkgIndex]) {
        await interaction.reply({ content: '❌ Paket tidak ditemukan.', ephemeral: true });
        return;
    }

    const pkgName   = service.packages[pkgIndex].name;
    const newPkgs   = service.packages.filter((_, i) => i !== pkgIndex);
    const updated   = await updateService(serviceId, { packages: newPkgs });
    if (!updated) {
        await interaction.reply({ content: '❌ Gagal hapus paket.', ephemeral: true });
        return;
    }
    await interaction.deferReply({ ephemeral: true });
    await refreshCardInChannel(interaction.guild, updated);
    await interaction.editReply({ content: `🗑️ Paket **${pkgName}** berhasil dihapus.` });
}

// ModalSubmit: pkg:add_modal:<serviceId>  OR  pkg:edit_modal:<serviceId>:<pkgIndex>
export async function handlePackageModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guild) return;
    const parts     = interaction.customId.split(':');
    const isEdit    = parts[1] === 'edit_modal';
    const serviceId = parts[2];
    const service   = await getService(serviceId);
    if (!service) {
        await interaction.reply({ content: '❌ Produk tidak ditemukan.', ephemeral: true });
        return;
    }

    const name     = interaction.fields.getTextInputValue('pkg_name').trim();
    const priceRaw = interaction.fields.getTextInputValue('pkg_price').replace(/\D/g, '');
    const price    = parseInt(priceRaw, 10);
    const features = interaction.fields.getTextInputValue('pkg_features').split('\n').map(s => s.trim()).filter(Boolean);
    const etaRaw   = interaction.fields.getTextInputValue('pkg_eta').trim();
    const newPkg: ServicePackage = { name, price, features, ...(etaRaw ? { eta: etaRaw } : {}) };

    if (isNaN(price) || price <= 0) {
        await interaction.reply({ content: '❌ Harga tidak valid. Masukkan angka saja (contoh: 150000).', ephemeral: true });
        return;
    }

    const packages = [...(service.packages ?? [])];
    if (isEdit) {
        const pkgIndex     = parseInt(parts[3], 10);
        packages[pkgIndex] = newPkg;
    } else {
        packages.push(newPkg);
    }

    const updated = await updateService(serviceId, { packages });
    if (!updated) {
        await interaction.reply({ content: '❌ Gagal menyimpan paket.', ephemeral: true });
        return;
    }
    await interaction.deferReply({ ephemeral: true });
    await refreshCardInChannel(interaction.guild, updated);
    await interaction.editReply({ content: `✅ Paket **${name}** berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}. Card produk sudah diupdate.` });
}
