/**
 * スプラトゥーン向け Discord ロール定義
 * カテゴリ別にロール名・ボタンラベル・色・絵文字を管理
 */

// 武器種カテゴリ
export const WEAPON_ROLES = [
  { id: 'shooter',    label: 'シューター',     emoji: '🔫', color: 0x4ade80 },
  { id: 'roller',     label: 'ローラー',       emoji: '🎨', color: 0xfbbf24 },
  { id: 'charger',    label: 'チャージャー',   emoji: '🎯', color: 0x60a5fa },
  { id: 'slosher',    label: 'スロッシャー',   emoji: '🪣', color: 0xa78bfa },
  { id: 'spinner',    label: 'スピナー',       emoji: '🌀', color: 0xf472b6 },
  { id: 'maneuver',   label: 'マニューバー',   emoji: '🔄', color: 0x34d399 },
  { id: 'shelter',    label: 'シェルター',     emoji: '🛡️', color: 0xfb923c },
  { id: 'blaster',    label: 'ブラスター',     emoji: '💥', color: 0xf87171 },
  { id: 'brush',      label: 'フデ',           emoji: '🖌️', color: 0x818cf8 },
  { id: 'stringer',   label: 'ストリンガー',   emoji: '🏹', color: 0x2dd4bf },
  { id: 'wiper',      label: 'ワイパー',       emoji: '⚔️', color: 0xe879f9 },
];

// やりたいモードカテゴリ
export const MODE_ROLES = [
  { id: 'bankara',    label: 'バンカラマッチ', emoji: '⚡', color: 0xff6b2b },
  { id: 'xmatch',     label: 'Xマッチ',       emoji: '✨', color: 0x00d1ff },
  { id: 'salmonrun',  label: 'サーモンラン',   emoji: '🐟', color: 0xff8c00 },
];

// 全ロール定義を統合して取得
export function getAllRoles() {
  return [...WEAPON_ROLES, ...MODE_ROLES];
}

// IDからロール定義を検索
export function findRoleById(id) {
  return getAllRoles().find(role => role.id === id) || null;
}
