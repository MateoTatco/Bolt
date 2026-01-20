import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { auth } from '@/configs/firebase.config'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'

function Root() {
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            const enableAnon = import.meta.env.VITE_ENABLE_ANON_SIGNIN === 'true' || import.meta.env.DEV
            if (!user && enableAnon) {
                signInAnonymously(auth).catch(()=>{})
            }
        })
        return () => unsub()
    }, [])
    return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <Root />,
)
