<template>
  <div class="mode-badge">
    <el-tag :type="modeColor" size="large">
      模式 {{ mode }} · {{ modeDescription }}
    </el-tag>
    <el-button v-if="canSkip" link size="small" @click="$emit('skip')">
      跳过衔接 → 转模式 A
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Mode } from '@/types';

const props = defineProps<{
  mode: Mode;
  canSkip?: boolean;
}>();

defineEmits<{
  skip: [];
}>();

const modeDescriptionMap: Record<Mode, string> = {
  A: '用户主动输入',
  B: '基于上周计划追问',
  C: '冷启动开放问',
};

const modeColorMap: Record<Mode, '' | 'success' | 'warning' | 'primary'> = {
  A: 'primary',
  B: 'success',
  C: 'warning',
};

const modeDescription = computed(() => modeDescriptionMap[props.mode]);
const modeColor = computed(() => modeColorMap[props.mode]);
</script>

<style scoped>
.mode-badge {
  padding: 8px 20px;
  background: white;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
