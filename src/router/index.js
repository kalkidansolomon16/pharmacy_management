import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'
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
  await authStore.getUser();
}
if(to.meta.requiresAuth && !authStore.user){
  next({name:'Login'})
}
else if(to.meta.guestOnly && authStore.user){
  next({name:'home'});
}
else{
  next();
}
})
export default router
