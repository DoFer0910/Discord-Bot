/**
 * スプラトゥーン向け Discord ロール定義
 * カテゴリ別にロール名・ボタンラベル・色・絵文字を管理
 */

// 武器種カテゴリ
export const WEAPON_ROLES = [
  { id: 'shooter', label: 'シューター', emoji: '🔫', color: 0x4ade80 },
  { id: 'roller', label: 'ローラー', emoji: '🎨', color: 0xfbbf24 },
  { id: 'charger', label: 'チャージャー', emoji: '🎯', color: 0x60a5fa },
  { id: 'slosher', label: 'スロッシャー', emoji: '🪣', color: 0xa78bfa },
  { id: 'spinner', label: 'スピナー', emoji: '🌀', color: 0xf472b6 },
  { id: 'maneuver', label: 'マニューバー', emoji: '🔄', color: 0x34d399 },
  { id: 'shelter', label: 'シェルター', emoji: '🛡️', color: 0xfb923c },
  { id: 'blaster', label: 'ブラスター', emoji: '💥', color: 0xf87171 },
  { id: 'brush', label: 'フデ', emoji: '🖌️', color: 0x818cf8 },
  { id: 'stringer', label: 'ストリンガー', emoji: '🏹', color: 0x2dd4bf },
  { id: 'wiper', label: 'ワイパー', emoji: '⚔️', color: 0xe879f9 },
];

// やりたいモードカテゴリ
export const MODE_ROLES = [
  { id: 'bankara', label: 'バンカラマッチ', emoji: '⚡', color: 0xff6b2b },
  { id: 'xmatch', label: 'Xマッチ', emoji: '✨', color: 0x00d1ff },
  { id: 'salmonrun', label: 'サーモンラン', emoji: '🐟', color: 0xff8c00 },
];

// ウデマエ（ランク）カテゴリ
export const RANK_ROLES = [
  { id: 'rank_x', label: 'X', emoji: '👑', color: 0xfacc15 },
  { id: 'rank_s', label: 'S', emoji: '🌟', color: 0xf97316 },
  { id: 'rank_a', label: 'A', emoji: '🔴', color: 0xef4444 },
  { id: 'rank_b', label: 'B', emoji: '🟢', color: 0x22c55e },
  { id: 'rank_c', label: 'C', emoji: '🔵', color: 0x3b82f6 },
];

// モンスターハンター：ワールド／アイスボーン向けロールカテゴリ
// 既存のスプラトゥーン用IDと衝突しないよう、すべて mh_ プレフィックスを付ける。
export const MH_WEAPON_ROLES = [
  { id: 'mh_weapon_great_sword', label: '大剣', emoji: '⚔️', color: 0x64748b },
  { id: 'mh_weapon_long_sword', label: '太刀', emoji: '🗡️', color: 0x8b5cf6 },
  { id: 'mh_weapon_sword_shield', label: '片手剣', emoji: '🛡️', color: 0x0ea5e9 },
  { id: 'mh_weapon_dual_blades', label: '双剣', emoji: '⚔️', color: 0x06b6d4 },
  { id: 'mh_weapon_hammer', label: 'ハンマー', emoji: '🔨', color: 0xf59e0b },
  { id: 'mh_weapon_hunting_horn', label: '狩猟笛', emoji: '🎵', color: 0xec4899 },
  { id: 'mh_weapon_lance', label: 'ランス', emoji: '🛡️', color: 0x334155 },
  { id: 'mh_weapon_gunlance', label: 'ガンランス', emoji: '💣', color: 0xef4444 },
  { id: 'mh_weapon_switch_axe', label: 'スラッシュアックス', emoji: '🪓', color: 0xf97316 },
  { id: 'mh_weapon_charge_blade', label: 'チャージアックス', emoji: '🔋', color: 0x84cc16 },
  { id: 'mh_weapon_insect_glaive', label: '操虫棍', emoji: '🦗', color: 0x22c55e },
  { id: 'mh_weapon_light_bowgun', label: 'ライトボウガン', emoji: '🔫', color: 0x38bdf8 },
  { id: 'mh_weapon_heavy_bowgun', label: 'ヘビィボウガン', emoji: '🔫', color: 0x475569 },
  { id: 'mh_weapon_bow', label: '弓', emoji: '🏹', color: 0xa855f7 },
];

export const MH_RANK_ROLES = [
  { id: 'mh_rank_low', label: '下位', emoji: '🔰', color: 0x22c55e },
  { id: 'mh_rank_high', label: '上位', emoji: '⭐', color: 0xf59e0b },
  { id: 'mh_rank_master', label: 'マスターランク', emoji: '👑', color: 0x8b5cf6 },
];

export const MH_PLATFORM_ROLES = [
  { id: 'mh_platform_steam', label: 'Steam', emoji: '🖥️', color: 0x1e293b },
  { id: 'mh_platform_playstation', label: 'PlayStation', emoji: '🎮', color: 0x2563eb },
  { id: 'mh_platform_xbox', label: 'Xbox', emoji: '🎮', color: 0x16a34a },
];

export const MH_NOTIFICATION_ROLE = {
  id: 'mh_notification',
  label: 'モンハン募集通知',
  emoji: '📢',
  color: 0xdc2626,
  mentionable: true,
};

// 全ロール定義を統合して取得
export function getAllRoles() {
  return [
    ...WEAPON_ROLES,
    ...MODE_ROLES,
    ...RANK_ROLES,
    ...MH_WEAPON_ROLES,
    ...MH_RANK_ROLES,
    ...MH_PLATFORM_ROLES,
    MH_NOTIFICATION_ROLE,
  ];
}

// IDからロール定義を検索
export function findRoleById(id) {
  return getAllRoles().find(role => role.id === id) || null;
}
