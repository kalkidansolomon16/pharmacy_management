<template>
  <nav class="px-2">
    <div>
        <div class="flex px-3 py-2">
            <div>
             <img src="/logo/Screenshot 2026-06-17 224842.png" alt="" class="rounded-full w-1/3">
            </div>
            <div class="-ml-18">
                <p>Pharmacy</p>
                <p class="text-green-200">Ethiiopia</p>
            </div>
        </div>
        <hr class="text-gray-600 mt-3">
          <div class="mt-3" >
                <p class="text-gray-500">{{ currentUser.role}}</p>
                <p class="">{{ currentUser.email}}</p>
            </div>
            <hr class="text-gray-600 mt-3">
    </div>
    <ul class="mt-3 text-gray-400 ">
        <li v-for="item in filteredItems" :key="item.path" class="">
            <router-link :to="item.path" active-class="active" class="flex mb-3 hover:bg-gray-800 p-2 rounded-md active:bg-green-950 active:text-green-400">
              <component :is="item.icon" v-if="item.icon" class="w-1/12"/>
              <span class="ml-2">{{item.name}}</span>
            </router-link>
        </li>
    </ul>
  </nav>
</template>

<script setup>
import { navigationItems } from '@/config/Navigation';
import { useAuthStore } from '@/stores/auth';
import { computed, onMounted, ref } from 'vue';


const props = defineProps({
    panelType : {
        type:String,
        required:true
    }
})

const filteredItems = computed(()=>{
    return navigationItems.filter(item=>item.panels.includes(props.panelType));
})
const authStore = useAuthStore();
const currentUser = computed(()=>{
    return JSON.parse(authStore.user)
})
onMounted(()=>{
// authStore.getUser()
// console.log('userrrrrrrrrr',authStore.user)
})

</script>

