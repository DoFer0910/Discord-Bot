/**
 * ボタンインタラクション処理モジュール
 * ロールのトグル（付与/解除）を実行
 */

import { REST, Routes } from 'discord.js';
import { findRoleById } from './roles.js';

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
        await rest.post(Routes.channelMessages(channel_id), {
            body: {
                content: `@everyone ${member?.user?.username || 'メンバー'} さんが募集を開始しました！🎮`
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
