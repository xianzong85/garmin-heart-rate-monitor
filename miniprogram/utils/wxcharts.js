class WxChart {
  constructor(config) {
    this.canvasId = config.canvasId;
    this.data = [];
    this.categories = [];
    this.width = config.width;
    this.height = config.height;
    this.yMin = config.yAxis.min || 0;
    this.yMax = config.yAxis.max || 200;
    this.ctx = null;
    this.canvas = null;
    this.init();
  }

  async init() {
    try {
      const query = wx.createSelectorQuery();
      const canvas = await new Promise((resolve, reject) => {
        query.select('#' + this.canvasId)
          .fields({ node: true, size: true })
          .exec((res) => {
            console.log('Canvas查询结果:', res);
            if (res && res[0] && res[0].node) {
              resolve(res[0].node);
            } else {
              console.error('Canvas未找到:', res);
              reject(new Error('Canvas not found'));
            }
          });
      });

      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');

      // 设置画布分辨率
      const dpr = wx.getWindowInfo().pixelRatio;
      canvas.width = this.width * dpr;
      canvas.height = this.height * dpr;
      this.ctx.scale(dpr, dpr);
      
      console.log('Canvas初始化成功:', {
        width: canvas.width,
        height: canvas.height,
        dpr: dpr
      });
    } catch (err) {
      console.error('初始化图表失败:', err);
      throw err;
    }
  }

  // 更新数据并重绘
  updateData(config) {
    if (!this.ctx) {
      console.warn('图表未初始化，无法更新数据');
      return;
    }
    
    this.categories = config.categories;
    this.data = config.series[0].data;
    this.draw();
  }

  // 绘制图表
  draw() {
    if (!this.ctx) {
      console.warn('图表未初始化，无法绘制');
      return;
    }
    
    const ctx = this.ctx;
    const padding = 30;
    const chartWidth = this.width - padding * 2;
    const chartHeight = this.height - padding * 2;

    // 清空画布
    ctx.clearRect(0, 0, this.width, this.height);

    // 如果没有数据，直接返回
    if (this.data.length === 0) return;

    // 计算比例
    const xStep = chartWidth / (this.data.length - 1);
    const yRange = this.yMax - this.yMin;
    const yRatio = chartHeight / yRange;

    // 绘制折线
    ctx.beginPath();
    ctx.strokeStyle = '#dc3545';
    ctx.lineWidth = 2;

    this.data.forEach((value, index) => {
      const x = padding + index * xStep;
      const y = this.height - padding - (value - this.yMin) * yRatio;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // 绘制数据点
    this.data.forEach((value, index) => {
      const x = padding + index * xStep;
      const y = this.height - padding - (value - this.yMin) * yRatio;
      
      ctx.beginPath();
      ctx.fillStyle = '#dc3545';
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });

    // 绘制Y轴刻度
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#666666';
    [this.yMin, (this.yMin + this.yMax) / 2, this.yMax].forEach((value) => {
      const y = this.height - padding - (value - this.yMin) * yRatio;
      ctx.fillText(value.toString(), 5, y);
    });
  }
}

module.exports = {
  WxChart: WxChart
};
