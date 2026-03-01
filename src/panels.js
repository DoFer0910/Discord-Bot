/**
 * ロール選択パネル生成モジュール
 * カテゴリ別のEmbed + ボタンを生成してチャンネルに送信
 */

import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { WEAPON_ROLES, MODE_ROLES } from './roles.js';

/**
 * ボタン行を生成する（5個ずつの行に分割）
 * Discord の制限: 1行に最大5つのボタン
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

/**
 * 武器種パネルのEmbedを生成
 * @returns {EmbedBuilder} 武器種用Embed
 */
function createWeaponEmbed() {
    return new EmbedBuilder()
        .setTitle('🎮 武器種ロール')
        .setDescription(
            '自分が使う武器種のボタンを押してロールを取得しましょう！\n' +
            'もう一度押すとロールが外れます。'
        )
        .setColor(0x7c3aed);
}

/**
 * モードパネルのEmbedを生成
 * @returns {EmbedBuilder} モード用Embed
 */
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
 * ロール選択パネルをチャンネルに送信
 * @param {TextChannel} channel - 送信先チャンネル
 */
export async function sendRolePanels(channel) {
    // 武器種パネル送信
    await channel.send({
        embeds: [createWeaponEmbed()],
        components: createButtonRows(WEAPON_ROLES),
    });

    // モードパネル送信
    await channel.send({
        embeds: [createModeEmbed()],
        components: createButtonRows(MODE_ROLES),
    });
}
