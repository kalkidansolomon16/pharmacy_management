import { defineStore } from "pinia";
import { ref } from "vue";
import api from "@/lib/axios";
import { useRouter } from "vue-router";

export const useAuthStore = defineStore('auth',()=>{
    const user = ref(null);
    const router = useRouter()

    async function  getUser(){
        try{

            const response = await api.get('/api/users')
            user.value = response.data;
        }catch(error){
            user.value = null
            console.log(error)
        }
    }
    async function login(credentials){
     await api.get('/sanctum/csrf-cookie')
     await api.post('/api/login',credentials);
     await getUser();
    
    }
    async function logout(){
        await api.post('/api/logout')
        user.value = null;
    }

    return {user,getUser,login,logout}
}) 