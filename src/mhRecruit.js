/**
 * モンスターハンター募集専用チャンネル、常設パネル、入力モーダルを管理する。
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  OverwriteType,
  PermissionFlagsBits,
  Routes,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { createDiscordRest, postHuntCommand, validateHuntCommand } from './interactions.js';

export const MH_RECRUIT_CHANNEL_NAME = 'モンハン募集';
export const MH_RECRUIT_SIMPLE_ID = 'mh_recruit_simple';
export const MH_RECRUIT_OPEN_ID = 'mh_recruit_open';
export const MH_RECRUIT_MODAL_PREFIX = 'mh_recruit_modal:';

const MEMBER_ALLOW = (
  PermissionFlagsBits.ViewChannel
  | PermissionFlagsBits.ReadMessageHistory
  | PermissionFlagsBits.UseApplicationCommands
).toString();
const MEMBER_DENY = PermissionFlagsBits.SendMessages.toString();
const BOT_ALLOW = (
  PermissionFlagsBits.ViewChannel
  | PermissionFlagsBits.SendMessages
  | PermissionFlagsBits.ReadMessageHistory
  | PermissionFlagsBits.EmbedLinks
  | PermissionFlagsBits.MentionEveryone
).toString();

export function createMhRecruitPermissionOverwrites(guildId, botUserId) {
  if (!guildId || !botUserId) throw new Error('サーバーIDまたはBotユーザーIDがありません');
  return [
    {
      id: guildId,
      type: OverwriteType.Role,
      allow: MEMBER_ALLOW,
      deny: MEMBER_DENY,
    },
    {
      id: botUserId,
      type: OverwriteType.Member,
      allow: BOT_ALLOW,
      deny: '0',
    },
  ];
}

export function createMhRecruitPanelPayload() {
  const embed = new EmbedBuilder()
    .setTitle('🎮 モンハン クエスト募集')
    .setDescription(
      '入力なしで募集する場合は「クエストを募集する」、\n' +
      '対象や人数を指定する場合は「詳細募集」を押してください。\n'
      + '募集後はこのパネルが最下部へ移動します。',
    )
    .setColor(0xdc2626)
    .toJSON();
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(MH_RECRUIT_SIMPLE_ID)
        .setLabel('クエストを募集する')
        .setEmoji('📢')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(MH_RECRUIT_OPEN_ID)
        .setLabel('詳細募集')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Secondary),
    )
    .toJSON();
  return {
    embeds: [embed],
    components: [row],
    allowed_mentions: { parse: [] },
  };
}

/** 簡易募集で使う表示名以外のメンションを無効化する。 */
function escapeRecruitDisplayName(displayName) {
  return String(displayName || 'メンバー').replaceAll('@', '@\u200b');
}

function recruitDisplayName(interactionData) {
  const member = interactionData.member;
  const user = interactionData.user;
  return member?.nick
    || member?.user?.global_name
    || member?.user?.username
    || user?.global_name
    || user?.username
    || 'メンバー';
}

export function createMhSimpleRecruitAllowedMentions() {
  return { parse: ['everyone'], users: [], roles: [], replied_user: false };
}

export function createMhSimpleRecruitPayload(displayName) {
  const safeDisplayName = escapeRecruitDisplayName(displayName);
  return {
    content: `@everyone ${safeDisplayName}さんがモンハンのクエスト募集を開始しました！`,
    allowed_mentions: createMhSimpleRecruitAllowedMentions(),
  };
}

export function isMhRecruitPanel(message) {
  return (message?.components || []).some(row =>
    (row.components || []).some(component => component.custom_id === MH_RECRUIT_OPEN_ID));
}

export function findMhRecruitChannel(channels) {
  return (channels || []).find(item =>
    item.type === ChannelType.GuildText && item.name === MH_RECRUIT_CHANNEL_NAME) || null;
}

function textInput(customId, label, { placeholder, required = true, maxLength } = {}) {
  const input = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setRequired(required);
  if (placeholder) input.setPlaceholder(placeholder);
  if (maxLength) input.setMaxLength(maxLength);
  return new ActionRowBuilder().addComponents(input);
}

