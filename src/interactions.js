/**
 * ボタンインタラクション処理モジュール
 * ロールのトグル（付与/解除）を実行
 */

import { REST, Routes, EmbedBuilder } from 'discord.js';
import { findRoleById, MH_NOTIFICATION_ROLE } from './roles.js';
import { HUNT_BUTTON_IDS, applyHuntAction, createHuntPayload, createHuntState, getHuntStateFromMessage } from './mh.js';
import { deleteOldBotMessages } from './interactionCache.js';
import { createRecruitEmbed, createRecruitRow } from './panels.js';

/** Discord RESTの向き先を環境変数で差し替えられる薄い境界。Prism E2Eでも利用する。 */
export function createDiscordRest() {
    const options = { version: '10' };
    if (process.env.DISCORD_API_BASE) options.api = process.env.DISCORD_API_BASE;
    return new REST(options).setToken(process.env.DISCORD_TOKEN || 'test-token');
}

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
        const body = {
            name: roleDef.label,
            color: roleDef.color,
        };
        if (roleDef.mentionable !== undefined) body.mentionable = roleDef.mentionable;
        role = await rest.post(Routes.guildRoles(guildId), {
            body,
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

function interactionOptions(interactionData) {
    return Object.fromEntries((interactionData.data?.options || []).map(option => [option.name, option.value]));
}

function memberDisplayName(member, user) {
    return member?.nick || member?.user?.global_name || member?.user?.username || user?.global_name || user?.username || 'メンバー';
}

export function createHuntAllowedMentions(notificationRole) {
    return notificationRole
        ? { roles: [notificationRole.id], users: [], replied_user: false }
        : { parse: [], replied_user: false };
}

/** モンハン募集通知ロールを検索する。見つからなくても募集投稿は継続する。 */
async function findMhNotificationRole(rest, guildId) {
    try {
        const roles = await rest.get(Routes.guildRoles(guildId));
        return roles.find(role => role.name === MH_NOTIFICATION_ROLE.label) || null;
    } catch (error) {
        console.error('モンハン募集通知ロールの取得に失敗しました（通知なしで続行）:', error);
        return null;
    }
}

/** /hunt の入力を検証し、背景処理へ渡す状態を作る（RESTを呼ばない）。 */
export function validateHuntCommand(interactionData) {
    const options = interactionOptions(interactionData);
    const member = interactionData.member;
    const user = interactionData.user;
    const ownerId = member?.user?.id || user?.id;
    const ownerName = memberDisplayName(member, user);
    try {
        return {
            state: createHuntState({
                ownerId,
                ownerName,
                target: options.target,
                purpose: options.purpose,
                maxSlots: options.slots,
                voice: options.voice,
                startAt: options.start_time,
            }),
        };
    } catch (error) {
        return { error: '❌ 対象・目的・募集人数を確認してください。' };
    }
}

/**
 * /hunt のDiscord REST処理。api層からwaitUntilへ渡されるため、初回応答を待たせない。
 * 戻り値はinteractionの元メッセージをPATCHするための表示文だけに限定する。
 */
export async function postHuntCommand(interactionData) {
    const { channel_id: channelId, guild_id: guildId, member, user } = interactionData;
    const ownerName = memberDisplayName(member, user);
    const validation = validateHuntCommand(interactionData);
    if (validation.error) return { ok: false, content: validation.error };
    const rest = createDiscordRest();

    try {
        const notificationRole = guildId ? await findMhNotificationRole(rest, guildId) : null;
        if (!notificationRole) {
            console.error('モンハン募集通知ロールが見つからないため、通知なしで募集を投稿します。');
        }
        const content = notificationRole
            ? `<@&${notificationRole.id}> 🎮 ${ownerName} さんがモンハン募集を開始しました！`
            : `🎮 ${ownerName} さんがモンハン募集を開始しました！（通知ロール未設定）`;
        const body = createHuntPayload(validation.state, content);
        body.allowed_mentions = createHuntAllowedMentions(notificationRole);
        await rest.post(Routes.channelMessages(channelId), { body });
        return {
            ok: true,
            content: notificationRole
                ? '✅ モンハン募集を投稿しました！'
                : '✅ モンハン募集を投稿しました！（通知ロール未設定のため通知なし）',
        };
    } catch (error) {
        console.error('モンハン募集メッセージ送信エラー:', error);
        return { ok: false, content: '❌ モンハン募集の投稿に失敗しました。' };
    }
}

/** 後方互換の同期ハンドラ。通常のWebhook経路ではapi層がpostHuntCommandをwaitUntilで呼ぶ。 */
export async function handleHuntCommand(interactionData) {
    const result = await postHuntCommand(interactionData);
    return { type: 4, data: { content: result.content, flags: 64 } };
}

/** モンハン募集メッセージの参加・辞退・締切ボタンを処理する。 */
export async function handleHuntButton(interactionData) {
    const customId = interactionData.data?.custom_id;
    const actionByButton = {
        [HUNT_BUTTON_IDS.join]: 'join',
        [HUNT_BUTTON_IDS.leave]: 'leave',
        [HUNT_BUTTON_IDS.close]: 'close',
    };
    const action = actionByButton[customId];
    if (!action) return { type: 6 };

    const state = getHuntStateFromMessage(interactionData.message);
    if (!state) {
        return { type: 4, data: { content: '❌ この募集の状態を復元できません。募集主に新しく投稿してもらってください。', flags: 64 } };
    }

    const member = interactionData.member;
    const user = member?.user || interactionData.user;
    const result = applyHuntAction(state, action, {
        id: user?.id,
        name: memberDisplayName(member, interactionData.user),
    });
    if (result.error) {
        return { type: 4, data: { content: `❌ ${result.error}`, flags: 64 } };
    }
    return { type: 7, data: createHuntPayload(result.state) };
}

/**
 * 使い方ボタンが押されたときの処理
 * @param {Object} interactionData - Webhook payload
 */
export async function handleHelpButton(interactionData) {
    const { channel_id } = interactionData;
    const rest = createDiscordRest();

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
            '募集用パネルのボタンを押すと @everyone 宛てに募集通知を送信\n\n' +
            '🔹 **モンハン（ワールド／アイスボーン）**\n' +
            '`/setup_mh_roles` で武器種・ランク・機種・募集通知ロールを設置\n' +
            '`/setup_mh_recruit` で専用チャンネルと常設募集パネルを設置\n' +
            '常設パネルから募集を作成し、参加・辞退・締切ボタンで管理'
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
