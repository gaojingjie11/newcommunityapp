const BASE_URL = 'https://api.communitysvc.xyz/api';

const normalizeErrorMessage = (msg, fallback = '请求失败') => {
  const text = String(msg || '').trim();
  if (!text) return fallback;

  if (/invalid payment password/i.test(text)) {
    return '支付密码错误，请重试';
  }

  if (/payment password is required/i.test(text)) {
    return '当前支付方式需要支付密码，请改用密码支付或检查后端刷脸支付配置';
  }

  if (/face image is required/i.test(text)) {
    return '未获取到人脸图片，请重新拍照上传';
  }

  return text;
};

const isAuthRequest = (url) => {
  const path = String(url || '');
  return path.includes('/users/login') ||
         path.includes('/users/register') ||
         path.includes('/users/sms-code') ||
         path.includes('/users/login-code') ||
         path.includes('/users/password-reset');
};

const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token');
    const hasToken = !!token;
    const header = {
      'Content-Type': 'application/json',
      ...options.header
    };

    if (token) {
      header.Authorization = `Bearer ${token}`;
    }

    uni.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout || 7000,
      header,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const data = res.data || {};
          if (data.code === 200 || data.code === 0) {
            resolve(data.data);
            return;
          }

          if (data.code === 401) {
            uni.removeStorageSync('token');
            if (!isAuthRequest(options.url)) {
              uni.showToast({ title: '请先登录', icon: 'none' });
              setTimeout(() => {
                uni.redirectTo({ url: '/pages/auth/login' });
              }, 1000);
            }
            reject(data);
            return;
          }

          uni.showToast({
            title: normalizeErrorMessage(data.msg, '请求失败'),
            icon: 'none'
          });
          reject(data);
          return;
        }

        if (res.statusCode === 401) {
          uni.removeStorageSync('token');
          if (!isAuthRequest(options.url)) {
            uni.showToast({ title: '请先登录', icon: 'none' });
            setTimeout(() => {
              uni.redirectTo({ url: '/pages/auth/login' });
            }, 1000);
          }
        }

        const responseData = res && res.data ? res.data : {};
        uni.showToast({
          title: normalizeErrorMessage(responseData.msg || responseData.message, '请求失败'),
          icon: 'none'
        });
        reject(res);
      },
      fail: (err) => {
        uni.showToast({
          title: '网络错误',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
};

export { BASE_URL };
export default request;
