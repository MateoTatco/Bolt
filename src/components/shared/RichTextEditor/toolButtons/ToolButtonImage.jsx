import { useRef } from 'react'
import { TbPhoto } from 'react-icons/tb'
import ToolButton from './ToolButton'

const ToolButtonImage = ({ editor }) => {
    const fileInputRef = useRef(null)

    const onPick = () => {
        fileInputRef.current?.click()
    }

    const onFileChange = (e) => {
        const file = e.target.files && e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
            const src = reader.result
            if (typeof src === 'string') {
                editor?.chain().focus().setImage({ src }).run()
            }
            e.target.value = ''
        }
        reader.readAsDataURL(file)
    }

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
            />
            <ToolButton title="Insert image" onClick={onPick}>
                <TbPhoto />
            </ToolButton>
        </>
    )
}

export default ToolButtonImage


