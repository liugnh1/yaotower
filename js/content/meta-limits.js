// 局外成长上限配置
import { R } from '../core/registry.js';

R.registerAll('metaLimits', {
  atkBonus:      { max: 0.20, step: 0.02, cost: 1, name: "神力·攻", desc: "攻击力" },
  hpBonus:       { max: 0.20, step: 0.02, cost: 1, name: "神力·血", desc: "生命值" },
  defBonus:      { max: 0.20, step: 0.02, cost: 1, name: "神力·防", desc: "防御力" },
  critBonus:     { max: 0.10, step: 0.01, cost: 2, name: "神力·暴", desc: "暴击率" },
  goldBonus:     { max: 0.30, step: 0.03, cost: 1, name: "神力·财", desc: "金币获取" },
  startPotion:   { max: 3,    step: 1,    cost: 3, name: "初始药水", desc: "开局携带药水数量" },
  adRewardBonus: { max: 0.50, step: 0.05, cost: 2, name: "广告收益", desc: "广告天赋点额外比例" }
});
