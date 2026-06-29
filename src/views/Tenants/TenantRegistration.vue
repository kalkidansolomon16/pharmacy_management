<template>
  <div class="bg-green-200 py-5">
    <div class="ml-20 ">
        <img src="/logo/Screenshot 2026-06-17 224842.png" alt="" class="rounded-full">
    </div>
   <div class="">
<h1 class="text-center font-semibold font-mono">Fast  Efficient and productive</h1>
<p class="text-center text-sm mt-1 mb-5">Lorem ipsum dolor sit amet consectetur, <br> adipisicing elit. Consequuntur, delectus at! Dignis!</p>
<!-- <div class="flex justify-between">
    <div>
        language
    </div>
    <div class="flex justify-between">
<div class="text-blue-200">Terms</div>
<div class="text-blue-200">Plans</div>
<div class="text-blue-200">Contact Us</div>
    </div>
</div> -->
   </div>
   <div class="bg-white border border-green-200 rounded-md shadow px-1 py-1 justify-center">
<h1 class="text-center font-semibold font-mono text-xl">{{isLoading ? "isLoading..." : "Sign Up"}}</h1>
<p class="text-gray-200 text-center text-sm">Your Social Campaigns</p>
<div class="mt-5">
    <p class="mb-2">Name:</p>
    <input type="text" class="border border-gray-200 rounded-sm focus:outline-none py-2 px-1 w-11/11" v-model="formData.name">
</div>
<!-- <div class="mt-3">
    <p class="mb-2">Type:</p>
   <select name="" id="" class="border border-gray-200 rounded-sm focus:outline-none py-2 px-1 w-11/11" v-model="type">
    <option value=""></option>
    <option value="">Pharmacy</option>
    <option value="">Hospital</option>
   </select>
</div> -->
<div class="mt-3">
<label for="" class="mb-2">Type:</label>
<select name="" id="type" v-model="formData.type" class="border border-gray-200 rounded-sm focus:outline-none py-2 px-1 w-11/11">
    <option value="" disabled>select type</option>
    <option  v-for="type in tenantStore.tenantTypes" 
    :key="type.value" 
    :value="type.value">{{ type.label }}</option>
</select>
</div>
<div class="mt-5">
    <!-- <p>Email</p> 
    <input type="text" class="border border-gray-200 rounded-sm focus:outline-none py-1"> -->

<button class="bg-green-100 w-10/11 py-1 mx-auto ml-3 hover:bg-green-300 cursor-pointer rounded-md" @click="TenantRegister">Sign Up</button>
</div>
   </div>
   <div class="flex justify-between mt-20">
    <div>language</div>
    <div class="flex justify-between w-1/2 text-sm text-blue-400">
        <div class="cursor-pointer">Terms</div>
        <div class="cursor-pointer">Plans</div>
        <div class="cursor-pointer">Contact Us</div>
    </div>
   </div>
  </div>
</template>

<script setup>
import { useTenantStore } from '@/stores/Tenants/tenantRegister';
import { onMounted,ref } from 'vue';
// import { formToJSON } from 'axios';
const isLoading = ref(false);

const tenantStore = useTenantStore()
const formData = ref({
    name:'',
    type:''
})
const TenantRegister = async ()=>{
    isLoading.value = true;
await tenantStore.registerTenant(formData.value)
isLoading.value = false;
console.log('success')
} 
const getTenantTypes = async()=>{
    try{

        await tenantStore.getTenantType()
        console.log('Fetched types successfully:', tenantStore.tenantTypes);
    }catch(error){
        console.log('error',error)
    }
    // console.log('tenanttt',tenantStore.tenantTypes)
}
onMounted(()=>{
    getTenantTypes()

    

})

</script>

<style>

</style>