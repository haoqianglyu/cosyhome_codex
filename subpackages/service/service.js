import api from "../../api/api.js";

const ORDER_STATUS_MAP = {
    9: { text: '已完成', class: 'status-completed' }
};

// --- 修改点1：在这里配置颜色映射，与CSS保持一致 ---
const REPAIR_STATUS_MAP = {
    1: { text: '已反馈', class: 'status-pending', color: '#ff976a' },    // 对应CSS的橙色
    2: { text: '处理中', class: 'status-processing', color: '#1989fa' }, // 对应CSS的蓝色
    3: { text: '已完成', class: 'status-completed', color: '#07c160' }   // 对应CSS的绿色
};

Page({
    data: {
        currentTab: 0,
        repairList: [],
        orderList: [],
        categoriesMap: new Map(),
        isRepairRefreshing: false,
        isOrderRefreshing: false,
    },

    onLoad(options) {
        wx.setNavigationBarTitle({
            title: '报修工单'
        });
        if (options.tab) {
            this.setData({ currentTab: parseInt(options.tab) });
        }
    },

    onShow() {
        this.loadData();
    },

    switchTab(e) {
        const index = parseInt(e.currentTarget.dataset.index);
        this.setData({ currentTab: index });
        this.loadData();
    },

    onSwiperChange(e) {
        this.setData({ currentTab: e.detail.current });
        this.loadData();
    },

    loadData() {
        if (this.data.currentTab === 0) {
            this.loadRepairList();
        } else {
            this.loadOrderList();
        }
    },

    onPullDownRefreshRepair() {
        this.setData({ isRepairRefreshing: true });
        this.loadRepairList().finally(() => {
            this.setData({ isRepairRefreshing: false });
        });
    },

    onPullDownRefreshOrder() {
        this.setData({ isOrderRefreshing: true });
        this.loadOrderList().finally(() => {
            this.setData({ isOrderRefreshing: false });
        });
    },

    // --- Repair Logic ---

    loadRepairList() {
        const projectId = wx.getStorageSync("selected_home");
        const params = {
            project_id: projectId,
            page_options: { page: 1, limit: 0 }
        };

        return new Promise((resolve, reject) => {
            api.get_repair_reports({
                method: "POST",
                data: params,
                header: {
                    "content-type": "application/json",
                    Authorization: wx.getStorageSync("access_token")
                },
                success: (res) => {
                    if (res && res.data && Array.isArray(res.data.entities)) {
                        const repairs = res.data.entities.map(item => {
                            // --- 修改点2：增加默认颜色，并获取 statusColor ---
                            const defaultStatus = { text: '未知状态', class: 'status-unknown', color: '#999999' };
                            const statusInfo = REPAIR_STATUS_MAP[item.status] || defaultStatus;

                            return {
                                ...item,
                                statusText: statusInfo.text,
                                statusClass: statusInfo.class,
                                statusColor: statusInfo.color, // 新增：将颜色传给前端
                                created_at: this.formatDate(item.created_at)
                            };
                        });
                        this.setData({ repairList: repairs });
                    } else {
                        this.setData({ repairList: [] });
                    }
                    resolve();
                },
                fail: (err) => {
                    console.error("Failed to load repair list", err);
                    wx.showToast({ title: '加载报修失败', icon: 'none' });
                    reject(err);
                }
            });
        });
    },

    navigateToRepairDetail(e) {
        const item = e.currentTarget.dataset.item;
        wx.navigateTo({
            url: `/subpackages/repairdetail/repairdetail?id=${item.id}`,
            success: (res) => {
                res.eventChannel.emit('acceptDataFromServicePage', { data: item });
            }
        });
    },

    navigateToFeedback() {
        wx.navigateTo({
            url: '/subpackages/repaircreate/repaircreate'
        });
    },

    // --- Order Logic ---

    loadOrderList() {
        const projectId = wx.getStorageSync("selected_home");
        const workOrderParams = {
            project_id: projectId,
            status: [9],
            page_options: { page: 1, limit: 0 }
        };

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

        return Promise.allSettled([fetchCategoriesPromise, fetchWorkOrdersPromise])
            .then((results) => {
                const [categoriesResult, workOrdersResult] = results;

                if (categoriesResult.status === 'fulfilled' && categoriesResult.value && categoriesResult.value.data && Array.isArray(categoriesResult.value.data.entities)) {
                    const categories = categoriesResult.value.data.entities;
                    const newCategoriesMap = new Map();
                    categories.forEach(cat => {
                        newCategoriesMap.set(cat.id, cat.name);
                    });
                    this.setData({ categoriesMap: newCategoriesMap });
                }

                if (workOrdersResult.status === 'fulfilled') {
                    this.handleOrderApiResponse(workOrdersResult.value);
                } else {
                    this.setData({ orderList: [] });
                }
            })
            .catch((error) => {
                console.error("Order data load error:", error);
                this.setData({ orderList: [] });
            });
    },

    handleOrderApiResponse(res) {
        if (res && res.data && Array.isArray(res.data.entities)) {
            const orders = res.data.entities;
            const { categoriesMap } = this.data;

            const formattedOrders = orders.map(item => {
                const statusInfo = ORDER_STATUS_MAP[item.status] || { text: '已完成', class: 'status-completed' };
                const orderTitle = (item.content || []).map(c => c.name).join('、') || '无服务内容';
                const serviceTypeName = categoriesMap.get(item.category_id) || '未分类';

                const hasRating = (item.score !== undefined && item.score !== null) ||
                    (item.review !== undefined && item.review !== null && item.review.trim() !== '');

                return {
                    ...item,
                    statusText: statusInfo.text,
                    statusClass: statusInfo.class,
                    title: orderTitle,
                    serviceType: serviceTypeName,
                    createdAt: this.formatDate(item.created_at),
                    hasRating: hasRating,
                    ratingText: hasRating ? '已评价' : '未评价',
                    ratingClass: hasRating ? 'rating-completed' : 'rating-pending'
                };
            });

            this.setData({ orderList: formattedOrders });
        } else {
            this.setData({ orderList: [] });
        }
    },

    navigateToOrderDetail(event) {
        const { id } = event.currentTarget.dataset;
        const orderData = this.data.orderList.find(item => item.id === id);
        if (orderData) {
            wx.navigateTo({
                url: `/subpackages/orderdetail/orderdetail?id=${id}`,
                success: (res) => res.eventChannel.emit('acceptDataFromOrdersPage', { data: orderData })
            });
        }
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        return dateStr.split('T')[0];
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