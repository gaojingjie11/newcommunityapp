<template>
<view class="chat-page page-shell">
  <view class="chat-header card">
    <view class="chat-title-row">
      <view class="chat-title">🤖 智享生活助手</view>
      <button class="new-chat-btn" size="mini" @tap="handleNewSession">新对话</button>
    </view>
    <view class="chat-desc">支持通知总结、报修投诉、商品下单与支付协助</view>
  </view>

  <view class="chat-card card">
    <scroll-view class="chat-history" scroll-y="true" :scroll-into-view="lastMessageId">
      <template v-for="(item, index) in messages" :key="index">
        <view :id="'msg-' + index" :class="'message-item ' + item.role">
          <view class="avatar">{{item.role === 'user' ? '我' : (item.role === 'assistant' ? 'AI' : '!')}}</view>
          <view class="content-wrap">
            <!-- Normal Chat Content -->
            <view class="bubble" v-if="item.content">{{item.content}}</view>

            <!-- Tool Status Processing -->
            <view class="tool-status-bubble" v-if="item.tool_status">
              <view class="loading-dots"></view>
              <text>{{item.tool_status}}</text>
            </view>

            <!-- Proposed Action Card -->
            <view class="action-card" v-if="item.proposed_action">
              <view class="action-card-header">
                <text class="action-card-title">⚠️ 操作授权确认</text>
              </view>
              <view class="action-card-body">
                <!-- Create Order Details -->
                <view class="action-detail-item" v-if="item.proposed_action.action_type === 'create_order'">
                  <view class="detail-row"><text class="label">意图：</text><text class="value">生成商城订单</text></view>
                  <view class="detail-row"><text class="label">商品 ID：</text><text class="value">{{item.proposed_action.payload.product_id}}</text></view>
                  <view class="detail-row"><text class="label">购买数量：</text><text class="value">{{item.proposed_action.payload.quantity}}</text></view>
                </view>

                <!-- Pay Order Details -->
                <view class="action-detail-item" v-else-if="item.proposed_action.action_type === 'pay_order'">
                  <view class="detail-row"><text class="label">意图：</text><text class="value">支付商城订单</text></view>
                  <view class="detail-row"><text class="label">订单号：</text><text class="value">{{item.proposed_action.payload.order_id}}</text></view>
                </view>

                <!-- Submit Repair Details -->
                <view class="action-detail-item" v-else-if="item.proposed_action.action_type === 'submit_repair'">
                  <view class="detail-row"><text class="label">意图：</text><text class="value">提交报修/投诉</text></view>
                  <view class="detail-row"><text class="label">类型：</text><text class="value">{{item.proposed_action.payload.type === 'repair' ? '报修' : '投诉'}}</text></view>
                  <view class="detail-row"><text class="label">分类：</text><text class="value">{{item.proposed_action.payload.category}}</text></view>
                  <view class="detail-row"><text class="label">描述：</text><text class="value">{{item.proposed_action.payload.description}}</text></view>
                </view>
              </view>

              <!-- Action Confirmation Buttons -->
              <view class="action-card-footer" v-if="!item.action_resolved">
                <button class="action-btn approve-btn" @tap="handleApprove" :data-index="index" :disabled="item.action_submitting">授权同意</button>
                <button class="action-btn reject-btn" @tap="handleReject" :data-index="index" :disabled="item.action_submitting">拒绝</button>
              </view>

              <!-- Resolved Status -->
              <view class="action-card-resolved" v-else>
                <view :class="'resolved-status ' + item.action_resolved">
                  <text v-if="item.action_resolved === 'approved'">✓ 已授权同意</text>
                  <text v-else>✗ 已拒绝操作</text>
                </view>
                <!-- Pay button after order created -->
                <view class="post-action-pay" v-if="item.action_resolved === 'approved' && item.proposed_action.action_type === 'create_order' && item.result_payload && item.result_payload.order_id">
                  <button class="btn btn-warning pay-now-btn" @tap="goToPay" :data-orderid="item.result_payload.order_id">去支付订单</button>
                </view>
              </view>
            </view>

            <view class="time">{{item.time}}</view>
          </view>
        </view>
      </template>

      <view v-if="loading && (!messages.length || !messages[messages.length-1].tool_status)" class="message-item assistant">
        <view class="avatar">AI</view>
        <view class="content-wrap">
          <view class="bubble">正在思考中...</view>
        </view>
      </view>
    </scroll-view>

    <view class="input-area">
      <textarea
        class="input-box"
        :value="inputContent"
        placeholder="请输入你的问题..."
        maxlength="1000"
        auto-height
        @input="onInput"
      />
      <button class="btn btn-primary send-btn" @tap="handleSend" :loading="loading" :disabled="loading">发送</button>
    </view>
  </view>
</view>
</template>

<script>
import { createPage } from '@/common/page-compat.js';
import pageDef from './index.page.js';

export default createPage(pageDef);
</script>

