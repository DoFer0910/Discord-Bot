/**
 * ボタンインタラクション処理モジュール
 * ロールのトグル（付与/解除）を実行
 */

import { REST, Routes, EmbedBuilder } from 'discord.js';
import { findRoleById } from './roles.js';
import { deleteOldBotMessages } from './interactionCache.js';
import { createRecruitEmbed, createRecruitRow } from './panels.js';

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
    const { channel_id, member, message } = interactionData;
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        const displayName = member?.nick || member?.user?.global_name || member?.user?.username || 'メンバー';

        // 1. 募集メッセージ（ログとして残るテキスト）を送信
        await rest.post(Routes.channelMessages(channel_id), {
            body: {
                content: `@everyone ${displayName} さんが募集を開始しました！🎮`
            }
        });

        // 2. 新しい募集パネルを一番下に配置
        await rest.post(Routes.channelMessages(channel_id), {
            body: {
                embeds: [createRecruitEmbed()],
                components: [createRecruitRow()],
            }
        });

        // 3. 元のメッセージ（古いパネルのみ）を削除してスッキリさせる
        if (message && message.id) {
            await rest.delete(Routes.channelMessage(channel_id, message.id)).catch(e => console.error('Original message delete error:', e));
        }

    } catch (error) {
        console.error('募集メッセージ送信エラー:', error);
    }

    // パネルは削除されたが、念のためDEFERRED_UPDATE_MESSAGEを返す
    // （Discord側に「処理完了」を伝えるため。メッセージが存在しなくてもACKとして機能する）
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
            'このボットで利用可能な機能の一覧：\n\n' +
            '🔹 **ロールの取得**\n' +
            'ボタンを押すことで、武器種やランクなどのロールを自分に付与・解除\n\n' +
            '🔹 **スケジュールの確認**\n' +
            '「現在（次回）のスケジュール」のボタンを押すと、現時点のスケジュール情報を確認可能\n' +
            '🔹 **メンバーの募集**\n' +
            '募集用パネルのボタンを押すと @everyone 宛てに募集通知を送信'
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
