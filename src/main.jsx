import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
// Import testing guide for development
import './utils/firebaseTestingGuide'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
