import api from "@/lib/axios";
import axios from "axios";
import { defineStore } from "pinia";
import { ref } from "vue";
import { useRouter } from "vue-router";

export const useTenantStore = defineStore('tenant',()=>{
const tenant = ref(null)
const tenantTypes = ref(null);
async function registerTenant(credentials){
 const response = await api.post('/api/tenants',{
    name:credentials.name,
    type:credentials.type
 })
 tenant.value = response.data
 console.log('tenant',tenant.value)
}

async function getTenantType(){   
const response = await api.get('/api/get-type-options')
tenantTypes.value = response.data.enum
console.log('tenanttype',tenantTypes.value)
}
return {registerTenant,tenant,tenantTypes,getTenantType}

})
