import request from '../utils/request';

export default {
    addToCart(data) {
        return request({
            url: '/mall/cart/items',
            method: 'POST',
            data
        });
    },

    getCartList() {
        return request({
            url: '/mall/cart/items',
            method: 'GET'
        }).then((res) => {
            const list = res?.list || res || [];
            return list.map(item => ({
                id: item.id,
                user_id: item.user_id,
                product_id: item.product_id,
                quantity: item.quantity,
                created_at: item.created_at,
                product: {
                    id: item.product_id,
                    name: item.product_name,
                    price: item.product_price,
                    image_url: item.product_image
                }
            }));
        });
    },

    deleteCartItem(id) {
        return request({
            url: `/mall/cart/items/${id}`,
            method: 'DELETE'
        });
    },

    updateCartQuantity(id, quantity) {
        return request({
            url: `/mall/cart/items/${id}`,
            method: 'PUT',
            data: { quantity }
        });
    },

    createOrder(data) {
        const cartIds = (data.items || []).map(item => item.cart_id);
        return request({
            url: '/mall/orders',
            method: 'POST',
            data: {
                store_id: data.store_id,
                cart_ids: cartIds
            }
        });
    },

    getOrderList(params) {
        return request({
            url: '/mall/orders',
            method: 'GET',
            data: params
        }).then((res) => {
            const list = res?.list || res || [];
            const mapItems = (items) => (items || []).map(item => ({
                ...item,
                product: {
                    id: item.product_id,
                    name: item.product_name,
                    image_url: item.product_image
                }
            }));
            
            const mappedList = list.map(order => ({
                ...order,
                items: mapItems(order.items)
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

    async payOrder(data) {
        const orderId = data.order_id || data.business_id || data.id;

        let orderAmount = 0;
        let userPoints = 0;
        try {
            const [orderRes, userRes] = await Promise.all([
                request({ url: `/mall/orders/${orderId}`, method: 'GET' }),
                request({ url: '/users/me', method: 'GET' })
            ]);
            if (orderRes) {
                orderAmount = orderRes.total_amount || orderRes.amount || 0;
            }
            if (userRes) {
                userPoints = userRes.green_points || 0;
            }
        } catch (e) {
            console.error('Failed to pre-fetch for preview calculation:', e);
        }

        const idempotencyKey = `order-pay-${orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        await request({
            url: `/mall/orders/${orderId}/pay`,
            method: 'POST',
            data: {
                pay_type: data.pay_type || 'password',
                password: data.password || '',
                face_image_url: data.face_image_url || '',
                idempotency_key: idempotencyKey,
                return_url: ''
            }
        });

        const amountInCents = Math.max(0, Math.round(Number(orderAmount || 0) * 100));
        const points = Math.max(0, Math.floor(Number(userPoints || 0)));
        const maxDeductiblePoints = Math.floor(amountInCents / 10);
        const usedPoints = Math.min(points, maxDeductiblePoints);
        const balanceInCents = amountInCents - usedPoints * 10;

        return {
            used_points: usedPoints,
            used_balance: balanceInCents / 100
        };
    },

    cancelOrder(orderId) {
        return request({
            url: `/mall/orders/${orderId}/cancel`,
            method: 'POST'
        });
    },

    receiveOrder(orderId) {
        return request({
            url: `/mall/orders/${orderId}/receive`,
            method: 'POST'
        });
    },

    getOrderDetail(id) {
        return request({
            url: `/mall/orders/${id}`,
            method: 'GET'
        }).then((res) => {
            if (!res) return res;
            return {
                ...res,
                store: {
                    id: res.store_id,
                    name: res.store_name,
                    address: res.store_address,
                    phone: res.store_phone
                },
                items: (res.items || []).map(item => ({
                    ...item,
                    product: {
                        id: item.product_id,
                        name: item.product_name,
                        image_url: item.product_image
                    }
                }))
            };
        });
    }
};
