<script setup>
import { computed } from 'vue'
import {
  BeakerIcon, BugAntIcon, EyeIcon, FaceSmileIcon, FireIcon, HandRaisedIcon, HeartIcon,
  LightBulbIcon, ShieldCheckIcon, SparklesIcon, SunIcon, CloudIcon, UserGroupIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps({ icon: { type: String, default: '' } })

const map = {
  pain: FireIcon, shield: ShieldCheckIcon, bug: BugAntIcon, heart: HeartIcon, drop: BeakerIcon,
  stomach: FaceSmileIcon, lungs: CloudIcon, sparkles: SparklesIcon, hand: HandRaisedIcon,
  worm: SunIcon, eye: EyeIcon, brain: LightBulbIcon, baby: UserGroupIcon,
}
const component = computed(() => map[props.icon] ?? BeakerIcon)
</script>

<template>
  <component :is="component" />
</template>
