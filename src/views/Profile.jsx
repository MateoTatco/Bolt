import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Card, Button, Input, Form, FormItem, FormContainer, Avatar, Switcher, Select } from '@/components/ui'
import PasswordInput from '@/components/shared/PasswordInput'
import { useSessionUser } from '@/store/authStore'
import { PiUserDuotone, PiLockDuotone, PiBellDuotone } from 'react-icons/pi'
import { HiOutlineArrowLeft } from 'react-icons/hi'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { FirebaseAuthService } from '@/services/FirebaseAuthService'
import { storage } from '@/configs/firebase.config'
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { getAuth } from 'firebase/auth'
import { NOTIFICATION_TYPES } from '@/constants/notification.constant'
import { useProfitSharingAccess } from '@/hooks/useProfitSharingAccess'

const Profile = () => {
    const navigate = useNavigate()
    const user = useSessionUser((state) => state.user)
    const setUser = useSessionUser((state) => state.setUser)
    
    const [activeTab, setActiveTab] = useState('profile')
    const [formData, setFormData] = useState({
        firstName: '',
        userName: '',
        email: '',
        phoneNumber: '',
    })
    const [avatar, setAvatar] = useState('')
    const fileInputRef = useRef(null)
    const hasLoadedProfileRef = useRef(false)
    const isSavingRef = useRef(false)
    
    // Password state
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    })
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

    // Notification preferences state
    const [notificationPreferences, setNotificationPreferences] = useState({})
    const [isSavingPreferences, setIsSavingPreferences] = useState(false)

    // Profit sharing access (to conditionally show related notification settings)
    const { hasAccess: hasProfitSharingAccess, userRole: profitSharingUserRole } = useProfitSharingAccess()
    
    // Time-based notification settings
    const timeOptions = [
        { value: '15m', label: '15 minutes before' },
        { value: '30m', label: '30 minutes before' },
        { value: '1h', label: '1 hour before' },
        { value: '2h', label: '2 hours before' },
        { value: '4h', label: '4 hours before' },
        { value: '6h', label: '6 hours before' },
        { value: '12h', label: '12 hours before' },
        { value: '1d', label: '1 day before' },
        { value: '2d', label: '2 days before' },
        { value: '3d', label: '3 days before' },
        { value: '1w', label: '1 week before' },
        { value: '2w', label: '2 weeks before' },
    ]
    
    const overdueTimeOptions = [
        { value: '0h', label: 'Immediately when overdue' },
        { value: '1h', label: '1 hour after overdue' },
        { value: '2h', label: '2 hours after overdue' },
        { value: '4h', label: '4 hours after overdue' },
        { value: '6h', label: '6 hours after overdue' },
        { value: '12h', label: '12 hours after overdue' },
        { value: '1d', label: '1 day after overdue' },
        { value: '2d', label: '2 days after overdue' },
        { value: '1w', label: '1 week after overdue' },
    ]

    // Load user profile from Firestore on mount (only once)
    useEffect(() => {
        // Prevent loading if we've already loaded or are currently saving
        if (hasLoadedProfileRef.current || isSavingRef.current) {
            return
        }

        const loadUserProfile = async () => {
            hasLoadedProfileRef.current = true
            
            try {
                const auth = getAuth()
                const currentUser = auth.currentUser
                
                if (currentUser) {
                    const result = await FirebaseDbService.users.getById(currentUser.uid)
                    
                    if (result.success && result.data) {
                        const profileData = result.data
                        
                        setFormData({
                            firstName: profileData.firstName || user.firstName || '',
                            userName: profileData.userName || user.userName || '',
                            email: profileData.email || user.email || '',
                            phoneNumber: profileData.phoneNumber || user.phoneNumber || '',
                        })
                        setAvatar(profileData.avatar || user.avatar || '')
                        
                        // Load notification preferences
                        if (profileData.notificationPreferences) {
                            const prefs = profileData.notificationPreferences
                            // Ensure time settings exist
                            if (!prefs.task_due_soon_time) prefs.task_due_soon_time = '1d'
                            if (!prefs.task_overdue_time) prefs.task_overdue_time = '0h'
                            setNotificationPreferences(prefs)
                        } else {
                            // Default: all enabled with default time settings
                            const defaultPreferences = {}
                            Object.values(NOTIFICATION_TYPES).forEach(type => {
                                defaultPreferences[type] = true
                            })
                            // Default time settings
                            defaultPreferences.task_due_soon_time = '1d' // 1 day before
                            defaultPreferences.task_overdue_time = '0h' // Immediately
                            setNotificationPreferences(defaultPreferences)
                        }
                        
                        // Update store with Firestore data
                        setUser({
                            ...user,
                            firstName: profileData.firstName || user.firstName,
                            userName: profileData.userName || user.userName,
                            email: profileData.email || user.email,
                            phoneNumber: profileData.phoneNumber || user.phoneNumber,
                            avatar: profileData.avatar || user.avatar,
                        })
                    } else {
                        // Fallback to store data if Firestore doesn't have profile
                        setFormData({
                            firstName: user.firstName || '',
                            userName: user.userName || '',
                            email: user.email || '',
                            phoneNumber: user.phoneNumber || '',
                        })
                        setAvatar(user.avatar || '')
                        
                        // Default notification preferences
                        const defaultPreferences = {}
                        Object.values(NOTIFICATION_TYPES).forEach(type => {
                            defaultPreferences[type] = true
                        })
                        setNotificationPreferences(defaultPreferences)
                    }
                } else {
                    // Fallback to store data if not authenticated
                    setFormData({
                        firstName: user.firstName || '',
                        userName: user.userName || '',
                        email: user.email || '',
                        phoneNumber: user.phoneNumber || '',
                    })
                    setAvatar(user.avatar || '')
                    
                    // Default notification preferences
                    const defaultPreferences = {}
                    Object.values(NOTIFICATION_TYPES).forEach(type => {
                        defaultPreferences[type] = true
                    })
                    setNotificationPreferences(defaultPreferences)
                }
            } catch (error) {
                console.error('Error loading user profile:', error)
                // Fallback to store data on error
                setFormData({
                    firstName: user.firstName || '',
                    userName: user.userName || '',
                    email: user.email || '',
                    phoneNumber: user.phoneNumber || '',
                })
                setAvatar(user.avatar || '')
                
                // Default notification preferences
                const defaultPreferences = {}
                Object.values(NOTIFICATION_TYPES).forEach(type => {
                    defaultPreferences[type] = true
                })
                setNotificationPreferences(defaultPreferences)
            }
        }

        loadUserProfile()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }))
    }

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0]
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                toast.push(
                    <Notification type="danger" duration={2000} title="Error">
                        Please select an image file
                    </Notification>
                )
                return
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast.push(
                    <Notification type="danger" duration={2000} title="Error">
                        Image size should be less than 5MB
                    </Notification>
                )
                return
            }

            try {
                const auth = getAuth()
                const currentUser = auth.currentUser
                if (!currentUser) {
                    toast.push(
                        <Notification type="danger" duration={2000} title="Error">
                            Please sign in to upload images
                        </Notification>
                    )
                    return
                }

                // Create preview URL for immediate display
                const reader = new FileReader()
                reader.onloadend = () => {
                    const imageUrl = reader.result
                    setAvatar(imageUrl)
                }
                reader.readAsDataURL(file)

                // Upload to Firebase Storage
                const userId = currentUser.uid
                const fileExtension = file.name.split('.').pop()
                const fileName = `avatar.${fileExtension}`
                const path = `users/${userId}/${fileName}`
                const sRef = storageRef(storage, path)

                // Upload file with progress tracking
                await new Promise((resolve, reject) => {
                    const task = uploadBytesResumable(sRef, file)
                    task.on('state_changed', 
                        (snapshot) => {
                            // Progress tracking (optional)
                        },
                        (error) => {
                            reject(error)
                        },
                        () => {
                            resolve()
                        }
                    )
                })
                const downloadURL = await getDownloadURL(sRef)
                
                // Update avatar state with Firebase URL
                setAvatar(downloadURL)
            } catch (error) {
                console.error('Error uploading avatar:', error)
                toast.push(
                    <Notification type="danger" duration={2000} title="Error">
                        Failed to upload image. Please try again.
                    </Notification>
                )
            }
        }
    }

    const handleRemoveImage = async () => {
        try {
            const auth = getAuth()
            const currentUser = auth.currentUser
            if (currentUser && user.avatar) {
                // Try to delete from Firebase Storage if it's a Firebase URL
                if (user.avatar.startsWith('https://firebasestorage.googleapis.com')) {
                    try {
                        // Extract path from URL or construct it
                        const userId = currentUser.uid
                        const path = `users/${userId}/avatar`
                        const sRef = storageRef(storage, path)
                        await deleteObject(sRef)
                    } catch (deleteError) {
                        // If deletion fails, continue anyway (might be a different URL)
                        console.warn('Could not delete old avatar:', deleteError)
                    }
                }
            }
            
            setAvatar('')
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        } catch (error) {
            console.error('Error removing avatar:', error)
            // Still remove from UI even if deletion fails
            setAvatar('')
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleSave = async (e) => {
        // Prevent form submission and page reload
        if (e) {
            e.preventDefault()
            e.stopPropagation()
        }

        // Prevent multiple simultaneous saves
        if (isSavingRef.current) {
            return
        }

        isSavingRef.current = true

        try {
            const auth = getAuth()
            const currentUser = auth.currentUser
            
            if (!currentUser) {
                toast.push(
                    <Notification type="danger" duration={2000} title="Error">
                        Please sign in to save profile
                    </Notification>
                )
                return
            }

            const userId = currentUser.uid

            const userData = {
                firstName: formData.firstName,
                userName: formData.userName,
                email: formData.email,
                phoneNumber: formData.phoneNumber,
                avatar: avatar,
            }

            // Save to Firestore
            const result = await FirebaseDbService.users.upsert(userId, userData)
            
            if (result.success) {
                // Update user in store
                setUser({
                    ...user,
                    ...userData,
                })
                
                // Update form data state to prevent reversion
                setFormData({
                    firstName: formData.firstName,
                    userName: formData.userName,
                    email: formData.email,
                    phoneNumber: formData.phoneNumber,
                })
                // Avatar is already set in state

                toast.push(
                    <Notification type="success" duration={2000} title="Success">
                        Profile updated successfully!
                    </Notification>
                )
            } else {
                throw new Error(result.error || 'Failed to update profile')
            }
        } catch (error) {
            console.error('Error saving profile:', error)
            const errorMessage = error.message || 'Failed to save profile. Please try again.'
            toast.push(
                <Notification type="danger" duration={3000} title="Error">
                    {errorMessage}
                </Notification>
            )
        } finally {
            isSavingRef.current = false
        }
    }

    const handlePasswordChange = (field, value) => {
        setPasswordData((prev) => ({
            ...prev,
            [field]: value,
        }))
    }

    const handleNotificationPreferenceChange = (notificationType, enabled) => {
        setNotificationPreferences((prev) => ({
            ...prev,
            [notificationType]: enabled,
        }))
    }

    const handleSaveNotificationPreferences = async (e) => {
        if (e) {
            e.preventDefault()
            e.stopPropagation()
        }

        if (isSavingPreferences) {
            return
        }

        setIsSavingPreferences(true)

        try {
            const auth = getAuth()
            const currentUser = auth.currentUser
            
            if (!currentUser) {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "danger", duration: 2000, title: "Error" },
                        "Please sign in to save preferences"
                    )
                )
                return
            }

            const userId = currentUser.uid

            // Update user document with notification preferences
            const result = await FirebaseDbService.users.update(userId, {
                notificationPreferences: notificationPreferences
            })
            
            if (result.success) {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "success", duration: 2000, title: "Success" },
                        "Notification preferences saved successfully!"
                    )
                )
            } else {
                throw new Error(result.error || 'Failed to save preferences')
            }
        } catch (error) {
            console.error('Error saving notification preferences:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 3000, title: "Error" },
                    error.message || 'Failed to save preferences. Please try again.'
                )
            )
        } finally {
            setIsSavingPreferences(false)
        }
    }

    const handleUpdatePassword = async (e) => {
        if (e) {
            e.preventDefault()
            e.stopPropagation()
        }

        if (isUpdatingPassword) {
            return
        }

        // Validation
        if (!passwordData.currentPassword) {
            toast.push(
                <Notification type="danger" duration={2000} title="Error">
                    Please enter your current password
                </Notification>
            )
            return
        }

        if (!passwordData.newPassword) {
            toast.push(
                <Notification type="danger" duration={2000} title="Error">
                    Please enter a new password
                </Notification>
            )
            return
        }

        if (passwordData.newPassword.length < 6) {
            toast.push(
                <Notification type="danger" duration={2000} title="Error">
                    New password must be at least 6 characters long
                </Notification>
            )
            return
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.push(
                <Notification type="danger" duration={2000} title="Error">
                    New passwords do not match
                </Notification>
            )
            return
        }

        setIsUpdatingPassword(true)

        try {
            const result = await FirebaseAuthService.updatePassword(
                passwordData.currentPassword,
                passwordData.newPassword
            )

            if (result.success) {
                toast.push(
                    <Notification type="success" duration={2000} title="Success">
                        Password updated successfully!
                    </Notification>
                )
                // Clear password fields
                setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                })
            } else {
                throw new Error(result.error || 'Failed to update password')
            }
        } catch (error) {
            console.error('Error updating password:', error)
            let errorMessage = error.message || 'Failed to update password. Please try again.'
            
            // User-friendly error messages
            if (errorMessage.includes('wrong-password') || errorMessage.includes('invalid-credential')) {
                errorMessage = 'Current password is incorrect'
            } else if (errorMessage.includes('weak-password')) {
                errorMessage = 'Password is too weak. Please choose a stronger password.'
            }
            
            toast.push(
                <Notification type="danger" duration={3000} title="Error">
                    {errorMessage}
                </Notification>
            )
        } finally {
            setIsUpdatingPassword(false)
        }
    }

    const sidebarItems = [
        { key: 'profile', label: 'Profile', icon: <PiUserDuotone /> },
        { key: 'security', label: 'Security', icon: <PiLockDuotone /> },
        { key: 'notification', label: 'Notification', icon: <PiBellDuotone /> },
    ]

    const avatarProps = {
        ...(avatar ? { src: avatar } : { icon: <PiUserDuotone /> }),
        size: 120,
        shape: 'circle',
        className: 'w-20 h-20 md:w-[120px] md:h-[120px]',
    }

    return (
        <div className="flex min-h-screen bg-white dark:bg-gray-900">
            {/* Left Sidebar - Desktop Only */}
            <div className="hidden lg:block w-64 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm">
                <div className="p-6">
                    <Button 
                        variant="plain" 
                        icon={<HiOutlineArrowLeft />} 
                        onClick={() => navigate(-1)}
                        className="mb-8 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors duration-200"
                    >
                        Back
                    </Button>
                </div>

                <div className="px-4 space-y-1">
                    {sidebarItems.map((item) => (
                        <button
                            key={item.key}
                            onClick={() => setActiveTab(item.key)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-300 group ${
                                activeTab === item.key 
                                    ? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg transform scale-[1.02]' 
                                    : 'text-gray-600 hover:bg-white/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/80 dark:hover:text-gray-100 hover:shadow-md hover:transform hover:scale-[1.01]'
                            }`}
                        >
                            <span className={`transition-transform duration-200 ${activeTab === item.key ? 'scale-110' : 'group-hover:scale-105'}`}>
                                {item.icon}
                            </span>
                            <span className="font-medium tracking-wide">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen w-full lg:w-auto">
                {/* Mobile Navigation Bar */}
                <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                    <div className="flex items-center justify-between p-4">
                        <Button 
                            variant="plain" 
                            icon={<HiOutlineArrowLeft />} 
                            onClick={() => navigate(-1)}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        >
                            Back
                        </Button>
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Profile Settings</h1>
                        <div className="w-12"></div> {/* Spacer for centering */}
                    </div>
                    <div className="flex border-t border-gray-200 dark:border-gray-700">
                        {sidebarItems.map((item) => (
                            <button
                                key={item.key}
                                onClick={() => setActiveTab(item.key)}
                                className={`flex-1 flex flex-col items-center justify-center py-3 px-2 transition-all duration-200 ${
                                    activeTab === item.key 
                                        ? 'bg-primary text-white border-b-2 border-primary' 
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                <span className="text-xl mb-1">{item.icon}</span>
                                <span className="text-xs font-medium">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 p-4 md:p-6">
                    {activeTab === 'profile' && (
                        <Card className="p-4 md:p-6">
                            <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Personal Information</h1>
                            
                            {/* Avatar Section */}
                            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6 md:mb-8">
                                <div className="flex justify-center md:justify-start">
                                    <Avatar {...avatarProps} />
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="hidden"
                                        id="avatar-upload"
                                    />
                                    <Button
                                        variant="solid"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full sm:w-auto"
                                        size="sm"
                                    >
                                        + Upload Image
                                    </Button>
                                    <Button
                                        variant="twoTone"
                                        onClick={handleRemoveImage}
                                        className="w-full sm:w-auto"
                                        size="sm"
                                    >
                                        Remove
                                    </Button>
                                </div>
                            </div>

                            {/* Form Fields */}
                            <Form onSubmit={(e) => { e.preventDefault(); handleSave(e); }}>
                                <FormContainer>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormItem label="First name">
                                            <Input
                                                value={formData.firstName}
                                                onChange={(e) => handleInputChange('firstName', e.target.value)}
                                                placeholder="Enter first name"
                                                size="sm"
                                            />
                                        </FormItem>

                                        <FormItem label="User name">
                                            <Input
                                                value={formData.userName}
                                                onChange={(e) => handleInputChange('userName', e.target.value)}
                                                placeholder="Enter user name"
                                                size="sm"
                                            />
                                        </FormItem>
                                    </div>

                                    <FormItem label="Email">
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => handleInputChange('email', e.target.value)}
                                            placeholder="Enter email"
                                            size="sm"
                                        />
                                    </FormItem>

                                    <FormItem label="Phone number">
                                        <Input
                                            type="tel"
                                            value={formData.phoneNumber}
                                            onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                                            placeholder="Enter phone number"
                                            size="sm"
                                        />
                                    </FormItem>

                                    <FormItem>
                                        <Button
                                            type="button"
                                            variant="solid"
                                            onClick={(e) => handleSave(e)}
                                            className="w-full sm:w-auto"
                                            size="sm"
                                        >
                                            Save
                                        </Button>
                                    </FormItem>
                                </FormContainer>
                            </Form>
                        </Card>
                    )}

                    {activeTab === 'security' && (
                        <div className="space-y-6 md:space-y-8">
                            {/* Password Section */}
                            <Card className="p-4 md:p-6">
                                <h1 className="text-xl md:text-2xl font-bold text-primary mb-2">Password</h1>
                                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mb-4 md:mb-6">
                                    Remember, your password is your digital key to your account. Keep it safe, keep it secure!
                                </p>
                                
                                <Form onSubmit={handleUpdatePassword}>
                                    <FormContainer>
                                        <FormItem label="Current password">
                                            <PasswordInput
                                                value={passwordData.currentPassword}
                                                onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                                                placeholder="Enter current password"
                                                size="sm"
                                            />
                                        </FormItem>

                                        <FormItem label="New password">
                                            <PasswordInput
                                                value={passwordData.newPassword}
                                                onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                                                placeholder="Enter new password"
                                                size="sm"
                                            />
                                        </FormItem>

                                        <FormItem label="Confirm new password">
                                            <PasswordInput
                                                value={passwordData.confirmPassword}
                                                onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                                                placeholder="Confirm new password"
                                                size="sm"
                                            />
                                        </FormItem>

                                        <FormItem>
                                            <div className="flex justify-end">
                                                <Button
                                                    type="button"
                                                    variant="solid"
                                                    onClick={handleUpdatePassword}
                                                    loading={isUpdatingPassword}
                                                    className="w-full sm:w-auto"
                                                    size="sm"
                                                >
                                                    Update
                                                </Button>
                                            </div>
                                        </FormItem>
                                    </FormContainer>
                                </Form>
                            </Card>

                            {/* 2-Step Verification Section */}
                            <Card className="p-4 md:p-6">
                                <h1 className="text-xl md:text-2xl font-bold mb-2">2-Step verification</h1>
                                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mb-4 md:mb-6">
                                    Your account holds great value to hackers. Enable two-step verification to safeguard your account!
                                </p>
                                
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div className="flex-shrink-0 mx-auto sm:mx-0">
                                        <div className="w-16 h-16 rounded-full border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-gray-900">
                                            <img
                                                src="/img/others/google.png"
                                                alt="Google"
                                                className="w-10 h-10"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 text-center sm:text-left">
                                        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">
                                            Google Authenticator
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Using Google Authenticator app generates time-sensitive codes for secure logins.
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0 w-full sm:w-auto">
                                        <Button
                                            variant="outline"
                                            className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 dark:text-green-400 dark:border-green-500 w-full sm:w-auto"
                                            disabled
                                            size="sm"
                                        >
                                            Coming Soon
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'notification' && (
                        <Card className="p-4 md:p-6">
                            <h1 className="text-xl md:text-2xl font-bold mb-2">Notification Preferences</h1>
                            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mb-4 md:mb-6">
                                Choose which notifications you want to receive. You can customize your preferences for different types of activities.
                            </p>
                            
                            <Form onSubmit={handleSaveNotificationPreferences}>
                                <FormContainer>
                                    {/* Task Notifications */}
                                    <div className="mb-6 md:mb-8">
                                        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-900 dark:text-gray-100">Task Notifications</h2>
                                        <div className="space-y-3 md:space-y-4">
                                            <div className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Task Assigned</p>
                                                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Get notified when a task is assigned to you</p>
                                                </div>
                                                <Switcher
                                                    checked={notificationPreferences[NOTIFICATION_TYPES.TASK_ASSIGNED] !== false}
                                                    onChange={(checked) => handleNotificationPreferenceChange(NOTIFICATION_TYPES.TASK_ASSIGNED, checked)}
                                                />
                                            </div>
                                            
                                            <div className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Task Completed</p>
                                                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Get notified when a task is completed</p>
                                                </div>
                                                <Switcher
                                                    checked={notificationPreferences[NOTIFICATION_TYPES.TASK_COMPLETED] !== false}
                                                    onChange={(checked) => handleNotificationPreferenceChange(NOTIFICATION_TYPES.TASK_COMPLETED, checked)}
                                                />
                                            </div>
                                            
                                            <div className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Task Updated</p>
                                                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Get notified when a task is updated</p>
                                                </div>
                                                <Switcher
                                                    checked={notificationPreferences[NOTIFICATION_TYPES.TASK_UPDATED] !== false}
                                                    onChange={(checked) => handleNotificationPreferenceChange(NOTIFICATION_TYPES.TASK_UPDATED, checked)}
                                                />
                                            </div>
                                            
                                            <div className="p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Task Due Soon</p>
                                                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Get notified when a task is approaching its due date</p>
                                                    </div>
                                                    <Switcher
                                                        checked={notificationPreferences[NOTIFICATION_TYPES.TASK_DUE_SOON] !== false}
                                                        onChange={(checked) => handleNotificationPreferenceChange(NOTIFICATION_TYPES.TASK_DUE_SOON, checked)}
                                                    />
                                                </div>
                                                {notificationPreferences[NOTIFICATION_TYPES.TASK_DUE_SOON] !== false && (
                                                    <div className="pl-2 md:pl-4 border-l-2 border-primary/20">
                                                        <label className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                                            Notify me:
                                                        </label>
                                                        <Select
                                                            size="sm"
                                                            options={timeOptions}
                                                            menuPortalTarget={document.body}
                                                            menuPosition="fixed"
                                                            value={timeOptions.find(opt => opt.value === (notificationPreferences.task_due_soon_time || '1d'))}
                                                            onChange={(option) => {
                                                                setNotificationPreferences(prev => ({
                                                                    ...prev,
                                                                    task_due_soon_time: option.value
                                                                }))
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Task Overdue</p>
                                                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Get notified when a task becomes overdue</p>
                                                    </div>
                                                    <Switcher
                                                        checked={notificationPreferences[NOTIFICATION_TYPES.TASK_OVERDUE] !== false}
                                                        onChange={(checked) => handleNotificationPreferenceChange(NOTIFICATION_TYPES.TASK_OVERDUE, checked)}
                                                    />
                                                </div>
                                                {notificationPreferences[NOTIFICATION_TYPES.TASK_OVERDUE] !== false && (
                                                    <div className="pl-2 md:pl-4 border-l-2 border-primary/20">
                                                        <label className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                                            Notify me:
                                                        </label>
                                                        <Select
                                                            size="sm"
                                                            options={overdueTimeOptions}
                                                            menuPortalTarget={document.body}
                                                            menuPosition="fixed"
                                                            value={overdueTimeOptions.find(opt => opt.value === (notificationPreferences.task_overdue_time || '0h'))}
                                                            onChange={(option) => {
                                                                setNotificationPreferences(prev => ({
                                                                    ...prev,
                                                                    task_overdue_time: option.value
                                                                }))
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Entity Notifications */}
                                    <div className="mb-6 md:mb-8">
                                        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-900 dark:text-gray-100">Entity Notifications</h2>
                                        <div className="space-y-3 md:space-y-4">
                                            <div className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Entity Created</p>
                                                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Get notified when a new lead, client, or project is created</p>
                                                </div>
                                                <Switcher
                                                    checked={notificationPreferences[NOTIFICATION_TYPES.ENTITY_CREATED] !== false}
                                                    onChange={(checked) => handleNotificationPreferenceChange(NOTIFICATION_TYPES.ENTITY_CREATED, checked)}
                                                />
                                            </div>
                                            
                                            <div className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Entity Updated</p>
                                                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Get notified when a lead, client, or project is updated</p>
                                                </div>
                                                <Switcher
                                                    checked={notificationPreferences[NOTIFICATION_TYPES.ENTITY_UPDATED] !== false}
                                                    onChange={(checked) => handleNotificationPreferenceChange(NOTIFICATION_TYPES.ENTITY_UPDATED, checked)}
                                                />
                                            </div>
                                            
                                            <div className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Status Changed</p>
                                                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Get notified when the status of a lead, client, or project changes</p>
                                                </div>
                                                <Switcher
                                                    checked={notificationPreferences[NOTIFICATION_TYPES.ENTITY_STATUS_CHANGED] !== false}
                                                    onChange={(checked) => handleNotificationPreferenceChange(NOTIFICATION_TYPES.ENTITY_STATUS_CHANGED, checked)}
                                                />
                                            </div>
                                            
                                            <div className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Entity Deleted</p>
                                                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Get notified when a lead, client, or project is deleted</p>
                                                </div>
                                                <Switcher
                                                    checked={notificationPreferences[NOTIFICATION_TYPES.ENTITY_DELETED] !== false}
                                                    onChange={(checked) => handleNotificationPreferenceChange(NOTIFICATION_TYPES.ENTITY_DELETED, checked)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Attachment Notifications */}
                                    <div className="mb-6 md:mb-8">
                                        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-900 dark:text-gray-100">Attachment Notifications</h2>
                                        <div className="space-y-3 md:space-y-4">
                                            <div className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Attachment Added</p>
                                                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Get notified when a file is uploaded</p>
                                                </div>
                                                <Switcher
                                                    checked={notificationPreferences[NOTIFICATION_TYPES.ATTACHMENT_ADDED] !== false}
                                                    onChange={(checked) => handleNotificationPreferenceChange(NOTIFICATION_TYPES.ATTACHMENT_ADDED, checked)}
                                                />
                                            </div>
                                            
                                            <div className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Attachment Deleted</p>
                                                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Get notified when a file is deleted</p>
                                                </div>
                                                <Switcher
                                                    checked={notificationPreferences[NOTIFICATION_TYPES.ATTACHMENT_DELETED] !== false}
                                                    onChange={(checked) => handleNotificationPreferenceChange(NOTIFICATION_TYPES.ATTACHMENT_DELETED, checked)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Activity Notifications */}
                                    <div className="mb-6 md:mb-8">
                                        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-900 dark:text-gray-100">Activity Notifications</h2>
                                        <div className="space-y-3 md:space-y-4">
                                            <div className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">Activity Added</p>
                                                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Get notified when a new activity is logged</p>
                                                </div>
                                                <Switcher
                                                    checked={notificationPreferences[NOTIFICATION_TYPES.ACTIVITY_ADDED] !== false}
                                                    onChange={(checked) => handleNotificationPreferenceChange(NOTIFICATION_TYPES.ACTIVITY_ADDED, checked)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* System Notifications */}
                                    <div className="mb-6 md:mb-8">
                                        <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-900 dark:text-gray-100">System Notifications</h2>
                                        <div className="space-y-3 md:space-y-4">
                                            <div className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">System Notifications</p>
                                                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Get notified about important system updates and announcements</p>
                                                </div>
                                                <Switcher
                                                    checked={notificationPreferences[NOTIFICATION_TYPES.SYSTEM] !== false}
                                                    onChange={(checked) => handleNotificationPreferenceChange(NOTIFICATION_TYPES.SYSTEM, checked)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Profit Sharing Notifications (visible only if user has access) */}
                                    {hasProfitSharingAccess && (
                                        <div className="mb-6 md:mb-8">
                                            <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-900 dark:text-gray-100">
                                                Profit Sharing
                                            </h2>
                                            <div className="space-y-3 md:space-y-4">
                                                <div className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">
                                                            Profit Sharing updates
                                                        </p>
                                                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                                                            Get notified when you are added to Profit Sharing, awards are set up for you, and upcoming payouts are updated.
                                                        </p>
                                                    </div>
                                                    <Switcher
                                                        checked={notificationPreferences[NOTIFICATION_TYPES.PROFIT_SHARING] !== false}
                                                        onChange={(checked) =>
                                                            handleNotificationPreferenceChange(
                                                                NOTIFICATION_TYPES.PROFIT_SHARING,
                                                                checked
                                                            )
                                                        }
                                                    />
                                                </div>
                                                
                                                {/* Admin-only Profit Sharing notifications */}
                                                {profitSharingUserRole === 'admin' && (
                                                    <div className="flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">
                                                                Profit Sharing (Admin)
                                                            </p>
                                                            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                                                                Get notified about new valuations, payment date reminders, new plans, and user access changes.
                                                            </p>
                                                        </div>
                                                        <Switcher
                                                            checked={notificationPreferences[NOTIFICATION_TYPES.PROFIT_SHARING_ADMIN] !== false}
                                                            onChange={(checked) =>
                                                                handleNotificationPreferenceChange(
                                                                    NOTIFICATION_TYPES.PROFIT_SHARING_ADMIN,
                                                                    checked
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <FormItem>
                                        <div className="flex justify-end">
                                            <Button
                                                type="button"
                                                variant="solid"
                                                onClick={handleSaveNotificationPreferences}
                                                loading={isSavingPreferences}
                                                className="w-full sm:w-auto"
                                                size="sm"
                                            >
                                                Save Preferences
                                            </Button>
                                        </div>
                                    </FormItem>
                                </FormContainer>
                            </Form>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Profile

