import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'
import AdminPanel from '../views/AdminPanel.vue'
import Login from '../views/login/Login.vue'
import { useAuthStore } from '@/stores/auth'


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
        meta:{guestOnly:true}
    },
  {
      path: '/Login',
      name: 'Login',
      component: Login,
      meta:{guestOnly:true}
    },
      {
      path: '/AdminPanel',
      name: 'AdminPanel',
      component: AdminPanel,
      meta:{requiresAuth:true}
    },
    
    // {
    //   path: '/about',
    //   name: 'about',
     
    //   component: () => import('../views/AboutView.vue'),
    // },
  ],
})
router.beforeEach(async(to,from,next)=>{
const authStore = useAuthStore();
if(!authStore.user){
  try{

    await authStore.getUser();
  }catch(error){
    authStore.user = null;
  }
}
const isAuthenticated = !!authStore.user;
if(to.meta.requiresAuth && !isAuthenticated){
  next({name:'Login'})
}
else if(to.meta.guestOnly && isAuthenticated){
  next({name:'AdminPanel'});
}
else{
  next();
}
})
export default router
