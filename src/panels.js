/**
 * ロール選択パネル生成モジュール
 * カテゴリ別のEmbed + ボタンを生成してWebhookを通じてチャンネルに送信
 */

import {
    REST,
    Routes,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { WEAPON_ROLES, MODE_ROLES } from './roles.js';

/**
 * ボタン行を生成する（5個ずつの行に分割）
 * @param {Array} roles - ロール定義の配列
 * @returns {ActionRowBuilder[]} ボタン行の配列
 */
function createButtonRows(roles) {
    const rows = [];
    for (let i = 0; i < roles.length; i += 5) {
        const row = new ActionRowBuilder();
        const chunk = roles.slice(i, i + 5);
        for (const role of chunk) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`role_${role.id}`)
                    .setLabel(role.label)
                    .setEmoji(role.emoji)
                    .setStyle(ButtonStyle.Secondary)
            );
        }
        rows.push(row);
    }
    return rows;
}

function createWeaponEmbed() {
    return new EmbedBuilder()
        .setTitle('🎮 武器種ロール')
        .setDescription(
            '自分が使う武器種のボタンを押してロールを取得しましょう！\n' +
            'もう一度押すとロールが外れます。'
        )
        .setColor(0x7c3aed);
}

function createModeEmbed() {
    return new EmbedBuilder()
        .setTitle('🏆 やりたいモード')
        .setDescription(
            '一緒にプレイしたいモードのボタンを押してロールを取得しましょう！\n' +
            'もう一度押すとロールが外れます。'
        )
        .setColor(0x0ea5e9);
}

/**
 * /setup_roles コマンドに対するパネル設置・応答処理
 * @param {Object} interactionData - Webhook からの interaction body
 */
export async function sendSetupRolesResponse(interactionData) {
    const { application_id, token, channel_id } = interactionData;
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        const weaponPayload = {
            embeds: [createWeaponEmbed().toJSON()],
            components: createButtonRows(WEAPON_ROLES).map(row => row.toJSON()),
        };
        const modePayload = {
            embeds: [createModeEmbed().toJSON()],
            components: createButtonRows(MODE_ROLES).map(row => row.toJSON()),
        };

        // チャンネルに2つのパネルを送信
        await rest.post(Routes.channelMessages(channel_id), { body: weaponPayload });
        await rest.post(Routes.channelMessages(channel_id), { body: modePayload });

        // 元のインタラクションの Deferred に成功メッセージを上書き
        await rest.patch(Routes.webhookMessage(application_id, token), {
            body: {
                content: '✅ ロール選択パネルを設置しました！',
                flags: 64, // Ephemeral
            }
        });

    } catch (error) {
        console.error('Setup roles panel sending error:', error);
        await rest.patch(Routes.webhookMessage(application_id, token), {
            body: {
                content: '❌ パネル送信に失敗しました。',
                flags: 64,
            }
        }).catch(console.error);
    }
}
