import api from "../../api/api.js";

const MAX_ATTACHMENTS = 9;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_SOURCE_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_CONTACT_NAME_LENGTH = 50;
const MAX_ADDRESS_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

function safeFilename(filename) {
    const basename = String(filename || "attachment")
        .split(/[\\/]/)
        .pop()
        .replace(/[\u0000-\u001f<>:"|?*]/g, "_");
    return basename.slice(0, 120) || "attachment";
}

// --- 工具类：处理文件扩展名和 MIME 类型 ---
const FileTypeUtils = {
    getExtension(filename) {
        if (!filename) return '';
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    },
    getFileType(filename) {
        const ext = this.getExtension(filename);
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
        if (imageExts.includes(ext)) return 'image';
        const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'm4v', '3gp'];
        if (videoExts.includes(ext)) return 'video';
        return 'file';
    },
    getMimeType(filename) {
        const ext = this.getExtension(filename);
        const mimeMap = {
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
            'bmp': 'image/bmp', 'webp': 'image/webp', 'svg': 'image/svg+xml',
            'mp4': 'video/mp4', 'avi': 'video/x-msvideo', 'mov': 'video/quicktime',
            'pdf': 'application/pdf', 'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'txt': 'text/plain', 'zip': 'application/zip'
        };
        return mimeMap[ext] || 'application/octet-stream';
    }
};

Page({
    data: {
        contactName: '',
        contactPhone: '',
        address: '',
        description: '',
        fileList: [],
        submitting: false,
        currentReportId: null // 新增：保存已创建的 report ID，防止重复创建
    },

    onLoad() {
        // 可以在这里预填用户信息
    },

    onNameChange(event) { this.setData({ contactName: event.detail }); },
    onPhoneChange(event) { this.setData({ contactPhone: event.detail }); },
    onAddressChange(event) { this.setData({ address: event.detail }); },
    onDescriptionChange(event) { this.setData({ description: event.detail }); },

    afterRead(event) {
        const { file } = event.detail;
        const { fileList } = this.data;
        const newFiles = Array.isArray(file) ? file : [file];

        // 初始化状态：status='ready', message=''
        const remainingCount = Math.max(
            MAX_ATTACHMENTS - fileList.length,
            0,
        );
        const acceptedFiles = newFiles
            .filter((item) => {
                if (!item || !item.url) return false;
                const filename = item.name || item.url;
                const isImage = FileTypeUtils.getFileType(filename) === 'image';
                const validSize = !item.size || item.size <= MAX_SOURCE_IMAGE_SIZE;
                return isImage && validSize;
            })
            .slice(0, remainingCount);
        if (acceptedFiles.length !== newFiles.length) {
            wx.showToast({
                title: '仅支持20MB以内的常见图片，最多9张',
                icon: 'none',
            });
        }
        const newUploads = acceptedFiles.map(item => ({
            ...item,
            name: safeFilename(item.name || String(item.url).split('/').pop()),
            status: 'ready',
            message: '',
            isCompressed: false // 标记是否已压缩，防止重试时重复压缩
        }));

        this.setData({
            fileList: [...fileList, ...newUploads]
        });
    },

    deleteFile(event) {
        const { index } = event.detail;
        const fileList = this.data.fileList.slice();
        fileList.splice(index, 1);
        this.setData({ fileList });
    },

    // 递归压缩图片
    recursiveCompress(filePath, targetSize, quality = 80) {
        return new Promise((resolve, reject) => {
            wx.compressImage({
                src: filePath,
                quality: quality,
                success: res => {
                    wx.getFileInfo({
                        filePath: res.tempFilePath,
                        success: (fileInfo) => {
                            if (fileInfo.size > targetSize && quality > 10) {
                                resolve(this.recursiveCompress(res.tempFilePath, targetSize, quality - 10));
                            } else {
                                resolve(res.tempFilePath);
                            }
                        },
                        fail: reject
                    });
                },
                fail: reject
            });
        });
    },

    // ---------------------------------------------------------
    // 交互：点击图片的处理 (修复版：解决 undefined 报错)
    // ---------------------------------------------------------
    onClickPreview(event) {
        // 1. 只从 event.detail 中获取索引
        const { index } = event.detail;

        // 2. 使用索引从我们自己的数据源中获取文件对象
        const fileList = this.data.fileList;
        const file = fileList[index];

        if (!file) {
            console.error('无法找到对应的文件对象, index:', index);
            return;
        }

        // 情况1：如果状态是失败，则触发手动重试
        if (file.status === 'failed') {
            if (!this.data.currentReportId) {
                wx.showToast({ title: '请先点击提交按钮', icon: 'none' });
                return;
            }
            this.retrySingleFile(index);
        }
        // 情况2：如果是正常图片 (done 或 ready)，执行预览
        else {
            const images = fileList
                .filter(item => item.status === 'done' || item.status === 'ready')
                .map(item => item.url);

            wx.previewImage({
                current: file.url,
                urls: images
            });
        }
    },

    // ---------------------------------------------------------
    // 提交主逻辑 (已加入 address 字段)
    // ---------------------------------------------------------
    submitFeedback() {
        // 1. 修改点：解构加入 address
        const contactName = String(this.data.contactName || '').trim();
        const contactPhone = String(this.data.contactPhone || '').trim();
        const address = String(this.data.address || '').trim();
        const description = String(this.data.description || '').trim();
        const { fileList, currentReportId } = this.data;

        if (!contactName) { wx.showToast({ title: '请填写联系人', icon: 'none' }); return; }
        if (contactName.length > MAX_CONTACT_NAME_LENGTH) { wx.showToast({ title: '联系人姓名过长', icon: 'none' }); return; }
        if (!contactPhone) { wx.showToast({ title: '请填写联系电话', icon: 'none' }); return; }
        if (!/^[0-9+\-\s]{6,20}$/.test(contactPhone)) { wx.showToast({ title: '联系电话格式不正确', icon: 'none' }); return; }
        // 2. 修改点：加入地址非空校验
        if (!address) { wx.showToast({ title: '请填写详细地址', icon: 'none' }); return; }
        if (address.length > MAX_ADDRESS_LENGTH) { wx.showToast({ title: '详细地址不能超过200个字符', icon: 'none' }); return; }
        if (!description) { wx.showToast({ title: '请填写问题描述', icon: 'none' }); return; }
        if (description.length > MAX_DESCRIPTION_LENGTH) { wx.showToast({ title: '问题描述不能超过2000个字符', icon: 'none' }); return; }

        if (this.data.submitting) return;

        if (!wx.getStorageSync("selected_home")) {
            wx.showToast({ title: '请先选择项目', icon: 'none' });
            return;
        }

        // 断点续传逻辑
        if (currentReportId) {
            this.setData({ submitting: true });
            this.uploadAllFiles(currentReportId);
            return;
        }

        this.setData({ submitting: true });
        wx.showLoading({ title: '提交中...', mask: true });

        const projectId = wx.getStorageSync("selected_home");
        const params = {
            project_id: projectId,
            name: contactName,
            phone: contactPhone,
            description: description,
            // 3. 修改点：将地址传给后端
            address: address
        };

        // 1. 创建报表
        api.create_repair_report({
            method: "POST",
            data: params,
            header: {
                "content-type": "application/json",
                Authorization: wx.getStorageSync("access_token")
            },
            success: (res) => {
                if (res && res.data && res.data.id) {
                    const reportId = res.data.id;
                    this.setData({ currentReportId: reportId }); // 保存 ID
                    if (fileList.length > 0) {
                        this.uploadAllFiles(reportId);
                    } else {
                        this.handleSubmitSuccess();
                    }
                } else {
                    this.handleFail('提交失败，请重试');
                }
            },
            fail: (err) => {
                console.error(err);
                this.handleFail('网络错误，提交失败');
            }
        });
    },

    // ---------------------------------------------------------
    // 批量上传控制器 (修复版：增加 1/N 进度提示)
    // ---------------------------------------------------------
    async uploadAllFiles(reportId) {
        const { fileList } = this.data;
        let hasError = false;

        for (let i = 0; i < fileList.length; i++) {
            // 跳过已成功的
            if (fileList[i].status === 'done') continue;

            const progressText = `上传中 ${i + 1}/${fileList.length}`;
            wx.showLoading({ title: progressText, mask: true });

            try {
                // 执行带自动重试的单文件上传
                await this.uploadFileWithAutoRetry(i, reportId);
            } catch (error) {
                console.error(`File ${i} upload failed after retry`);
                hasError = true;
                // 不中断循环，继续尝试上传下一张
            }
        }

        this.setData({ submitting: false });
        wx.hideLoading();

        if (hasError) {
            wx.showToast({ title: '部分上传失败，请点击图片重试', icon: 'none', duration: 3500 });
        } else {
            this.handleSubmitSuccess();
        }
    },

    // ---------------------------------------------------------
    // 手动重试单个文件
    // ---------------------------------------------------------
    async retrySingleFile(index) {
        if (this._retryPending) return;
        this._retryPending = true;
        const reportId = this.data.currentReportId;
        wx.showLoading({ title: '重试中...', mask: true });

        try {
            await this.uploadFileWithAutoRetry(index, reportId);
            wx.hideLoading();

            // 检查是否全部完成
            const allDone = this.data.fileList.every(f => f.status === 'done');
            if (allDone) {
                this.handleSubmitSuccess();
            } else {
                wx.showToast({ title: '重试成功', icon: 'success' });
            }
        } catch (e) {
            wx.hideLoading();
            wx.showToast({ title: '重试失败，请检查网络', icon: 'none' });
        } finally {
            this._retryPending = false;
        }
    },

    // ---------------------------------------------------------
    // 核心逻辑：带自动重试的单文件上传
    // ---------------------------------------------------------
    async uploadFileWithAutoRetry(index, reportId) {
        this.updateFileStatus(index, 'uploading', '上传中...');

        try {
            // --- 第一次尝试 ---
            await this.performSingleFileUpload(index, reportId);
            this.updateFileStatus(index, 'done', '上传成功');
        } catch (firstError) {
            console.warn(`附件 ${index + 1} 首次上传失败，正在自动重试`);

            // --- 自动第二次尝试 ---
            this.updateFileStatus(index, 'uploading', '重试中...');
            try {
                await this.performSingleFileUpload(index, reportId);
                this.updateFileStatus(index, 'done', '上传成功');
            } catch (secondError) {
                // --- 彻底失败 ---
                console.error(`Index ${index} second attempt failed`, secondError);
                this.updateFileStatus(index, 'failed', '点击重试');
                throw secondError;
            }
        }
    },

    // ---------------------------------------------------------
    // 底层逻辑：压缩 -> 获取URL -> 上传 (PUT)
    // ---------------------------------------------------------
    async performSingleFileUpload(index, reportId) {
        const fs = wx.getFileSystemManager();
        const file = this.data.fileList[index];

        if (!file || !file.url) {
            throw new Error('附件文件不存在');
        }

        let processedUrl = file.url;

        // 1. 预处理 (图片压缩)
        const fileName = safeFilename(file.name || String(file.url).split('/').pop());
        const fileType = FileTypeUtils.getFileType(fileName);
        const sourceFileInfo = await new Promise((resolve, reject) => {
            wx.getFileInfo({ filePath: file.url, success: resolve, fail: reject });
        });
        if (sourceFileInfo.size > MAX_SOURCE_IMAGE_SIZE) {
            throw new Error('图片大小不能超过20MB');
        }

        if (fileType === 'image' && sourceFileInfo.size > MAX_IMAGE_SIZE && !file.isCompressed) {
            processedUrl = await this.recursiveCompress(file.url, MAX_IMAGE_SIZE);
            this.setData({
                [`fileList[${index}].url`]: processedUrl,
                [`fileList[${index}].isCompressed`]: true
            });
        }

        const processedFileInfo = await new Promise((resolve, reject) => {
            wx.getFileInfo({ filePath: processedUrl, success: resolve, fail: reject });
        });
        if (processedFileInfo.size > MAX_IMAGE_SIZE) {
            throw new Error('图片压缩后仍超过5MB');
        }

        // 2. 获取 Content-Type
        const finalFileName = safeFilename(file.name || processedUrl.split('/').pop());
        const contentType = FileTypeUtils.getMimeType(finalFileName);

        // 3. 调接口获取上传 URL
        const uploadInfo = await new Promise((resolve, reject) => {
            api.create_repair_report_attachment({
                method: "POST",
                data: {
                    repair_report_id: reportId,
                    filename: finalFileName,
                    name: finalFileName,
                    content_type: contentType
                },
                header: {
                    "content-type": "application/json",
                    Authorization: wx.getStorageSync("access_token")
                },
                success: (res) => {
                    if (res && res.data && res.data.url) resolve(res.data);
                    else reject(new Error('无法获取上传地址'));
                },
                fail: (err) => reject(err)
            });
        });
        if (!/^https:\/\//i.test(uploadInfo.url)) {
            throw new Error('上传地址必须使用 HTTPS');
        }

        // 4. 读取文件数据
        const fileData = await new Promise((resolve, reject) => {
            fs.readFile({
                filePath: processedUrl,
                success: (res) => {
                    if (!res.data || res.data.byteLength === 0) reject(new Error('文件为空'));
                    else resolve(res.data);
                },
                fail: (err) => reject(err)
            });
        });

        // 5. 执行 PUT 请求
        await new Promise((resolve, reject) => {
            wx.request({
                url: uploadInfo.url,
                method: 'PUT',
                timeout: 60000,
                header: { 'Content-Type': contentType },
                data: fileData,
                success: (res) => {
                    if (res.statusCode >= 200 && res.statusCode < 300) resolve();
                    else reject(new Error(`Upload failed with status: ${res.statusCode}`));
                },
                fail: (err) => reject(err)
            });
        });
    },

    updateFileStatus(index, status, message) {
        this.setData({
            [`fileList[${index}].status`]: status,
            [`fileList[${index}].message`]: message
        });
    },

    handleFail(msg) {
        wx.hideLoading();
        this.setData({ submitting: false });
        wx.showToast({ title: msg, icon: 'none' });
    },

    handleSubmitSuccess() {
        wx.hideLoading();
        this.setData({ submitting: false, currentReportId: null });
        wx.showToast({ title: '提交成功', icon: 'success' });
        this._navigateTimer = setTimeout(() => {
            wx.navigateBack();
        }, 1500);
    },

    onUnload() {
        clearTimeout(this._navigateTimer);
        this._navigateTimer = null;
        this._retryPending = false;
        wx.hideLoading();
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
