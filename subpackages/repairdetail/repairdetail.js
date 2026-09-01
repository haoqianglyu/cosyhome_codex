import api from "../../api/api.js";

const REPAIR_STATUS_MAP = {
    1: { text: '已反馈', class: 'status-pending' },
    2: { text: '处理中', class: 'status-processing' },
    3: { text: '已完成', class: 'status-completed' }
};

Page({
    data: {
        repair: {},
        attachments: [],
        detailLoading: true,
        loadError: "",
        attachmentLoading: false,
    },

    onLoad(options) {
        const eventChannel = this.getOpenerEventChannel();
        // Listen for data passed from the opener page
        if (eventChannel && eventChannel.on) {
            eventChannel.on('acceptDataFromServicePage', (data) => {
                const { data: repairData } = data;
                if (!repairData || !repairData.id) return;
                this.setData({ repair: this.formatRepair(repairData), detailLoading: false, loadError: "" });
                this.loadAttachments(repairData.id);
            });
        }

        if (options.id) {
            wx.nextTick(() => {
                if (!this.data.repair.id) {
                    this.loadRepairDetail(options.id);
                }
            });
        } else if (!eventChannel || !eventChannel.on) {
            this.setData({ detailLoading: false, loadError: "缺少报修记录编号" });
        }
    },

    loadRepairDetail(repairId) {
        api.get_repair_reports({
            method: "POST",
            data: {
                project_id: wx.getStorageSync("selected_home"),
                page_options: { page: 1, limit: 0 },
            },
            header: {
                "content-type": "application/json",
                Authorization: wx.getStorageSync("access_token"),
            },
            success: (res) => {
                if (this.data.repair.id) {
                    return;
                }
                const entities = res.data && Array.isArray(res.data.entities)
                    ? res.data.entities
                    : [];
                const repair = entities.find(
                    (item) => String(item.id) === String(repairId),
                );
                if (!repair) {
                    this.setData({ detailLoading: false, loadError: "未找到报修信息" });
                    wx.showToast({ title: "未找到报修信息", icon: "none" });
                    return;
                }
                this.setData({ repair: this.formatRepair(repair), detailLoading: false, loadError: "" });
                this.loadAttachments(repair.id);
            },
            fail: () => {
                this.setData({ detailLoading: false, loadError: "报修详情加载失败" });
                wx.showToast({ title: "报修详情加载失败", icon: "none" });
            },
        });
    },

    formatRepair(repair) {
        const status = REPAIR_STATUS_MAP[repair.status] || {
            text: "未知状态",
            class: "status-unknown",
        };
        return {
            ...repair,
            statusText: repair.statusText || status.text,
            statusClass: repair.statusClass || status.class,
            created_at: repair.created_at
                ? String(repair.created_at).replace("T", " ").slice(0, 19)
                : "-",
        };
    },

    loadAttachments(repairId) {
        if (String(this._attachmentsRepairId) === String(repairId)) {
            return;
        }
        this._attachmentsRepairId = repairId;
        this.setData({ attachmentLoading: true });
        api.get_repair_report_attachments({
            method: "POST",
            data: { repair_report_id: repairId },
            header: {
                "content-type": "application/json",
                Authorization: wx.getStorageSync("access_token")
            },
            success: (res) => {
                if (res && res.data && Array.isArray(res.data.repair_report_attachment_entities)) {
                    const entities = res.data.repair_report_attachment_entities;

                    if (entities.length === 0) {
                        this.setData({ attachments: [], attachmentLoading: false });
                        return;
                    }

                    // Fetch download URL for each attachment
                    const urlPromises = entities.map((entity, index) => {
                        return new Promise((resolve, reject) => {
                            api.get_repair_report_attachment_download_url(entity.id, {
                                method: "GET",
                                header: {
                                    Authorization: wx.getStorageSync("access_token")
                                },
                                success: (urlRes) => {
                                    let data = urlRes.data;
                                    // Handle case where data might be a JSON string
                                    if (typeof data === 'string') {
                                        try {
                                            data = JSON.parse(data);
                                        } catch (e) {
                                            console.error('Failed to parse response data:', e);
                                        }
                                    }

                                    if (data && /^https:\/\//i.test(String(data.url || ""))) {
                                        const filename = entity.filename || entity.name || '附件';
                                        const url = data.url;

                                        resolve({
                                            id: entity.id,
                                            name: filename,
                                            url: url,
                                            isImage: this.isImage(filename, url),
                                            type: 'image'
                                        });
                                    } else {
                                        reject(new Error('Failed to get download URL'));
                                    }
                                },
                                fail: (err) => {
                                    console.error(`Failed to get download URL for attachment ${index + 1}:`, err);
                                    reject(err);
                                }
                            });
                        });
                    });

                    Promise.allSettled(urlPromises)
                        .then(results => {
                            const attachments = results
                                .filter((result) => result.status === "fulfilled")
                                .map((result) => result.value);
                            this.setData({ attachments, attachmentLoading: false });
                            if (attachments.length !== entities.length) {
                                wx.showToast({ title: "部分附件加载失败", icon: "none" });
                            }
                        })
                        .catch(err => {
                            console.error("Failed to load attachment URLs", err);
                            this.setData({ attachments: [], attachmentLoading: false });
                        });
                } else {
                    this.setData({ attachments: [], attachmentLoading: false });
                }
            },
            fail: (err) => {
                console.error("Failed to load attachments", err);
                this.setData({ attachments: [], attachmentLoading: false });
            }
        });
    },

    isImage(filename, url) {
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

        // Check filename first
        if (filename) {
            const ext = filename.split('.').pop().toLowerCase();
            if (imageExts.includes(ext)) return true;
        }

        // Fallback to URL check
        if (url) {
            // Remove query parameters
            const cleanUrl = url.split('?')[0];
            const ext = cleanUrl.split('.').pop().toLowerCase();
            if (imageExts.includes(ext)) return true;
        }

        return false;
    },

    previewAttachment(e) {
        const { url } = e.currentTarget.dataset;
        const { attachments } = this.data;

        // Get all image URLs for preview
        const imageUrls = attachments
            .filter(item => item.isImage)
            .map(item => item.url);

        if (imageUrls.length > 0 && imageUrls.includes(url)) {
            wx.previewImage({
                current: url,
                urls: imageUrls
            });
        } else {
            wx.showToast({ title: '暂不支持预览此类型文件', icon: 'none' });
        }
    },

    onUnload() {
        this._attachmentsRepairId = null;
    },

    /**
   * 用户点击右上角分享
   */
    onShareAppMessage: function () {
        return {
            // 这里的 title 会显示在分享卡片上
            title: "HC健康舒适家",

            // 关键：把路径固定为你的 index 登录页
            path: "/pages/index/index",
        };
    },
});
