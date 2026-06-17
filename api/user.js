import request, { BASE_URL } from '../utils/request';

function registerFace(filePath) {
    return new Promise((resolve, reject) => {
        const token = uni.getStorageSync('token');
        const header = {};
        if (token) {
            header.Authorization = `Bearer ${token}`;
        }

        uni.uploadFile({
            url: `${BASE_URL}/upload`,
            filePath,
            name: 'file',
            header,
            formData: {
                dir: 'face'
            },
            success: (res) => {
                let data = {};
                try {
                    data = JSON.parse(res.data || '{}');
                } catch (e) {
                    reject(new Error('人脸图片上传响应解析失败'));
                    return;
                }

                if (res.statusCode >= 200 && res.statusCode < 300 && (data.code === 200 || data.code === 0)) {
                    const faceImageUrl = data?.data?.url || data?.url || (typeof data?.data === 'string' ? data.data : '');
                    if (!faceImageUrl) {
                        reject(new Error('人脸图片上传成功但未返回地址'));
                        return;
                    }
                    
                    // Call register API
                    request({
                        url: '/users/me/face',
                        method: 'POST',
                        data: { face_image_url: faceImageUrl }
                    }).then(resolve).catch(reject);
                    return;
                }

                if (data.code === 401 || res.statusCode === 401) {
                    uni.removeStorageSync('token');
                    uni.redirectTo({ url: '/pages/auth/login' });
                }
                reject(new Error(data.msg || '人脸图片上传失败'));
            },
            fail: (err) => reject(err || new Error('人脸图片上传失败'))
        });
    });
}

export default {
    getUserInfo() {
        return request({
            url: '/users/me',
            method: 'GET'
        });
    },

    updateUserInfo(data) {
        return request({
            url: '/users/me',
            method: 'PUT',
            data
        });
    },

    changePassword(data) {
        return request({
            url: '/users/me/password',
            method: 'PUT',
            data
        });
    },

    registerFace
};
