import api from "../../api/api.js";

const REPAIR_STATUS_MAP = {
    0: { text: '待处理', class: 'status-pending' },
    1: { text: '处理中', class: 'status-processing' },
    2: { text: '已完成', class: 'status-completed' }
};

Page({
    data: {
        repair: {},
        attachments: []
    },

    onLoad(options) {
        const eventChannel = this.getOpenerEventChannel();
        // Listen for data passed from the opener page
        if (eventChannel && eventChannel.on) {
            eventChannel.on('acceptDataFromServicePage', (data) => {
                const { data: repairData } = data;

                // 只要 repairData 里有 address 字段，wxml 就能自动显示
                this.setData({ repair: repairData });
                this.loadAttachments(repairData.id);
            });
        }

        // Fallback if data not passed via event channel (e.g. direct open with ID)
        if (!this.data.repair.id && options.id) {
            console.log("Repair ID from options:", options.id);
            this.loadAttachments(options.id);
            // 注意：如果是直接通过 ID 进入页面，repair 对象可能不完整
            // 如果需要完整信息（包括地址），可能需要在这里调用 api.get_repair_detail(options.id)
        }
    },

    loadAttachments(repairId) {
        console.log('Loading attachments for repair ID:', repairId);
        api.get_repair_report_attachments({
            method: "POST",
            data: { repair_report_id: repairId },
            header: {
                "content-type": "application/json",
                Authorization: wx.getStorageSync("access_token")
            },
            success: (res) => {
                console.log('Attachments list response:', res);
                if (res && res.data && Array.isArray(res.data.repair_report_attachment_entities)) {
                    const entities = res.data.repair_report_attachment_entities;
                    console.log('Found', entities.length, 'attachments');

                    if (entities.length === 0) {
                        this.setData({ attachments: [] });
                        return;
                    }

                    // Fetch download URL for each attachment
                    const urlPromises = entities.map((entity, index) => {
                        return new Promise((resolve, reject) => {
                            console.log(`Fetching download URL for attachment ${index + 1}/${entities.length}, ID:`, entity.id);
                            api.get_repair_report_attachment_download_url(entity.id, {
                                method: "GET",
                                header: {
                                    Authorization: wx.getStorageSync("access_token")
                                },
                                success: (urlRes) => {
                                    console.log(`Download URL response for attachment ${index + 1}:`, urlRes);
                                    let data = urlRes.data;
                                    // Handle case where data might be a JSON string
                                    if (typeof data === 'string') {
                                        try {
                                            data = JSON.parse(data);
                                        } catch (e) {
                                            console.error('Failed to parse response data:', e);
                                        }
                                    }

                                    if (data && data.url) {
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

                    Promise.all(urlPromises)
                        .then(attachments => {
                            console.log('All download URLs fetched successfully:', attachments);
                            this.setData({ attachments });
                        })
                        .catch(err => {
                            console.error("Failed to load attachment URLs", err);
                            this.setData({ attachments: [] });
                        });
                } else {
                    console.log('No attachments found in response');
                    this.setData({ attachments: [] });
                }
            },
            fail: (err) => {
                console.error("Failed to load attachments", err);
                this.setData({ attachments: [] });
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