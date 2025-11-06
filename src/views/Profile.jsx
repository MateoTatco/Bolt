import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Card, Button, Input, Form, FormItem, FormContainer, Avatar } from '@/components/ui'
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
    }

    return (
        <div className="flex min-h-screen bg-white dark:bg-gray-900">
            {/* Left Sidebar */}
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
            <div className="flex-1 flex flex-col min-h-screen">
                <div className="flex-1 p-6">
                    {activeTab === 'profile' && (
                        <Card className="p-6">
                            <h1 className="text-2xl font-bold mb-6">Personal Information</h1>
                            
                            {/* Avatar Section */}
                            <div className="flex items-center gap-4 mb-8">
                                <Avatar {...avatarProps} />
                                <div className="flex gap-2">
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
                                    >
                                        + Upload Image
                                    </Button>
                                    <Button
                                        variant="twoTone"
                                        onClick={handleRemoveImage}
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
                                            />
                                        </FormItem>

                                        <FormItem label="User name">
                                            <Input
                                                value={formData.userName}
                                                onChange={(e) => handleInputChange('userName', e.target.value)}
                                                placeholder="Enter user name"
                                            />
                                        </FormItem>
                                    </div>

                                    <FormItem label="Email">
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => handleInputChange('email', e.target.value)}
                                            placeholder="Enter email"
                                        />
                                    </FormItem>

                                    <FormItem label="Phone number">
                                        <Input
                                            type="tel"
                                            value={formData.phoneNumber}
                                            onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                                            placeholder="Enter phone number"
                                        />
                                    </FormItem>

                                    <FormItem>
                                        <Button
                                            type="button"
                                            variant="solid"
                                            onClick={(e) => handleSave(e)}
                                        >
                                            Save
                                        </Button>
                                    </FormItem>
                                </FormContainer>
                            </Form>
                        </Card>
                    )}

                    {activeTab === 'security' && (
                        <div className="space-y-8">
                            {/* Password Section */}
                            <Card className="p-6">
                                <h1 className="text-2xl font-bold text-primary mb-2">Password</h1>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    Remember, your password is your digital key to your account. Keep it safe, keep it secure!
                                </p>
                                
                                <Form onSubmit={handleUpdatePassword}>
                                    <FormContainer>
                                        <FormItem label="Current password">
                                            <PasswordInput
                                                value={passwordData.currentPassword}
                                                onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                                                placeholder="Enter current password"
                                            />
                                        </FormItem>

                                        <FormItem label="New password">
                                            <PasswordInput
                                                value={passwordData.newPassword}
                                                onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                                                placeholder="Enter new password"
                                            />
                                        </FormItem>

                                        <FormItem label="Confirm new password">
                                            <PasswordInput
                                                value={passwordData.confirmPassword}
                                                onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                                                placeholder="Confirm new password"
                                            />
                                        </FormItem>

                                        <FormItem>
                                            <div className="flex justify-end">
                                                <Button
                                                    type="button"
                                                    variant="solid"
                                                    onClick={handleUpdatePassword}
                                                    loading={isUpdatingPassword}
                                                >
                                                    Update
                                                </Button>
                                            </div>
                                        </FormItem>
                                    </FormContainer>
                                </Form>
                            </Card>

                            {/* 2-Step Verification Section */}
                            <Card className="p-6">
                                <h1 className="text-2xl font-bold mb-2">2-Step verification</h1>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    Your account holds great value to hackers. Enable two-step verification to safeguard your account!
                                </p>
                                
                                <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div className="flex-shrink-0">
                                        <div className="w-16 h-16 rounded-full border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-gray-900">
                                            <img
                                                src="/img/others/google.png"
                                                alt="Google"
                                                className="w-10 h-10"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">
                                            Google Authenticator
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Using Google Authenticator app generates time-sensitive codes for secure logins.
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <Button
                                            variant="outline"
                                            className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 dark:text-green-400 dark:border-green-500"
                                            disabled
                                        >
                                            Coming Soon
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'notification' && (
                        <Card className="p-6">
                            <h1 className="text-2xl font-bold mb-6">Notification</h1>
                            <p className="text-gray-600 dark:text-gray-400">Notification settings coming soon...</p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Profile

