// ===================== TapTap 排行榜 =====================
const isTap = typeof tap !== 'undefined';

// 排行榜ID（需在TapTap开发者中心创建后替换）
const LEADERBOARD_IDS = {
  daily: 'daily_challenge_01',    // 每日挑战排行
  total: 'total_floor_01',        // 最高层数排行
};

export const TapLeaderboard = {
  _mgr: null,

  init() {
    if (!isTap) return;
    try {
      this._mgr = tap.getLeaderboardManager();
      console.log('[TapLeaderboard] 初始化完成');
    } catch (e) {
      console.warn('[TapLeaderboard] 初始化失败');
    }
  },

  /** 提交分数 */
  submitScore(leaderboardId, score) {
    if (!this._mgr) return;
    const id = LEADERBOARD_IDS[leaderboardId] || leaderboardId;
    this._mgr.submitScores({
      scores: [{ leaderboardId: id, score }],
      callback: {
        onSuccess: () => console.log('[TapLeaderboard] 提交成功:', id, score),
        onFailure: (code, msg) => console.warn('[TapLeaderboard] 提交失败:', code, msg)
      }
    });
  },

  /** 打开排行榜UI面板 */
  showPanel(leaderboardId) {
    if (!this._mgr) return false;
    const id = LEADERBOARD_IDS[leaderboardId] || leaderboardId;
    this._mgr.openLeaderboard({
      leaderboardId: id,
      callback: {
        onSuccess: () => {},
        onFailure: (code, msg) => console.warn('[TapLeaderboard] 打开失败:', code, msg)
      }
    });
    return true;
  },

  /** 获取我的排名 */
  async getMyRank(leaderboardId) {
    if (!this._mgr) return null;
    const id = LEADERBOARD_IDS[leaderboardId] || leaderboardId;
    return new Promise((resolve) => {
      this._mgr.loadCurrentPlayerLeaderboardScore({
        leaderboardId: id,
        callback: {
          onSuccess: (res) => resolve(res),
          onFailure: () => resolve(null)
        }
      });
    });
  }
};
