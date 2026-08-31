import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MH_NOTIFICATION_ROLE,
  MH_PLATFORM_ROLES,
  MH_RANK_ROLES,
  MH_WEAPON_ROLES,
  getAllRoles,
} from '../src/roles.js';
import {
  applyHuntAction,
  createHuntPayload,
  createHuntState,
  deserializeHuntState,
  getHuntStateFromMessage,
  serializeHuntState,
} from '../src/mh.js';
import { createHuntAllowedMentions } from '../src/interactions.js';

test('モンハン用ロールは14武器種・3ランク・3機種・通知ロールでIDが衝突しない', () => {
  assert.equal(MH_WEAPON_ROLES.length, 14);
  assert.equal(MH_RANK_ROLES.length, 3);
  assert.equal(MH_PLATFORM_ROLES.length, 3);
  assert.equal(MH_NOTIFICATION_ROLE.label, 'モンハン募集通知');
  assert.equal(MH_NOTIFICATION_ROLE.mentionable, true);
  const ids = getAllRoles().map(role => role.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(MH_WEAPON_ROLES.every(role => role.id.startsWith('mh_')));
});

test('募集状態はfooterへ保存でき、Embedから表示情報とともに復元できる', () => {
  const state = createHuntState({
    ownerId: 'owner',
    ownerName: '主催者',
    target: '歴戦王ネルギガンテ',
    purpose: '素材集め',
    maxSlots: 3,
    voice: true,
    startAt: '21:00',
  });
  const compact = deserializeHuntState(serializeHuntState(state));
  assert.equal(compact.ownerId, 'owner');
  assert.equal(compact.maxSlots, 3);
  assert.equal(compact.target, undefined, '自由入力はfooterへ重複保存しない');

  const message = { embeds: [createHuntPayload(state).embeds[0]] };
  const restored = getHuntStateFromMessage(message);
  assert.equal(restored.target, '歴戦王ネルギガンテ');
  assert.equal(restored.purpose, '素材集め');
  assert.equal(restored.voice, true);
  assert.equal(restored.startAt, '21:00');
});

test('参加・辞退・重複・満員・主催者限定締切を判定する', () => {
  let state = createHuntState({ ownerId: 'owner', ownerName: '主催者', target: '任務', purpose: '攻略', maxSlots: 1 });
  let result = applyHuntAction(state, 'join', { id: 'alice', name: 'Alice' });
  assert.equal(result.error, undefined);
  state = result.state;
  assert.equal(state.participants.length, 1);
  assert.match(applyHuntAction(state, 'join', { id: 'alice', name: 'Alice' }).error, /すでに/);
  assert.match(applyHuntAction(state, 'join', { id: 'bob', name: 'Bob' }).error, /達して/);
  assert.match(applyHuntAction(state, 'close', { id: 'alice', name: 'Alice' }).error, /主催者/);
  result = applyHuntAction(state, 'leave', { id: 'alice', name: 'Alice' });
  state = result.state;
  assert.equal(state.participants.length, 0);
  state = applyHuntAction(state, 'close', { id: 'owner', name: '主催者' }).state;
  assert.equal(state.status, 'closed');
  assert.match(applyHuntAction(state, 'join', { id: 'bob', name: 'Bob' }).error, /締め切/);
});

test('募集メッセージは参加枠・参加者と3つの操作ボタンを含む', () => {
  const state = createHuntState({ ownerId: 'owner', ownerName: '主催者', target: 'クエスト', purpose: '周回', maxSlots: 2 });
  const payload = createHuntPayload(state, '<@&role-id> 募集開始');
  assert.equal(payload.content, '<@&role-id> 募集開始');
  assert.equal(payload.components[0].components.length, 3);
  assert.match(payload.embeds[0].fields.find(field => field.name.startsWith('募集人数')).value, /残り 2枠/);
  assert.match(payload.embeds[0].footer.text, /^mh-hunt:v1:/);
});

test('自由入力の最大長、footer、Embed、custom_idのDiscord制約を守る', () => {
  const maxText = 'あ'.repeat(1000);
  const state = createHuntState({ ownerId: 'owner', ownerName: '主催者', target: maxText, purpose: maxText, maxSlots: 3 });
  const payload = createHuntPayload(state);
  assert.ok(payload.embeds[0].fields.every(field => field.value.length <= 1024));
  assert.ok(payload.embeds[0].footer.text.length <= 2048);
  assert.ok(payload.components[0].components.every(button => button.custom_id.length <= 100));
  assert.throws(() => createHuntState({ ownerId: 'owner', ownerName: '主催者', target: `${maxText}あ`, purpose: '目的', maxSlots: 1 }));
  assert.throws(() => createHuntState({ ownerId: 'owner', ownerName: '主催者', target: '対象', purpose: `${maxText}あ`, maxSlots: 1 }));
});

test('募集通知のallowed_mentionsは通知ロールだけを許可し、ロールなしでは全mentionを無効化する', () => {
  assert.deepEqual(createHuntAllowedMentions({ id: 'role-1' }), {
    roles: ['role-1'], users: [], replied_user: false,
  });
  assert.deepEqual(createHuntAllowedMentions(null), { parse: [], replied_user: false });
});
