<template>
  <div class="">
    <div class="flex p-5 justify-between">
      <div class="w-1/3 cursor-pointer">
        <i class="fa-solid fa-bars text-2xl" @click="toggleSideBar"></i>
      </div>
<div class="w-5/6 text-2xl ml-10 font-semibold">{{ pageTitle }}</div>

<div class="w-1/4 text-2xl bg-white border border-gray-200 rounded-md shadow-sm hover:bg-green-200 hover:cursor-pointer ml-10 px-3">
  <i class="fa-regular fa-bell "></i>
</div>
</div>
<div class="flex">

  <SideBar panelType = "Tenant" v-if="showSideBar" class="bg-gray-900 text-white -mt-18 w-3/4"/>
  <div class="sidebar-next cursor-pointer w-1/3 -mt-18" @click="showSideBar = !showSideBar" v-if="showSideBar"></div>
</div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import SideBar from '@/components/Navigation/SideBar.vue';
import { useRoute } from 'vue-router';
import { navigationItems } from '@/config/Navigation';
const route = useRoute()
const showSideBar = ref(false)  
const toggleSideBar = ()=>{
  showSideBar.value = !showSideBar.value
}
const pageTitle = computed(()=>{
  return route.meta.title
})


</script>

<style>
.sidebar-next{
  background-color: #787a7cc8;
}
</style>