export function createMhRecruitModalResponse(interactionData) {
  const panelMessageId = interactionData.message?.id;
  if (!panelMessageId) {
    return { type: 4, data: { content: '❌ 募集パネルを特定できません。', flags: 64 } };
  }
  const modal = new ModalBuilder()
    .setCustomId(`${MH_RECRUIT_MODAL_PREFIX}${panelMessageId}`)
    .setTitle('モンハン クエスト募集')
    .addComponents(
      textInput('target', '対象・クエスト名', { placeholder: '例: 歴戦王ネルギガンテ', maxLength: 1000 }),
      textInput('purpose', '目的', { placeholder: '例: 素材集め、装飾品周回', maxLength: 1000 }),
      textInput('slots', '募集人数（主催者を除く1〜3人）', { placeholder: '例: 3', maxLength: 1 }),
      textInput('voice', 'VCの有無', { placeholder: '「あり」または「なし」', maxLength: 3 }),
      textInput('start_time', '開始時刻', { placeholder: '例: 今から、21:00', required: false, maxLength: 100 }),
    );
  return { type: 9, data: modal.toJSON() };
}

function modalValues(interactionData) {
  const entries = (interactionData.data?.components || []).flatMap(row =>
    (row.components || []).map(component => [component.custom_id, component.value]));
  return Object.fromEntries(entries);
}

function normalizeVoice(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['あり', '有', 'yes', 'true', '1'].includes(normalized)) return true;
  if (['なし', '無', 'no', 'false', '0'].includes(normalized)) return false;
  return null;
}

function normalizeSlots(value) {
  const normalized = String(value || '').trim().replace(/[１２３]/g, digit =>
    String('１２３'.indexOf(digit) + 1));
  const slots = Number(normalized);
  return Number.isInteger(slots) && slots >= 1 && slots <= 3 ? slots : null;
}

export function modalToHuntInteraction(interactionData) {
  const customId = interactionData.data?.custom_id || '';
  const oldPanelMessageId = customId.startsWith(MH_RECRUIT_MODAL_PREFIX)
    ? customId.slice(MH_RECRUIT_MODAL_PREFIX.length)
    : '';
  const values = modalValues(interactionData);
  const slots = normalizeSlots(values.slots);
  const voice = normalizeVoice(values.voice);
  if (!oldPanelMessageId || slots === null || voice === null) {
    return { error: '❌ 募集人数は1〜3、VCは「あり」または「なし」で入力してください。' };
  }
  const huntInteraction = {
    ...interactionData,
    data: {
      name: 'hunt',
      options: [
        { name: 'target', value: values.target },
        { name: 'purpose', value: values.purpose },
        { name: 'slots', value: slots },
        { name: 'voice', value: voice },
        { name: 'start_time', value: values.start_time || '今から' },
      ],
    },
  };
  const validation = validateHuntCommand(huntInteraction);
  if (validation.error) return validation;
  return { huntInteraction, oldPanelMessageId };
}

async function applyChannelPermissions(rest, channelId, guildId, botUserId) {
  const overwrites = createMhRecruitPermissionOverwrites(guildId, botUserId);
  await Promise.all(overwrites.map(overwrite => rest.put(
    Routes.channelPermission(channelId, overwrite.id),
    { body: { type: overwrite.type, allow: overwrite.allow, deny: overwrite.deny } },
  )));
}

