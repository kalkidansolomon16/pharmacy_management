<template>
  <div class="container py-5">
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


<div class="mt-3">
     <p class="mb-2">Type:</p>
<select name="" id="" class="border border-gray-200 rounded-sm focus:outline-none py-2 px-1 w-11/11" v-model="userData.tenant_id">
    <option value="" disabled>select tenant </option>
    <option  v-for="tenant in authStore.tenantTypes" 
    :key="tenant" :value="tenant.id">
{{ tenant.name }}
    </option>
</select>
</div>
<div class="mt-5">
    <p class="mb-2">Email:</p>
    <input type="text" class="border border-gray-200 rounded-sm focus:outline-none py-2 px-1 w-11/11" v-model="userData.email">
</div>
<div class="mt-5">
    <p class="mb-2">Password:</p>
    <div class="flex">

        <input :type="isPasswordvisible ? 'text' : 'password'" id="passwordField" class=" border border-gray-200 rounded-sm focus:outline-none py-2 px-1 w-11/11" v-model="userData.password">
        <button class="absolute ml-72 mt-3 cursor-pointer" @click="toggleView"> <i class="fa-regular fa-eye" v-if="isPasswordvisible ===false"></i> <i class="fa-regular fa-eye-slash" v-if="isPasswordvisible===true"></i>  </button>
    </div>
</div>
<div class="mt-5">
    <p class="mb-2">Adrress:</p>
    <input type="text" class="border border-gray-200 rounded-sm focus:outline-none py-2 px-1 w-11/11" v-model="userData.address">
</div>
<div class="mt-5">
    <p class="mb-2">Phone:</p>
    <input type="text" class="border border-gray-200 rounded-sm focus:outline-none py-2 px-1 w-11/11" v-model="userData.phone">
</div>

<div class="mt-5">

<button class="bg-green-100 w-10/11 py-1 mx-auto ml-3 hover:bg-green-300 cursor-pointer rounded-md" @click="PostUsers">{{ isLoading ? 'Loading...' : 'Sign Up' }}</button>
<p class="text-center mt-3">Do you have an account ? <span class="text-blue-500 underline font-semibold cursor-pointer" @click="()=>router.push('/Login')">Sign In</span></p>
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
import router from '@/router';
import { UserRegistrationStore } from '@/stores/Users/UserRegister';
import { onMounted,ref } from 'vue';
const authStore = UserRegistrationStore()
const isLoading = ref(false)

const userData = ref({
    tenant_id:'',
    email:'',
    password:'',
    phone:'',
    address:'',
})
const isPasswordvisible = ref(false)
const fetchTenantType = ()=>{
    authStore.gettenants()
}
const PostUsers = async()=>{
    try{

        isLoading.value = true
    await authStore.registerUser(userData.value)
    isLoading.value = false
    console.log('user is registered',)
    router.push('/Login')
    }catch(error){
        isLoading.value = false
    }
}

const toggleView = ()=>{
   isPasswordvisible.value = !isPasswordvisible.value
}
onMounted(()=>{
    fetchTenantType();
})
</script>

<style>

</style>