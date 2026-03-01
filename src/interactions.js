/**
 * ボタンインタラクション処理モジュール
 * ロールのトグル（付与/解除）を実行
 */

import { findRoleById } from './roles.js';

// ユーザーごとのインタラクション履歴を管理
const userReplies = new Map();

/**
 * 送信したメッセージの履歴を保存し、5件を超える場合は古いものを削除
 * @param {string} userId - ユーザーID
 * @param {ButtonInteraction} interaction - インタラクション
 */
async function trackAndLimitReplies(userId, interaction) {
    if (!userReplies.has(userId)) {
        userReplies.set(userId, []);
    }
    const replies = userReplies.get(userId);
    replies.push(interaction);

    if (replies.length > 5) {
        const oldestInteraction = replies.shift();
        try {
            await oldestInteraction.deleteReply();
        } catch (error) {
            console.error('古いメッセージの削除に失敗しました (15分経過等):', error);
        }
    }
}

/**
 * サーバーにロールが存在するか確認し、なければ作成
 * @param {Guild} guild - Discord サーバー
 * @param {object} roleDef - ロール定義オブジェクト
 * @returns {Role} Discord ロール
 */
async function ensureRole(guild, roleDef) {
    // 既存ロールを名前で検索
    let role = guild.roles.cache.find(r => r.name === roleDef.label);

    // なければ新規作成
    if (!role) {
        role = await guild.roles.create({
            name: roleDef.label,
            color: roleDef.color,
            reason: `ロールパネルから自動作成: ${roleDef.label}`,
        });
    }

    return role;
}

/**
 * ボタンインタラクションを処理
 * ロールのトグル（持っていれば解除、持っていなければ付与）
 * @param {ButtonInteraction} interaction - ボタンインタラクション
 */
export async function handleRoleButton(interaction) {
    // カスタムIDからロールIDを抽出（形式: role_{id}）
    const customId = interaction.customId;
    if (!customId.startsWith('role_')) return;

    const roleId = customId.replace('role_', '');
    const roleDef = findRoleById(roleId);

    // 定義に存在しないロールIDの場合は無視
    if (!roleDef) {
        await interaction.reply({
            content: '❌ 不明なロールです。',
            ephemeral: true,
        });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const guild = interaction.guild;
        const member = interaction.member;

        // ロールの存在を確認・作成
        const role = await ensureRole(guild, roleDef);

        // トグル処理
        if (member.roles.cache.has(role.id)) {
            // ロール解除
            await member.roles.remove(role);
            await interaction.editReply({
                content: `${roleDef.emoji} **${roleDef.label}** ロールを外しました。`,
            });
        } else {
            // ロール付与
            await member.roles.add(role);
            await interaction.editReply({
                content: `${roleDef.emoji} **${roleDef.label}** ロールを付けました！`,
            });
        }

        // 表示件数を最新5件に制限
        await trackAndLimitReplies(interaction.user.id, interaction);
    } catch (error) {
        console.error('ロール操作エラー:', error);
        await interaction.editReply({
            content: '❌ ロールの操作に失敗しました。Botの権限を確認してください。',
        });
    }
}
