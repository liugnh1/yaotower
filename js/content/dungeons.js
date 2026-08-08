// ===================== 深渊裂隙 — 秘境副本 v0.60 =====================
import { R } from '../core/registry.js';

// 七大秘境副本定义
R.registerAll('dungeons', {
  plains: {
    id:'plains', name:'裂地巢穴', icon:'🦏', floors:4,
    boss:'plains_lord', bossName:'平原领主',
    enemyPool:'plains',
    material:{ id:'scale_of_plains', name:'裂地之鳞', icon:'🛡️', desc:'用于攻击附魔' },
    unlock:'initial', unlockDesc:'初始解锁'
  },
  forest: {
    id:'forest', name:'森语遗迹', icon:'🌲', floors:4,
    boss:'forest_king', bossName:'苍古树精',
    enemyPool:'forest',
    material:{ id:'heart_of_forest', name:'千年树心', icon:'💚', desc:'用于生命附魔' },
    unlock:'initial', unlockDesc:'初始解锁'
  },
  cave: {
    id:'cave', name:'晶核矿洞', icon:'💎', floors:4,
    boss:'cave_behemoth', bossName:'晶石巨像',
    enemyPool:'cave',
    material:{ id:'core_of_cave', name:'不灭晶核', icon:'💎', desc:'用于防御附魔' },
    unlock:'initial', unlockDesc:'初始解锁'
  },
  ruins: {
    id:'ruins', name:'远古回廊', icon:'🗿', floors:4,
    boss:'ruin_gargoyle', bossName:'石像鬼',
    enemyPool:'ruins',
    material:{ id:'shard_of_ruins', name:'咒术残片', icon:'📜', desc:'用于暴击/暴伤附魔' },
    unlock:'clear_normal', unlockDesc:'通关普通难度后解锁'
  },
  frozen: {
    id:'frozen', name:'永冻冰窟', icon:'❄️', floors:4,
    boss:'frozen_eagle', bossName:'霜翼巨鹰',
    enemyPool:'frozen',
    material:{ id:'feather_of_frozen', name:'永冻之羽', icon:'🪶', desc:'用于穿透附魔' },
    unlock:'clear_normal', unlockDesc:'通关普通难度后解锁'
  },
  voidgate: {
    id:'voidgate', name:'虚空裂隙', icon:'🌀', floors:4,
    boss:'void_guardian', bossName:'虚空守门人',
    enemyPool:'voidgate',
    material:{ id:'prism_of_void', name:'虚空棱镜', icon:'🔮', desc:'用于吸血/元素附魔' },
    unlock:'clear_hell', unlockDesc:'通关炼狱难度后解锁'
  },
  tower: {
    id:'tower', name:'魔塔前厅', icon:'🛕', floors:4,
    boss:'tower_gatekeeper', bossName:'魔塔守门人',
    enemyPool:'tower',
    material:{ id:'mark_of_tower', name:'魔塔印记', icon:'⚜️', desc:'用于品质突破' },
    unlock:'key_purchase', unlockDesc:'首次购买钥匙后解锁'
  }
});

// 附魔定义（锻造台使用）
R.registerAll('dungeonEnchants', {
  atk:  { name:'蛮力', material:'scale_of_plains',  costs:[3,5,8,12,20], val:8,  max:5, desc:'攻击 +8/级' },
  hp:   { name:'生机', material:'heart_of_forest',  costs:[3,5,8,12,20], val:25, max:5, desc:'生命上限 +25/级' },
  def:  { name:'铁壁', material:'core_of_cave',     costs:[3,5,8,12,20], val:4,  max:5, desc:'防御 +4/级' },
  crit: { name:'致命', material:'shard_of_ruins',   costs:[3,5,8,12,20], val:3,  max:5, desc:'暴击率 +3%/级' },
  pen:  { name:'破甲', material:'feather_of_frozen',costs:[3,5,8,12,20], val:5,  max:5, desc:'穿透 +5%/级' },
  vamp: { name:'虚空', material:'prism_of_void',    costs:[5,10,20],     val:4,  max:3, desc:'吸血 +4%/级' },
  asc:  { name:'升华', material:'mark_of_tower',    costs:[5],           val:1,  max:1, desc:'品质提升一阶' }
});

// 符文石定义
R.registerAll('dungeonRunes', [
  { id:'fire',    name:'火符文', icon:'🔥', desc:'普攻15%附加燃烧', effect:'burn' },
  { id:'ice',     name:'冰符文', icon:'❄️', desc:'受击20%迟缓攻击者', effect:'slow' },
  { id:'dark',    name:'暗符文', icon:'🌑', desc:'击杀回复8%HP', effect:'lifesteal' },
  { id:'light',   name:'光符文', icon:'✨', desc:'每回合回复2%HP', effect:'regen' },
  { id:'thunder', name:'雷符文', icon:'⚡', desc:'暴击连锁伤害+30%', effect:'chain' }
]);
