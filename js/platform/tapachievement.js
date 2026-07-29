// ===================== TapTap 成就 =====================
const isTap = typeof tap !== 'undefined';

export const TapAchievement = {
  _mgr: null,

  init() {
    if (!isTap) return;
    try {
      if (tap.createAchievementManager) {
        this._mgr = tap.createAchievementManager({ toastEnable: true });
        this._mgr.registerListener({
          onAchievementSuccess: (code, achievement) => {
            console.log('[TapAchievement] 解锁成功:', achievement);
          },
          onAchievementFailure: (id, code, msg) => {
            console.warn('[TapAchievement] 解锁失败:', id, code, msg);
          }
        });
        console.log('[TapAchievement] 初始化完成');
      }
    } catch (e) {
      console.warn('[TapAchievement] 初始化失败');
    }
  },

  /** 解锁成就（与Game.unlockAchievement桥接） */
  unlock(id) {
    if (!this._mgr) return;
    try {
      this._mgr.unlockAchievement({ achievementId: id });
    } catch (e) {
      console.warn('[TapAchievement] 解锁调用失败:', id, e);
    }
  }
};
