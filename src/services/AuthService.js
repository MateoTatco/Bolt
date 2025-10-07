import ApiService from './ApiService'
import endpointConfig from '@/configs/endpoint.config'

export async function apiSignIn(data) {
    return ApiService.fetchDataWithAxios({
        url: endpointConfig.signIn,
        method: 'post',
        data,
    })
}

export async function apiSignUp(data) {
    return ApiService.fetchDataWithAxios({
        url: endpointConfig.signUp,
        method: 'post',
        data,
    })
}

export async function apiSignOut() {
    return ApiService.fetchDataWithAxios({
        url: endpointConfig.signOut,
        method: 'post',
    })
}

export async function apiForgotPassword(data) {
    return ApiService.fetchDataWithAxios({
        url: endpointConfig.forgotPassword,
        method: 'post',
        data,
    })
}

export async function apiResetPassword(data) {
    return ApiService.fetchDataWithAxios({
        url: endpointConfig.resetPassword,
        method: 'post',
        data,
    })
}
