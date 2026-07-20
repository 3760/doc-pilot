<template>
  <div class="mode-badge">
    <el-tag :type="modeColor" size="large">
      模式 {{ mode }} · {{ modeDescription }}
    </el-tag>
    <el-button v-if="canSkip" link size="small" @click="$emit('skip')">
      跳过衔接 → 转模式 A
    </el-button>
    <!-- T4: 模式 C 可跳过追问，直接跳用户输入 -->
    <el-button v-if="canSkipFollowup" link size="small" type="warning" @click="$emit('skip-followup')">
      跳过追问 → 进入输入
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Mode } from '@/types';

const props = defineProps<{
  mode: Mode;
  /** 模式 B 历史衔接可跳过 */
  canSkip?: boolean;
  /** 模式 C 追问可跳过 */
  canSkipFollowup?: boolean;
}>();

defineEmits<{
  skip: [];
  'skip-followup': [];
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
