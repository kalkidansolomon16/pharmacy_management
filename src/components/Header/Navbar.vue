<template>
<div class="shadow-md w-full  fixed bg-white mb-20">
    <div class="flex justify-between p-1  ">

    <img src="/logo/cfcbec57b9cce056db5f294f33e7d599.jpg" alt="" class="w-1/8 rounded-full h-1/3">
<p class="w-2/3 text-sm font-semibold  ml-16 fixed">pharmacy inventory managemet</p>
<div @click="toggleNavBar" v-if="!showNavBar">
<i class="fa-solid fa-bars text-xl cursor-pointer"></i>
</div>
    </div>
    <div class="flex justify-end nav-div absolute left-40 top-0" v-if="showNavBar">
      <ul class="flex flex-col text-white font-semibold text-lg w-10/11">
        <div  
           >
         
          <li  class="px-6 py-2 border-b border-cyan-700 hover:bg-cyan-600 cursor-pointer" @click="gotTOPage('/')">Home</li>
          <li  class="px-6 py-2 border-b border-cyan-700 hover:bg-cyan-600 cursor-pointer">About Us</li>
          <li  class="px-6 py-2 border-b border-cyan-700 hover:bg-cyan-600 cursor-pointer">Locations</li>
          <li  class="px-6 py-2 border-b border-cyan-700 hover:bg-cyan-600 cursor-pointer">contact us</li>
          <li  class="px-6 py-2 border-b border-cyan-700 hover:bg-cyan-600 cursor-pointer" @click="gotTOPage('/Login')">Login</li>
      </div>
      </ul>
      <i class="fa-solid fa-xmark text-2xl pt-4 pr-2 cursor-pointer" @click="toggleNavBar" v-if="showNavBar"></i>
    </div>
</div>
</template>

<script setup>
import router from '@/router';
import { ref } from 'vue';
const showNavBar = ref(false);
const toggleNavBar = ()=>{
    showNavBar.value = !showNavBar.value
}
const gotTOPage = (page)=>{
  router.push(page)
}
</script>

<style>
.nav-div{
    background-color: rgba(0, 0, 0, 0.762);
    color: white;
    
}
</style>