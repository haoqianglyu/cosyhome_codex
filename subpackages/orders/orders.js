import api from "../../api/api.js";

const STATUS_MAP = {
  9: { text: '已完成', class: 'status-completed' }
};

Page({
  data: {
    orderList: [],
    // 服务类别 id->name 的映射
    categoriesMap: new Map(),
  },

  onLoad(options) {
    wx.setNavigationBarTitle({
      title: '工单列表'
    });
  },

  onShow() {
    this.loadCompletedOrders();
  },

  onPullDownRefresh() {
    this.loadCompletedOrders();
  },

  loadCompletedOrders() {
    wx.showLoading({ title: '加载中...' });
    const projectId = wx.getStorageSync("selected_home");
    const workOrderParams = {
      project_id: projectId,
      status: [9],
      page_options: { page: 1, limit: 0 }
    };

    console.log("发起API请求，参数：", workOrderParams);

    // 获取服务类别映射
    const fetchCategoriesPromise = new Promise((resolve) => {
      if (this.data.categoriesMap.size > 0) {
        return resolve(null);
      }
      api.work_order_categories({
        method: "POST", 
        data: {},
        header: { 
          "content-type": "application/json", 
          Authorization: wx.getStorageSync("access_token") 
        },
        success: (res) => resolve(res),
        fail: (error) => {
          console.warn("获取服务类别失败:", error);
          resolve(null);
        }
      });
    });

    // 获取已完成工单列表
    const fetchWorkOrdersPromise = new Promise((resolve, reject) => {
      api.work_order({
        method: "POST", 
        data: workOrderParams,
        header: { 
          "content-type": "application/json", 
          Authorization: wx.getStorageSync("access_token") 
        },
        success: (res) => resolve(res),
        fail: (error) => {
          console.error("获取工单列表失败:", error);
          reject(error);
        }
      });
    });

    Promise.allSettled([fetchCategoriesPromise, fetchWorkOrdersPromise])
      .then((results) => {
        const [categoriesResult, workOrdersResult] = results;
        
        // 处理服务类别数据
        if (categoriesResult.status === 'fulfilled' && categoriesResult.value && categoriesResult.value.data && Array.isArray(categoriesResult.value.data.entities)) {
          const categories = categoriesResult.value.data.entities;
          const newCategoriesMap = new Map();
          categories.forEach(cat => {
            newCategoriesMap.set(cat.id, cat.name);
          });
          this.setData({ categoriesMap: newCategoriesMap });
        }
        
        // 处理工单数据
        if (workOrdersResult.status === 'fulfilled') {
          this.handleApiResponse(workOrdersResult.value);
        } else {
          console.error("获取工单数据失败:", workOrdersResult.reason);
          wx.showToast({ title: '获取工单数据失败', icon: 'error' });
          this.setData({ orderList: [] });
        }  
      })
      .catch((error) => {
        console.error("数据加载异常:", error);
        wx.showToast({ title: '数据加载异常', icon: 'error' });
        this.setData({ orderList: [] });
      })
      .finally(() => {
        wx.hideLoading();
        wx.stopPullDownRefresh();
      });
  },

  handleApiResponse(res) {
    if (res && res.data && Array.isArray(res.data.entities)) {
      const orders = res.data.entities;
      const { categoriesMap } = this.data;

      const formattedOrders = orders.map(item => {
        const statusInfo = STATUS_MAP[item.status] || { text: '已完成', class: 'status-completed' };
        const orderTitle = (item.content || []).map(c => c.name).join('、') || '无服务内容';
        const serviceTypeName = categoriesMap.get(item.category_id) || '未分类';
        
        // 检查是否已评价：有score或review字段且不为空
        const hasRating = (item.score !== undefined && item.score !== null) || 
                         (item.review !== undefined && item.review !== null && item.review.trim() !== '');
        
        return { 
          ...item, 
          statusText: statusInfo.text, 
          statusClass: statusInfo.class, 
          title: orderTitle, 
          serviceType: serviceTypeName, 
          createdAt: item.created_at,
          hasRating: hasRating,
          ratingText: hasRating ? '已评价' : '未评价',
          ratingClass: hasRating ? 'rating-completed' : 'rating-pending'
        };
      });

      this.setData({ orderList: formattedOrders });
      console.log("已完成工单列表:", formattedOrders);
    } else {
      console.warn("没有找到已完成的工单:", res);
      this.setData({ orderList: [] });
    }
  },

  navigateToDetail(event) {
    const { id } = event.currentTarget.dataset;
    const orderData = this.data.orderList.find(item => item.id === id);
    if (orderData) {
      wx.navigateTo({
        url: `/subpackages/orderdetail/orderdetail?id=${id}`,
        success: (res) => res.eventChannel.emit('acceptDataFromOrdersPage', { data: orderData })
      });
    } else {
      console.error("未能找到ID为 " + id + " 的工单数据");
      wx.showToast({ title: '打开详情失败', icon: 'none' });
    }
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