<template>
<div class=" shadow-md flex m-1 rounded-md mt-20">
    <div class="bg-emerald-300 text-black  w-1/2 px-2 py-10 rounded-md">
<h1 class="font-semibold text-lg">Welcome!</h1>
<p class="text-sm mt-2">to keep connecting with us please logged in with your account  </p>
<button class="text-xs bg-emerald-300 text-black px-5 py-2 rounded-3xl mt-10  cursor-pointer border border-white" @click="()=>signIn=!signIn">SIGN IN</button>
    </div>
    <div class="w-2/3 px-2 py-5" v-if="!signIn">
<h1 class="text-emerald-300 font-bold text-center pt-5">Create Account</h1>
    <div class="flex justify-between w-1/2 ml-9 mt-2">
       
<i class="fa-brands fa-facebook  text-gray-400"></i>

<i class="fa-brands fa-google-plus-g text-gray-400"></i>
<i class="fa-brands fa-linkedin text-gray-400"></i>

    </div>
    <p class="text-xs font-extralight text-gray-300 text-center mt-5"> or use your email for registration</p>
<div class="mt-2">
<div class="flex bg-gray-100 rounded-sm px-1 py-1">
    <i class="fa-regular fa-user mt-1"></i>
    <input type="text" name="" id="" class="w-10/11 focus:outline-none px-2" placeholder="Name">
</div>
<div class="flex bg-gray-100 rounded-sm px-1 py-1 mt-2">
   <i class="fa-solid fa-envelope mt-1"></i>
    <input type="email" name="" id="" class="w-10/11 focus:outline-none px-2" placeholder="Email">
</div>
<div class="flex bg-gray-100 rounded-sm px-1 py-1 mt-2">
   <i class="fa-solid fa-unlock mt-1"></i>
    <input type="password" name="" id="" class="w-10/11 focus:outline-none px-2" placeholder="Password">
</div>
<button class="text-xs bg-emerald-300 text-black px-9 py-2 rounded-3xl mt-2 ml-5 cursor-pointer">SIGN UP</button>
</div>
    </div>
        <div class="w-2/3 px-2 py-5" v-if="signIn">
<h1 class="text-emerald-300 font-bold text-center pt-5">Loged In to your Account</h1>
    <!-- <div class="flex justify-between w-1/2 ml-9 mt-2">
       
<i class="fa-brands fa-facebook  text-gray-400"></i>

<i class="fa-brands fa-google-plus-g text-gray-400"></i>
<i class="fa-brands fa-linkedin text-gray-400"></i>

    </div> -->
    <!-- <p class="text-xs font-extralight text-gray-300 text-center mt-5"> or use your email for registration</p> -->
<div class="mt-2">
<!-- <div class="flex bg-gray-100 rounded-sm px-1 py-1">
    <i class="fa-regular fa-user mt-1"></i>
    <input type="text" name="" id="" class="w-10/11 focus:outline-none px-2" placeholder="Name">
</div> -->
<div class="flex bg-gray-100 rounded-sm px-1 py-1 mt-2">
   <i class="fa-solid fa-envelope mt-1"></i>
    <input type="email" name="" id="" class="w-10/11 focus:outline-none px-2" placeholder="Email" v-model="loginForm.email">
</div>
<div class="flex bg-gray-100 rounded-sm px-1 py-1 mt-2">
   <i class="fa-solid fa-unlock mt-1"></i>
    <input type="password" name="" id="" class="w-10/11 focus:outline-none px-2" placeholder="Password" v-model="loginForm.password">
</div>
<button class="text-xs bg-emerald-300 text-black px-9 py-2 rounded-3xl mt-2 ml-5 cursor-pointer" @click="handleLogin">SIGN IN</button>
</div>
    </div>
</div>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
const authStore = useAuthStore();
const router = useRouter();
const signIn = ref(false)
const loginForm = {
   email:ref(''),
   password:ref('')
}
const handleLogin = ()=>{
    try{
        authStore.login(loginForm);
         router.push({name:'home'})
    }catch(error){
        console.log('error while login',error)
    }
}

</script>

<style>

</style>