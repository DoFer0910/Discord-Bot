/**
 * モンスターハンター：ワールド／アイスボーンの募集に関する純粋ロジック。
 *
 * Discord メッセージ以外に状態を持てないため、変更される最小限の状態を
 * Embed footer に保存する。クエスト名などの表示情報はEmbedのfieldに残すことで、
 * 長い自由入力がfooterのサイズ制限を圧迫しないようにしている。
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

export const HUNT_BUTTON_IDS = {
  join: 'mh_hunt_join',
  leave: 'mh_hunt_leave',
  close: 'mh_hunt_close',
};

const STATE_PREFIX = 'mh-hunt:v1:';
const MAX_SLOTS = 3;

function encodeBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

/** 募集の初期状態を作る（参加枠は主催者を除く）。 */
export function createHuntState({
  ownerId,
  ownerName,
  target,
  purpose,
  maxSlots = 1,
  voice = false,
  startAt = '今から',
}) {
  const slots = Number(maxSlots);
  const targetText = String(target || '').trim();
  const purposeText = String(purpose || '').trim();
  if (!ownerId || !targetText || !purposeText || targetText.length > 1000 || purposeText.length > 1000 || !Number.isInteger(slots) || slots < 1 || slots > MAX_SLOTS) {
    throw new Error('募集内容が不正です');
  }

  return {
    ownerId: String(ownerId),
    ownerName: String(ownerName || '主催者'),
    target: targetText,
    purpose: purposeText,
    maxSlots: slots,
    voice: Boolean(voice),
    startAt: String(startAt || '今から'),
    participants: [],
    status: 'open',
  };
}

/** footerに保存する状態をDiscordの文字数制限に収まる短いJSONへ変換する。 */
export function serializeHuntState(state) {
  const compact = {
    o: state.ownerId,
    n: state.ownerName,
    m: state.maxSlots,
    p: (state.participants || []).map(({ id, name }) => ({ i: id, n: name })),
    s: state.status === 'closed' ? 'closed' : 'open',
  };
  return `${STATE_PREFIX}${encodeBase64Url(JSON.stringify(compact))}`;
}

/** footerの状態を復元する。壊れた／古いメッセージはnullとして安全に扱う。 */
export function deserializeHuntState(footerText) {
  if (typeof footerText !== 'string' || !footerText.startsWith(STATE_PREFIX)) return null;
  try {
    const compact = JSON.parse(decodeBase64Url(footerText.slice(STATE_PREFIX.length)));
    const maxSlots = Number(compact.m);
    if (!compact.o || !Number.isInteger(maxSlots) || maxSlots < 1 || maxSlots > MAX_SLOTS) return null;
    if (!Array.isArray(compact.p)) return null;

    return {
      ownerId: String(compact.o),
      ownerName: String(compact.n || '主催者'),
      maxSlots,
      participants: compact.p
        .filter(person => person && person.i)
        .slice(0, maxSlots)
        .map(person => ({ id: String(person.i), name: String(person.n || 'メンバー') })),
      status: compact.s === 'closed' ? 'closed' : 'open',
    };
  } catch (error) {
    console.error('募集状態の復元に失敗しました:', error.message);
    return null;
  }
}

/**
 * 募集ボタン操作を状態へ適用する。RESTやDiscordオブジェクトを参照しないため、
 * 同じ入力に対して常に同じ結果になり、満員・重複・権限の判定をテストできる。
 */
