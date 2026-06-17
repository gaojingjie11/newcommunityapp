import request from '../utils/request';

export default {
    getNoticeList(params, options = {}) {
        return request({
            url: '/community/notices',
            method: 'GET',
            data: params,
            ...options
        });
    },

    getNoticeDetail(id) {
        return request({
            url: `/community/notices/${id}`,
            method: 'GET'
        });
    },

    readNotice(id) {
        return request({
            url: `/community/notices/${id}/read`,
            method: 'POST'
        });
    },

    createRepair(data) {
        return request({
            url: '/workorders',
            method: 'POST',
            data: {
                type: data.type === 2 ? 'complaint' : 'repair',
                category: data.category,
                description: data.content
            }
        });
    },

    getRepairList(params) {
        return request({
            url: '/workorders',
            method: 'GET',
            data: params
        }).then(res => {
            const list = res?.list || res || [];
            const mappedList = list.map(item => ({
                ...item,
                type: item.type === 'complaint' ? 2 : 1,
                content: item.description
            }));
            if (res && res.list) {
                return {
                    ...res,
                    list: mappedList
                };
            }
            return mappedList;
        });
    },

    createVisitor(data) {
        const dateStr = data.visit_time || '';
        const dateOnly = dateStr ? dateStr.substring(0, 10) : '';
        return request({
            url: '/community/visitors',
            method: 'POST',
            data: {
                visitor_name: data.visitor_name,
                visitor_phone: data.visitor_phone,
                visit_purpose: data.reason,
                release_time: dateStr,
                valid_date: dateOnly
            }
        });
    },

    getVisitorList(params) {
        return request({
            url: '/community/visitors',
            method: 'GET',
            data: params
        }).then(res => {
            const list = res?.list || res || [];
            const mappedList = list.map(item => ({
                ...item,
                visitor_name: item.visitor_name,
                visitor_phone: item.visitor_phone,
                visitor_mobile: item.visitor_phone,
                mobile: item.visitor_phone,
                name: item.visitor_name,
                reason: item.visit_purpose,
                visit_time: item.release_time
            }));
            if (res && res.list) {
                return {
                    ...res,
                    list: mappedList
                };
            }
            return mappedList;
        });
    },

    getMyParking() {
        return request({
            url: '/community/parking-spaces/my',
            method: 'GET'
        }).then(res => res?.list || res || []);
    },

    bindCar(data) {
        const parkingId = data.parking_id;
        return request({
            url: `/community/parking-spaces/${parkingId}/plate`,
            method: 'PUT',
            data: {
                car_plate: data.car_plate
            }
        });
    },

    getPropertyFeeList(params) {
        return request({
            url: '/community/property-fees',
            method: 'GET',
            data: params
        });
    },

    async payPropertyFee(data) {
        const feeId = data.related_id || data.business_id || data.id;
        const idempotencyKey = `property-fee-${feeId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        let feeAmount = 0;
        let userPoints = 0;
        try {
            const [feeRes, userRes] = await Promise.all([
                request({ url: '/community/property-fees', method: 'GET' }),
                request({ url: '/users/me', method: 'GET' })
            ]);
            const list = feeRes.list || feeRes || [];
            const fee = list.find(item => Number(item.id) === Number(feeId));
            if (fee) {
                feeAmount = fee.amount;
            }
            if (userRes) {
                userPoints = userRes.green_points || 0;
            }
        } catch (e) {
            console.error('Failed to pre-fetch for preview calculation:', e);
        }

        await request({
            url: `/community/property-fees/${feeId}/pay`,
            method: 'POST',
            data: {
                pay_type: data.pay_type || 'password',
                password: data.password || '',
                face_image_url: data.face_image_url || '',
                idempotency_key: idempotencyKey
            }
        });

        const amountInCents = Math.max(0, Math.round(Number(feeAmount || 0) * 100));
        const points = Math.max(0, Math.floor(Number(userPoints || 0)));
        const maxDeductiblePoints = Math.floor(amountInCents / 10);
        const usedPoints = Math.min(points, maxDeductiblePoints);
        const balanceInCents = amountInCents - usedPoints * 10;

        return {
            used_points: usedPoints,
            used_balance: balanceInCents / 100
        };
    },

    getStoreList() {
        return request({
            url: '/mall/stores',
            method: 'GET'
        });
    }
};
