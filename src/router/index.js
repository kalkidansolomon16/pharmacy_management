import { useAuthStore } from '@/stores/auth'
import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'
import AdminPanel from '../views/AdminPanel.vue'
import Login from '../views/login/Login.vue'
import TenantRegistration from '../views/Tenants/TenantRegistration.vue'
import UserRegistration from '../views/users/UserRegistration.vue'
import UserPanel from '../views/users/UserPanel.vue'
// import PharmacyTenantPanel from '../components/Navigation/TenantPanel.vue/index.js'
import Dashboard from '../views/Tenants/Dashboard.vue'
import UsersList from '../views/Tenants/UsersList.vue'
// import HospitalDashboard from '../views/Tenants/HospitalDashboard.vue'



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
      {
      path: '/TenantRegistration',
      name: 'TenantRegistration',
      component: TenantRegistration,
      meta:{guestOnly:true}
    },
    {
      path: '/UserRegistration',
      name: 'UserRegistration',
      component: UserRegistration,
      meta:{guestOnly:true}
    },
     {
      path: '/UserPanel',
      name: 'UserPanel',
      component: UserPanel,
      meta:{requiresAuth:true}
    },
    // {
    //   path: '/PharmacyTenantPanel',
    //   name: 'PharmacyTenantPanel',
    //   component: PharmacyTenantPanel,
    //   meta:{requiresAuth:true}
    // },
      {
      path: '/dashboard',
      name: 'Dashboard',
      component: Dashboard,
      meta:{requiresAuth:true,title:'Dashboard'}
    },
      {
      path: '/usersList',
      name: 'UsersList',
      component: UsersList,
      meta:{requiresAuth:true,title:'UsersList'}
    },
    
    //    {
    //   path: '/hospitalDashboard',
    //   name: 'HospitalDashboard',
    //   component: HospitalDashboard,
    //   meta:{requiresAuth:true,title:'HospitalDashboard'}
    // },
    
  
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
