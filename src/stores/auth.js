import { defineStore } from "pinia";
import { ref } from "vue";
import api from "@/lib/axios";
import { useRouter } from "vue-router";
import axios from "axios";

export const useAuthStore = defineStore('auth',()=>{
    const user = ref(null);
    const router = useRouter()
    const error = ref('')
  async function login(credentials){
     await api.get('/sanctum/csrf-cookie')
     const response = await api.post('/api/login',{
        email:credentials.email,
        password:credentials.password
     });
     const token  = response.data.token
     
    //  console.log('messagee',response.data)
    //  console.log('token',response.data.token)
     const auth_user = response.data.user
    
     
    // console.log('token',response.data.token)    
    // console.log('user',JSON.stringify(user))
    //  console.log('auth user',auth_user)
     localStorage.setItem('Auth_Token',token)
     localStorage.setItem('auth_user',JSON.stringify(auth_user))
     axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
     router.push('/dashboard')
    //  if(response.data.user.role === 'Admin'){

    //      router.push('/AdminPanel')
    //  }
    //  else if(response.data.user.tenant.type === 'hospital'){
    //    router.push('/hospitalDashboard')
    //  }
    //  else if(response.data.user.tenant.type === 'pharmacy'){
    //      router.push('/pharmacyDashboard')
    //  }
    
    }
    async function  getUser(){
        const token = localStorage.getItem('Auth_Token')
        // console.log('token from getUser function',token)
   user.value = localStorage.getItem('auth_user');
//    console.log('userrr',user.value)
    }
  
    async function logout(){
        await api.post('/api/logout')
        user.value = null;
    }

    return {user,getUser,login,logout}
}) 