export function applyHuntAction(state, action, user) {
  const next = {
    ...state,
    participants: [...(state.participants || [])],
  };
  const userId = String(user?.id || '');
  const userName = String(user?.name || 'メンバー');
  if (!userId) return { state, error: 'ユーザー情報を取得できませんでした。' };

  if (action === 'close') {
    if (userId !== state.ownerId) return { state, error: '募集を締め切れるのは主催者だけです。' };
    next.status = 'closed';
    return { state: next };
  }
  if (state.status === 'closed') return { state, error: 'この募集は締め切られています。' };
  if (userId === state.ownerId) {
    return { state, error: '主催者は最初から参加扱いです。' };
  }

  const index = next.participants.findIndex(person => person.id === userId);
  if (action === 'join') {
    if (index >= 0) return { state, error: 'すでに参加しています。' };
    if (next.participants.length >= next.maxSlots) return { state, error: '募集人数に達しています。' };
    next.participants.push({ id: userId, name: userName });
    return { state: next };
  }
  if (action === 'leave') {
    if (index < 0) return { state, error: '参加登録されていません。' };
    next.participants.splice(index, 1);
    return { state: next };
  }
  return { state, error: '不明な操作です。' };
}

function participantText(state) {
  const members = [
    `主催: ${state.ownerName} (<@${state.ownerId}>)`,
    ...(state.participants || []).map(person => `${person.name} (<@${person.id}>)`),
  ];
  return members.join('\n');
}

export function createHuntEmbed(state) {
  const isClosed = state.status === 'closed';
  const remaining = Math.max(0, state.maxSlots - (state.participants || []).length);
  return new EmbedBuilder()
    .setTitle(`${isClosed ? '🔒' : '🎮'} モンハン募集${isClosed ? '（締切）' : ''}`)
    .setDescription(isClosed ? 'この募集は締め切られました。' : '参加したい人は「参加する」を押してください。')
    .addFields(
      { name: '対象', value: state.target || '（不明）', inline: false },
      { name: '目的', value: state.purpose || '（不明）', inline: false },
      { name: '募集人数（主催者を除く）', value: `${state.maxSlots}人（残り ${remaining}枠）`, inline: true },
      { name: 'VC', value: state.voice ? 'あり' : 'なし', inline: true },
      { name: '開始', value: state.startAt || '今から', inline: true },
      { name: `参加者（${(state.participants || []).length + 1}/${state.maxSlots + 1}人）`, value: participantText(state), inline: false },
    )
    .setColor(isClosed ? 0x64748b : 0xdc2626)
    .setFooter({ text: serializeHuntState(state) });
}

export function createHuntComponents(state) {
  const disabled = state.status === 'closed';
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(HUNT_BUTTON_IDS.join).setLabel('参加する').setEmoji('🙋').setStyle(ButtonStyle.Success).setDisabled(disabled),
      new ButtonBuilder().setCustomId(HUNT_BUTTON_IDS.leave).setLabel('辞退する').setEmoji('👋').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      new ButtonBuilder().setCustomId(HUNT_BUTTON_IDS.close).setLabel('締め切る').setEmoji('🔒').setStyle(ButtonStyle.Danger).setDisabled(disabled),
    ),
  ];
}

export function createHuntPayload(state, content) {
  const payload = {
    embeds: [createHuntEmbed(state).toJSON()],
    components: createHuntComponents(state).map(row => row.toJSON()),
  };
  if (content !== undefined) payload.content = content;
  return payload;
}

/**
 * 既存メッセージから自由入力の表示情報を読み出し、footer状態と合成する。
 * footerだけで長い目的文を保持しない設計のため、更新時に必ずこの関数を使う。
 */
export function getHuntStateFromMessage(message) {
  const embed = message?.embeds?.[0];
  const footer = embed?.footer?.text;
  const state = deserializeHuntState(footer);
  if (!state) return null;
  const fields = Object.fromEntries((embed.fields || []).map(field => [field.name, field.value]));
  return {
    ...state,
    target: fields['対象'] || '（不明）',
    purpose: fields['目的'] || '（不明）',
    voice: fields.VC === 'あり',
    startAt: fields['開始'] || '今から',
    // 最大枠はfooter状態を正とし、表示fieldの編集で判定が変わらないようにする。
    maxSlots: state.maxSlots,
    // 参加者は改ざんされにくいfooterを正とし、表示用fieldからは復元しない。
    participants: state.participants,
  };
}
