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
import { WEAPON_ROLES, MODE_ROLES, RANK_ROLES } from './roles.js';

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

function createRankEmbed() {
    return new EmbedBuilder()
        .setTitle('🏅 ウデマエ (ランク)')
        .setDescription(
            '現在の連携や合流の目安として、自分のウデマエのボタンを押してロールを取得しましょう！\n' +
            'もう一度押すとロールが外れます。'
        )
        .setColor(0xf59e0b);
}

/**
 * /setup_roles コマンドに対するパネル設置・応答処理
 * @param {Object} interactionData - Webhook からの interaction body
 */
export async function sendSetupRolesResponse(interactionData) {
    const { channel_id } = interactionData;
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
        const rankPayload = {
            embeds: [createRankEmbed().toJSON()],
            components: createButtonRows(RANK_ROLES).map(row => row.toJSON()),
        };

        // チャンネルに3つのパネルを送信
        await rest.post(Routes.channelMessages(channel_id), { body: weaponPayload });
        await rest.post(Routes.channelMessages(channel_id), { body: modePayload });
        await rest.post(Routes.channelMessages(channel_id), { body: rankPayload });

        // 元のインタラクションの Deferred に成功メッセージを上書きするのではなく、直接返却する
        return {
            type: 4,
            data: {
                content: '✅ ロール選択パネルを設置しました！',
                flags: 64, // Ephemeral
            }
        };

    } catch (error) {
        console.error('Setup roles panel sending error:', error);
        return {
            type: 4,
            data: {
                content: '❌ パネル送信に失敗しました。',
                flags: 64,
            }
        };
    }
}

/**
 * /setup_schedule コマンド用: スケジュール確認常設パネルを設置
 * @param {Object} interactionData
 */
export async function sendSetupScheduleResponse(interactionData) {
    const { channel_id } = interactionData;
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    const embed = new EmbedBuilder()
        .setTitle('📅 スプラトゥーン3 スケジュール確認')
        .setDescription('下のボタンを押すとスケジュールの詳細が表示されます！\n（チャンネルを汚さずにいつでも最新情報を確認できます）')
        .setColor(0x10b981)
        .toJSON();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('schedule_current')
                .setLabel('現在のスケジュール')
                .setEmoji('🟢')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('schedule_next')
                .setLabel('次回のスケジュール')
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary)
        )
        .toJSON();

    try {
        await rest.post(Routes.channelMessages(channel_id), {
            body: {
                embeds: [embed],
                components: [row],
            }
        });

        return {
            type: 4,
            data: {
                content: '✅ スケジュール確認パネルを設置しました！\n（※このメッセージは見やすくするためにピン留めしておくことをおすすめします）',
                flags: 64,
            }
        };
    } catch (error) {
        console.error('Setup schedule panel sending error:', error);
        return {
            type: 4,
            data: {
                content: '❌ パネルの設置に失敗しました。',
                flags: 64,
            }
        };
    }
}

/**
 * /setup_recruit コマンド用: 募集パネルを設置
 * @param {Object} interactionData
 */
export async function sendSetupRecruitResponse(interactionData) {
    const { channel_id } = interactionData;
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    const embed = new EmbedBuilder()
        .setTitle('🎮 メンバー募集')
        .setDescription('下のボタンを押すと「@everyone」でメンバーを募集します！\n（通知が飛ぶので注意してください）')
        .setColor(0xec4899)
        .toJSON();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('recruit_everyone')
                .setLabel('募集する！')
                .setEmoji('📢')
                .setStyle(ButtonStyle.Primary)
        )
        .toJSON();

    try {
        await rest.post(Routes.channelMessages(channel_id), {
            body: {
                embeds: [embed],
                components: [row],
            }
        });

        return {
            type: 4,
            data: {
                content: '✅ 募集用パネルを設置しました！',
                flags: 64,
            }
        };
    } catch (error) {
        console.error('Setup recruit panel sending error:', error);
        return {
            type: 4,
            data: {
                content: '❌ パネルの設置に失敗しました。',
                flags: 64,
            }
        };
    }
}

/**
 * /setup_help コマンド用: 使い方説明パネルを設置
 * @param {Object} interactionData
 */
export async function sendSetupHelpResponse(interactionData) {
    const { channel_id } = interactionData;
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    const embed = new EmbedBuilder()
        .setTitle('ℹ️ ボットの使い方')
        .setDescription('下のボタンを押すと、このボットの基本的な使い方や機能の説明が表示されます！')
        .setColor(0x3b82f6)
        .toJSON();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('show_help')
                .setLabel('使い方を見る')
                .setEmoji('📖')
                .setStyle(ButtonStyle.Primary)
        )
        .toJSON();

    try {
        await rest.post(Routes.channelMessages(channel_id), {
            body: {
                embeds: [embed],
                components: [row],
            }
        });

        return {
            type: 4,
            data: {
                content: '✅ 使い方説明用パネルを設置しました！',
                flags: 64,
            }
        };
    } catch (error) {
        console.error('Setup help panel sending error:', error);
        return {
            type: 4,
            data: {
                content: '❌ パネルの設置に失敗しました。',
                flags: 64,
            }
        };
    }
}
