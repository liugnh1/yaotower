// ===================== TapTap 云存档 =====================
// 仅在 TapTap 客户端内生效，浏览器环境自动降级为 localStorage

const isTap = typeof tap !== 'undefined';

export const TapSave = {
  _fs: null,
  _cloud: null,
  _basePath: '',

  /** 初始化（游戏启动时调用一次） */
  init() {
    if (!isTap) return;
    try {
      this._cloud = tap.getCloudSaveManager();
      this._fs = tap.getFileSystemManager();
      this._basePath = tap.env ? tap.env.USER_DATA_PATH : 'tapfile://usr';
      console.log('[TapSave] 初始化完成');
    } catch (e) {
      console.warn('[TapSave] 初始化失败，降级为localStorage', e);
    }
  },

  /** 获取远程存档列表 */
  async getArchiveList() {
    if (!this._cloud) return [];
    return new Promise((resolve) => {
      this._cloud.getArchiveList({
        success: (res) => resolve(res.saves || []),
        fail: () => resolve([])
      });
    });
  },

  /** 保存到云存档（同时写本地+上传） */
  async saveToCloud(slotName, gameData) {
    if (!this._cloud || !this._fs) return false;
    const filePath = this._basePath + '/' + slotName + '.json';
    const saveData = { ...gameData, _cloudSavedAt: Date.now() };

    return new Promise((resolve) => {
      // 1. 写本地 tapfile
      this._fs.writeFile({
        filePath,
        data: JSON.stringify(saveData),
        encoding: 'utf8',
        success: async () => {
          try {
            // 2. 检查是否已有该槽位
            const slots = await this.getArchiveList();
            const existing = slots.find(s => s.name === slotName);
            const options = {
              archiveMetaData: {
                name: slotName,
                summary: 'Floor:' + (gameData.totalFloor || 0),
                playtime: gameData._playTime || 0
              },
              archiveFilePath: filePath,
              success: () => { console.log('[TapSave] 上传成功:', slotName); resolve(true); },
              fail: (e) => { console.warn('[TapSave] 上传失败:', e); resolve(false); }
            };
            if (existing) {
              this._cloud.updateArchive({ archiveUUID: existing.uuid, ...options });
            } else {
              this._cloud.createArchive(options);
            }
          } catch (e) {
            console.warn('[TapSave] 云同步异常:', e);
            resolve(false);
          }
        },
        fail: (e) => { console.warn('[TapSave] 写本地失败:', e); resolve(false); }
      });
    });
  },

  /** 从云存档加载 */
  async loadFromCloud(slotName) {
    if (!this._cloud || !this._fs) return null;
    const slots = await this.getArchiveList();
    const slot = slots.find(s => s.name === slotName);
    if (!slot) return null;

    const targetPath = this._basePath + '/' + slotName + '_dl.json';
    return new Promise((resolve) => {
      this._cloud.getArchiveData({
        archiveUUID: slot.uuid,
        archiveFileId: slot.fileId,
        targetFilePath: targetPath,
        success: (res) => {
          this._fs.readFile({
            filePath: res.filePath,
            encoding: 'utf8',
            success: (fileRes) => {
              try { resolve(JSON.parse(fileRes.data)); }
              catch (e) { console.warn('[TapSave] JSON解析失败:', e); resolve(null); }
            },
            fail: () => resolve(null)
          });
        },
        fail: () => resolve(null)
      });
    });
  },

  /** 删除指定槽位云存档 */
  async deleteCloud(slotName) {
    if (!this._cloud) return;
    const slots = await this.getArchiveList();
    const slot = slots.find(s => s.name === slotName);
    if (!slot) return;
    this._cloud.deleteArchive({ archiveUUID: slot.uuid });
  },

  /** 清空所有云存档 */
  async clearCloud() {
    if (!this._cloud) return;
    try {
      const slots = await this.getArchiveList();
      for (const s of slots) { await this.deleteCloud(s.name); }
    } catch(e) {}
  }
};
