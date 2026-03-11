/**
 * ボタンインタラクション処理モジュール
 * ロールのトグル（付与/解除）を実行
 */

import { REST, Routes, EmbedBuilder } from 'discord.js';
import { findRoleById } from './roles.js';
import { deleteOldBotMessages } from './interactionCache.js';

/**
 * サーバーにロールが存在するか確認し、なければ作成（REST APIベース）
 * @param {REST} rest - discord.js RESTインスタンス
 * @param {string} guildId - サーバーID
 * @param {object} roleDef - ロール定義オブジェクト
 * @returns {object} Discord ロールオブジェクト
 */
async function ensureRole(rest, guildId, roleDef) {
    // 既存ロールを取得
    const roles = await rest.get(Routes.guildRoles(guildId));
    let role = roles.find(r => r.name === roleDef.label);

    // なければ新規作成
    if (!role) {
        role = await rest.post(Routes.guildRoles(guildId), {
            body: {
                name: roleDef.label,
                color: roleDef.color,
            },
            reason: `ロールパネルから自動作成: ${roleDef.label}`,
        });
    }

    return role;
}

/**
 * ボタンインタラクション（Webhookペイロード）を処理
 * @param {Object} interactionData - Webhook payload
 */
export async function handleRoleButton(interactionData) {
    const { guild_id, member, data } = interactionData;
    const customId = data.custom_id;
    if (!customId || !customId.startsWith('role_')) return;

    const userId = member.user.id;
    const roleId = customId.replace('role_', '');
    const roleDef = findRoleById(roleId);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    // 定義に存在しないロールIDの場合は無視
    if (!roleDef) {
        return {
            type: 6 // InteractionResponseType.DEFERRED_UPDATE_MESSAGE
        };
    }

    try {
        // ロールの存在を確認・作成
        const discordRole = await ensureRole(rest, guild_id, roleDef);

        // トグル処理
        const hasRole = member.roles.includes(discordRole.id);

        if (hasRole) {
            // ロール解除
            await rest.delete(Routes.guildMemberRole(guild_id, userId, discordRole.id), {
                reason: 'Button toggled (remove)'
            });
        } else {
            // ロール付与
            await rest.put(Routes.guildMemberRole(guild_id, userId, discordRole.id), {
                reason: 'Button toggled (add)'
            });
        }
    } catch (error) {
        console.error('ロール操作エラー:', error);
    }

    // 常にメッセージを送信せず、インタラクションを正常終了させるために DEFERRED_UPDATE_MESSAGE を返す
    return {
        type: 6
    };
}

/**
 * 募集ボタンが押されたときの処理
 * @param {Object} interactionData - Webhook payload
 */
export async function handleRecruitButton(interactionData) {
    const { channel_id, member } = interactionData;
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        const displayName = member?.nick || member?.user?.global_name || member?.user?.username || 'メンバー';
        await rest.post(Routes.channelMessages(channel_id), {
            body: {
                content: `@everyone ${displayName} さんが募集を開始しました！🎮`
            }
        });
    } catch (error) {
        console.error('募集メッセージ送信エラー:', error);
    }

    // パネルはそのまま残すため、DEFERRED_UPDATE_MESSAGE を返す
    return {
        type: 6
    };
}

/**
 * 使い方ボタンが押されたときの処理
 * @param {Object} interactionData - Webhook payload
 */
export async function handleHelpButton(interactionData) {
    const { channel_id } = interactionData;
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    // チャンネル内の過去のBotメッセージ（過去の使い方の説明など）を削除して最新化する
    await deleteOldBotMessages(channel_id);

    const embed = new EmbedBuilder()
        .setTitle('ボットの基本的な使い方')
        .setDescription(
            'このボットで利用可能な主な機能とコマンドの一覧です：\n\n' +
            '🔹 **ロールの取得**\n' +
            '「ロール選択パネル」のボタンを押すことで、武器種やランクなどのロールを自分に付与・解除できます。\n\n' +
            '🔹 **スケジュールの確認**\n' +
            '`/schedule` と入力すると直近のスケジュールを確認できます。「スケジュールパネル」を利用すればいつでも確認可能です。\n\n' +
            '🔹 **メンバーの募集**\n' +
            '募集用パネルのボタンを押すと `@everyone` 宛てに募集通知を送信します！\n\n' +
            '※ このメッセージは新しい使い方を開くときに上書き（削除）されます。'
        )
        .setColor(0x3b82f6)
        .toJSON();

    try {
        await rest.post(Routes.channelMessages(channel_id), {
            body: {
                embeds: [embed]
            }
        });
    } catch (error) {
        console.error('使い方メッセージ送信エラー:', error);
    }

    // パネル自体はそのまま残してインタラクションを正常完了する
    return {
        type: 6
    };
}
