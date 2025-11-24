import classNames from '@/utils/classNames'

const ToolButton = (props) => {
    const { className, disabled, active, ...rest } = props

    return (
        <button
            className={classNames(
                'tool-button text-base md:text-xl heading-text hover:text-primary flex items-center p-1 md:p-1.5 rounded-lg flex-shrink-0',
                active && 'text-primary',
                disabled && 'opacity-20 cursor-not-allowed',
                className,
            )}
            type="button"
            disabled={disabled}
            {...rest}
        />
    )
}

export default ToolButton
