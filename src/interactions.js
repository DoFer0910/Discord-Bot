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

    const roleId = customId.replace('role_', '');
    const roleDef = findRoleById(roleId);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    // 定義に存在しないロールIDの場合は無視
    if (!roleDef) {
        return {
            type: 4, // InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE
            data: { content: '❌ 不明なロールです。', flags: 64 }
        };
    }

    try {
        // ロールの存在を確認・作成
        const discordRole = await ensureRole(rest, guild_id, roleDef);

        // トグル処理
        const hasRole = member.roles.includes(discordRole.id);
        const userId = member.user.id;

        if (hasRole) {
            // ロール解除
            await rest.delete(Routes.guildMemberRole(guild_id, userId, discordRole.id), {
                reason: 'Button toggled (remove)'
            });
            return {
                type: 4,
                data: { content: `✅ <@&${discordRole.id}> ロールを解除しました。`, flags: 64 }
            };
        } else {
            // ロール付与
            await rest.put(Routes.guildMemberRole(guild_id, userId, discordRole.id), {
                reason: 'Button toggled (add)'
            });
            return {
                type: 4,
                data: { content: `✅ <@&${discordRole.id}> ロールを付与しました。`, flags: 64 }
            };
        }
    } catch (error) {
        console.error('ロール操作エラー:', error);
        return {
            type: 4,
            data: { content: '❌ ロールの操作に失敗しました。Botの権限を確認してください。', flags: 64 }
        };
    }
}