<style>
.chat-page {
  min-height: 100vh;
  padding: 24rpx;
}

.chat-header {
  margin-bottom: 20rpx;
  background: linear-gradient(135deg, #f6faff 0%, #eef4fb 100%);
}

.chat-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-title {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.new-chat-btn {
  background: var(--primary-color, #2d597b) !important;
  color: #ffffff !important;
  font-size: 22rpx !important;
  padding: 0 20rpx !important;
  height: 48rpx !important;
  line-height: 48rpx !important;
  border-radius: 8rpx !important;
  margin: 0 !important;
  font-weight: normal !important;
}

.chat-desc {
  margin-top: 16rpx;
  color: var(--text-secondary);
  font-size: 26rpx;
}

.chat-card {
  padding: 0;
  overflow: hidden;
}

.chat-history {
  height: 67vh;
  background: #f8fbff;
  padding: 24rpx;
}

.message-item {
  display: flex;
  margin-bottom: 24rpx;
}

.message-item.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #dcebf9;
  color: #1f3e5a;
  font-size: 24rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.message-item.assistant .avatar {
  background: #e7f3ee;
  color: #18573f;
}

.message-item.system .avatar {
  background: #fff0f0;
  color: #9f2a2a;
}

.content-wrap {
  max-width: 78%;
  margin: 0 16rpx;
}

.bubble {
  padding: 20rpx 24rpx;
  border-radius: 24rpx;
  background: #fff;
  border: 2rpx solid var(--border-color);
  font-size: 28rpx;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-primary);
}

.message-item.user .bubble {
  background: linear-gradient(135deg, #47719b 0%, #2d597b 100%);
  color: #fff;
  border-color: transparent;
}

.time {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--text-tertiary);
}

.message-item.user .time {
  text-align: right;
}

.input-area {
  padding: 20rpx;
  border-top: 2rpx solid var(--border-color);
  background: #fff;
}

.input-box {
  width: 100%;
  min-height: 152rpx;
  max-height: 320rpx;
  background: #f7fafc;
  border: 2rpx solid var(--border-color);
  border-radius: 24rpx;
  padding: 20rpx;
  font-size: 28rpx;
  color: var(--text-primary);
  margin-bottom: 20rpx;
}

.send-btn {
  width: 100%;
}

/* Tool status style */
.tool-status-bubble {
  background: #f0f7f4;
  border: 2rpx dashed #b7d8c6;
  color: #1f7a4d;
  padding: 16rpx 24rpx;
  border-radius: 24rpx;
  font-size: 26rpx;
  display: inline-flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.loading-dots {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background-color: #1f7a4d;
  margin-right: 16rpx;
  animation: dot-blink 1.4s infinite both;
}

@keyframes dot-blink {
  0%, 80%, 100% { opacity: 0.2; }
  40% { opacity: 1; }
}

/* Action confirmation card */
.action-card {
  background: #ffffff;
  border: 2rpx solid #e1e8ed;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-top: 12rpx;
  margin-bottom: 12rpx;
  width: 480rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.04);
}

.action-card-header {
  border-bottom: 2rpx solid #f2f5f8;
  padding-bottom: 16rpx;
  margin-bottom: 16rpx;
}

.action-card-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #d97706;
}

.action-card-body {
  font-size: 26rpx;
  color: #4b5563;
}

.detail-row {
  display: flex;
  margin-bottom: 12rpx;
  line-height: 1.5;
}

.detail-row .label {
  color: #9ca3af;
  width: 140rpx;
  flex-shrink: 0;
}

.detail-row .value {
  color: #1f2937;
  font-weight: 500;
  word-break: break-all;
}

.action-card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 24rpx;
  border-top: 2rpx solid #f2f5f8;
  padding-top: 16rpx;
}

.action-btn {
  font-size: 24rpx;
  padding: 0 24rpx;
  height: 56rpx;
  line-height: 56rpx;
  border-radius: 12rpx;
  margin: 0 !important;
}

.approve-btn {
  background: #10b981 !important;
  color: #ffffff !important;
}

.reject-btn {
  background: #ef4444 !important;
  color: #ffffff !important;
}

.action-card-resolved {
  margin-top: 20rpx;
  border-top: 2rpx solid #f2f5f8;
  padding-top: 16rpx;
  text-align: center;
}

.resolved-status {
  font-size: 26rpx;
  font-weight: 600;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  display: inline-block;
}

.resolved-status.approved {
  color: #10b981;
  background: #ecfdf5;
}

.resolved-status.rejected {
  color: #ef4444;
  background: #fef2f2;
}

.post-action-pay {
  margin-top: 20rpx;
}

.pay-now-btn {
  background: #f59e0b !important;
  color: #ffffff !important;
  font-size: 24rpx;
  padding: 0 32rpx;
  height: 60rpx;
  line-height: 60rpx;
  border-radius: 12rpx;
  font-weight: bold;
}
</style>
