import Dialog from '@vant/weapp/dialog/dialog';
import api from '../../api/api.js';

const STATUS_MAP = {
  9: { text: '已完成', class: 'status-completed' }
};

Page({
  data: {
    orderInfo: null,
    checkedServiceContent: [],
    completionDescription: '',
    fileList: [],
    // 评价相关数据
    rating: 5,
    review: '',
    submitting: false,
    // 是否已经评价过
    hasRated: false,
    existingScore: 0,
    existingReview: '',
    loading: true,
    loadError: '',
  },

  initialMainData: null,

  onLoad(options) {
    wx.setNavigationBarTitle({
      title: '工单详情'
    });
    
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel && typeof eventChannel.on === 'function') eventChannel.on('acceptDataFromOrdersPage', (res) => {
      if (!res || !res.data || !res.data.id) return;
      this.initialMainData = res.data; 
      this.fetchLogsAndSetAllData(res.data);
    });
    if (options.id) {
      wx.nextTick(() => {
        if (!this.initialMainData) this.loadOrderById(options.id);
      });
    } else if (!eventChannel || typeof eventChannel.on !== 'function') {
      this.setData({ loading: false, loadError: '缺少工单编号' });
    }
  },

  loadOrderById(orderId) {
    api.work_order({
      method: 'POST',
      header: { 'content-type': 'application/json', Authorization: wx.getStorageSync('access_token') },
      data: {
        project_id: wx.getStorageSync('selected_home'),
        status: [9],
        page_options: { page: 1, limit: 0 },
      },
      success: (res) => {
        if (this.initialMainData) return;
        const entities = res.data && Array.isArray(res.data.entities) ? res.data.entities : [];
        const order = entities.find((item) => String(item.id) === String(orderId));
        if (!order) {
          this.setData({ loading: false, loadError: '未找到工单信息' });
          return;
        }
        this.initialMainData = order;
        this.fetchLogsAndSetAllData(order);
      },
      fail: () => this.setData({ loading: false, loadError: '工单详情加载失败' }),
    });
  },

  onShow() {
    
  },

  onPullDownRefresh() {
    wx.stopPullDownRefresh();
  },


  fetchLogsAndSetAllData(mainData) {
    if (!mainData || !mainData.id || this._detailRequestPending) return;
    this._detailRequestPending = true;
    this.setData({ loading: true, loadError: '' });
    wx.showLoading({ title: '加载详情...' });

    const logsPromise = new Promise((resolve, reject) => {
      api.work_order_logs(mainData.id, {
        method: 'POST',
        header: { "content-type": "application/json", Authorization: wx.getStorageSync("access_token") },
        data: { code: mainData.code },
        success: resolve,
        fail: reject
      });
    });

    const attachmentsPromise = new Promise((resolve, reject) => {
      const needsAttachments = [4, 5, 7, 9].includes(mainData.status);
      if (!needsAttachments) {
        return resolve([]); 
      }
      api.get_attachment({
        method: 'POST',
        header: { "content-type": "application/json", Authorization: wx.getStorageSync("access_token") },
        data: { work_order_id: mainData.id },
        success: (listRes) => {
          if (listRes.statusCode !== 200) return reject(listRes);
          const entities = listRes.data && listRes.data.work_order_attachment_entities;
          if (!Array.isArray(entities) || entities.length === 0) return resolve([]);
          
          const urlFetchPromises = entities.map(entity => {
            return new Promise((urlResolve, urlReject) => {
              api.attachment_download(entity.id, {
                method: 'GET',
                header: { Authorization: wx.getStorageSync("access_token") },
                success: (urlRes) => {
                  if (urlRes.statusCode === 200 && urlRes.data && /^https:\/\//i.test(String(urlRes.data.url || ''))) {
                    urlResolve({ id: entity.id, url: urlRes.data.url, isImage: true });
                  } else {
                    urlReject(urlRes);
                  }
                },
                fail: urlReject
              });
            });
          });
          Promise.allSettled(urlFetchPromises).then((results) => {
            resolve(results.filter((item) => item.status === 'fulfilled').map((item) => item.value));
          });
        },
        fail: reject
      });
    });

    Promise.all([logsPromise, attachmentsPromise])
      .then(([logsRes, finalFileList]) => {
        let timelineSteps = [], completionText = '', reviewer = '', reviewTime = '', reviewComments = '';
        if (logsRes.statusCode === 200 && logsRes.data && logsRes.data.log) {
          try {
            const logs = JSON.parse(logsRes.data.log);
            if (Array.isArray(logs)) {
              const completionLogs = logs.filter(log => log.status === 5);
              if (completionLogs.length > 0) {
                const latestCompletionLog = completionLogs[completionLogs.length - 1];
                if (latestCompletionLog && latestCompletionLog.desc) completionText = latestCompletionLog.desc;
              }
              const reviewLogs = logs.filter(log => log.status === 7 || log.status === 9);
              if (reviewLogs.length > 0) {
                const latestReviewLog = reviewLogs[reviewLogs.length - 1];
                reviewer = latestReviewLog.operator || '未知';
                reviewTime = latestReviewLog.date || '未知';
                reviewComments = latestReviewLog.desc || '无';
              }
              timelineSteps = logs.map((log, index) => ({
                key: `${log.date || "unknown"}-${index}`,
                text: `${log.operator} ${log.operation}`, date: log.date, desc: log.desc || ''
              }));
            }
          } catch (e) { console.error("解析日志JSON失败", e); }
        }

        const serviceContent = Array.isArray(mainData.content) ? mainData.content : [];
        const serviceContentFormatted = serviceContent.map(item => ({
          id: item.id, text: item.name, hint: item.desc || '暂无说明',
        }));
        const initialChecked = serviceContent.filter(item => item.status === true).map(item => item.id);
        
        const finalOrderInfo = {
          id: mainData.id, name: mainData.name, status: mainData.status, title: mainData.title,
          statusText: mainData.statusText || (STATUS_MAP[mainData.status] || { text: '未知状态' }).text,
          statusClass: mainData.statusClass || (STATUS_MAP[mainData.status] || { class: 'status-unknown' }).class,
          projectId: mainData.project_id, projectName: mainData.project_name,
          customerName: mainData.user_name, phone: mainData.phone, address: mainData.address || '暂无地址',
          appointmentDate: mainData.service_date, serviceType: mainData.serviceType || '未分类',
          serviceContent: serviceContentFormatted,
          remarks: mainData.remark || '无',
          completionTime: mainData.completionTime || '', reviewTime: reviewTime,
          reviewComments: reviewComments, reviewer: reviewer,
          timeline: timelineSteps,
        };
        
        // 检查是否已经评价过
        const hasExistingRating = mainData.score != null || String(mainData.review || '').trim() !== '';
        
        this.setData({
          orderInfo: finalOrderInfo,
          checkedServiceContent: initialChecked,
          completionDescription: completionText,
          fileList: finalFileList,
          // 评价相关数据
          hasRated: hasExistingRating,
          existingScore: mainData.score || 0,
          existingReview: mainData.review || '',
          loading: false,
          loadError: '',
        });
      })
      .catch(error => {
        console.error("加载工单详情失败:", error);
        this.setData({ loading: false, loadError: '详情加载失败' });
        wx.showToast({ title: '详情加载失败', icon: 'error' });
      })
      .finally(() => {
        this._detailRequestPending = false;
        wx.hideLoading();
      });
  },
  
  showTimelineDesc(event) {
    Dialog.alert({
      context: this, title: '备注详情', message: event.currentTarget.dataset.desc,
      theme: 'round-button', confirmButtonColor: '#ffffff'
    });
  },

  // 评分变化事件
  onRatingChange(event) {
    this.setData({
      rating: event.detail
    });
  },

  // 评价内容变化事件
  onReviewChange(event) {
    this.setData({
      review: String(event.detail || '').slice(0, 500)
    });
  },

  // 提交评价
  submitRating() {
    if (this.data.submitting) return;
    if (!this.data.orderInfo || !this.data.orderInfo.id) {
      wx.showToast({ title: '工单信息不存在', icon: 'none' });
      return;
    }

    if (this.data.rating === 0) {
      wx.showToast({ title: '请先进行评分', icon: 'none' });
      return;
    }

    const review = String(this.data.review || '').trim();
    if (!review) {
      wx.showToast({ title: '请输入评价内容', icon: 'none' });
      return;
    }

    if (review.length > 500) {
      wx.showToast({ title: '评价内容不能超过500个字符', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    api.modify_order(this.data.orderInfo.id, {
      method: 'POST',
      header: { "content-type": "application/json", Authorization: wx.getStorageSync("access_token") },
      data: { 
        score: this.data.rating,
        review
      },
      success: (res) => {
        if (res.statusCode === 200) {
          wx.showToast({ title: '评价提交成功', icon: 'success' });
          // 立即更新本地状态，防止重复提交
          const submittedRating = this.data.rating;
          const submittedReview = review;
          this.setData({
            hasRated: true,
            existingScore: submittedRating,
            existingReview: submittedReview,
            // 清空输入表单状态
            rating: 5,
            review: ''
          });
          // 不刷新页面数据，保持当前已评价状态
          // 因为API可能还没有立即更新，刷新会导致重新显示输入表单
        } else {
          wx.showToast({ title: '评价提交失败', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('评价提交错误:', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: () => {
        this.setData({ submitting: false });
      }
    });
  },

  onUnload() {
    this._detailRequestPending = false;
  },

  onShareAppMessage: function () {
    return {
      // 这里的 title 会显示在分享卡片上
      title: "HC健康舒适家",

      // 关键：把路径固定为你的 index 登录页
      path: "/pages/index/index",
    };
  },
});
