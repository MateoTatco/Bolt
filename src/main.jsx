import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
// Import testing guide for development
import './utils/firebaseTestingGuide'
import { auth } from '@/configs/firebase.config'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'

function Root() {
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (!user) {
                signInAnonymously(auth).catch((e)=>{
                    console.warn('Anonymous sign-in failed:', e)
                })
            }
        })
        return () => unsub()
    }, [])
    return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>,
)
