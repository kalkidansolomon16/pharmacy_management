import api from "@/lib/axios"
import { defineStore } from "pinia"
import { ref } from "vue"


export const UserRegistrationStore = defineStore('user',()=>{
const users = ref(null)
const tenantTypes = ref(null)

const registerUser = async(values)=>{
    const response = await api.post('/api/users',{
        tenant_id : values.tenant_id,
        email:values.email,
        password:values.password,
        // status:values.status
        address:values.address,
        phone:values.phone

    })
    users.value = response.data;


}
const gettenants = async()=>{
    const response = await api.get('/api/tenants')
    tenantTypes.value = response.data.data
    console.log('tenants from userrrrr',tenantTypes.value)
}
return {users,registerUser,gettenants,tenantTypes}
})