export async function setupMhRecruitChannel(interactionData) {
  const guildId = interactionData.guild_id;
  const botUserId = process.env.CLIENT_ID;
  if (!guildId || !botUserId) {
    return { ok: false, content: '❌ サーバーまたはBotの設定情報を取得できません。' };
  }
  const rest = createDiscordRest();
  try {
    const channels = await rest.get(Routes.guildChannels(guildId));
    let channel = findMhRecruitChannel(channels);
    if (!channel) {
      channel = await rest.post(Routes.guildChannels(guildId), {
        body: {
          name: MH_RECRUIT_CHANNEL_NAME,
          type: ChannelType.GuildText,
          topic: 'モンスターハンター：ワールド／アイスボーンのクエスト募集',
          permission_overwrites: createMhRecruitPermissionOverwrites(guildId, botUserId),
        },
      });
    } else {
      await applyChannelPermissions(rest, channel.id, guildId, botUserId);
    }

    const messages = await rest.get(Routes.channelMessages(channel.id), {
      query: new URLSearchParams({ limit: '100' }),
    });
    const oldPanelIds = messages
      .filter(message => message.author?.id === botUserId && isMhRecruitPanel(message))
      .map(message => message.id);
    await rest.post(Routes.channelMessages(channel.id), { body: createMhRecruitPanelPayload() });
    const cleanupResults = await Promise.all(oldPanelIds.map(async messageId => {
      try {
        await rest.delete(Routes.channelMessage(channel.id, messageId));
        return true;
      } catch (error) {
        console.error(`古いモンハン募集パネル ${messageId} の削除に失敗しました:`, error);
        return false;
      }
    }));
    if (cleanupResults.includes(false)) {
      return { ok: false, content: `⚠️ <#${channel.id}> に新しいパネルを設置しましたが、古いパネルの一部を削除できませんでした。` };
    }
    return { ok: true, content: `✅ <#${channel.id}> にモンハン募集パネルを設置しました！` };
  } catch (error) {
    console.error('モンハン募集チャンネルの設置エラー:', error);
    return { ok: false, content: '❌ モンハン募集チャンネルの作成またはパネル設置に失敗しました。Botの「チャンネルの管理」権限を確認してください。' };
  }
}

export async function postMhRecruitFromModal(interactionData) {
  const parsed = modalToHuntInteraction(interactionData);
  if (parsed.error) return { ok: false, content: parsed.error };
  const huntResult = await postHuntCommand(parsed.huntInteraction);
  if (!huntResult.ok) return huntResult;

  const rest = createDiscordRest();
  try {
    await rest.post(
      Routes.channelMessages(interactionData.channel_id),
      { body: createMhRecruitPanelPayload() },
    );
    try {
      await rest.delete(
        Routes.channelMessage(interactionData.channel_id, parsed.oldPanelMessageId),
      );
    } catch (error) {
      console.error('古いモンハン募集パネルの削除に失敗しました:', error);
      return {
        ok: false,
        content: '⚠️ 募集と新しいパネルは投稿しましたが、古いパネルを削除できませんでした。',
      };
    }
    return huntResult;
  } catch (error) {
    console.error('モンハン募集パネルの再設置に失敗しました:', error);
    return {
      ok: false,
      content: '⚠️ 募集は投稿しましたが、常設パネルの再設置に失敗しました。管理者に連絡してください。',
    };
  }
}

/** 入力なしの簡易募集を投稿し、常設パネルを最下部へ再配置する。 */
export async function postMhSimpleRecruit(interactionData) {
  const rest = createDiscordRest();
  try {
    await rest.post(
      Routes.channelMessages(interactionData.channel_id),
      { body: createMhSimpleRecruitPayload(recruitDisplayName(interactionData)) },
    );
    await rest.post(
      Routes.channelMessages(interactionData.channel_id),
      { body: createMhRecruitPanelPayload() },
    );
    if (interactionData.message?.id) {
      try {
        await rest.delete(
          Routes.channelMessage(interactionData.channel_id, interactionData.message.id),
        );
      } catch (error) {
        console.error('古いモンハン募集パネルの削除に失敗しました:', error);
        return {
          ok: false,
          content: '⚠️ 簡易募集と新しいパネルは投稿しましたが、古いパネルを削除できませんでした。',
        };
      }
    }
    return { ok: true, content: '✅ モンハンの簡易募集を投稿しました！' };
  } catch (error) {
    console.error('モンハン簡易募集の投稿またはパネル再設置に失敗しました:', error);
    return {
      ok: false,
      content: '❌ モンハンの簡易募集の投稿に失敗しました。',
    };
  }
}
