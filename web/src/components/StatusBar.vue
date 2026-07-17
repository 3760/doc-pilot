<template>
  <div class="status-bar">
    <span class="status-indicator">
      <span class="status-dot" :class="{ offline: !connected }"></span>
      {{ connected ? '连接已建立' : '连接断开' }}
    </span>
    <span>模式: {{ sessionStore.mode }}</span>
    <span>Token: {{ reportStore.tokensUsed }}</span>
    <span class="grow"></span>
    <span>🦐 DocPilot v0.1.0</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useSessionStore } from '@/stores/session';
import { useReportStore } from '@/stores/report';

const sessionStore = useSessionStore();
const reportStore = useReportStore();
const connected = ref(true);

let timer: number | undefined;
onMounted(() => {
  // 简单心跳检查（每 30 秒 ping 一次 /api/v1/health）
  timer = window.setInterval(async () => {
    try {
      const res = await fetch('/api/v1/health', { method: 'GET' });
      connected.value = res.ok;
    } catch {
      connected.value = false;
    }
  }, 30000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.grow {
  flex: 1;
}
</style>
