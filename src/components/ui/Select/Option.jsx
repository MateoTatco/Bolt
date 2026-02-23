import { useEffect, useRef, useCallback } from 'react'
import classNames from 'classnames'
import { HiCheck } from 'react-icons/hi'

const Option = (props) => {
    const { innerProps, label, isSelected, isFocused, isDisabled, data, customLabel } =
        props
    const elRef = useRef(null)
    const { ref: innerRef, ...restInnerProps } = innerProps || {}

    // Keep react-select's ref and our ref in sync; scroll into view when focused (keyboard nav)
    const setRef = useCallback(
        (node) => {
            elRef.current = node
            if (typeof innerRef === 'function') {
                innerRef(node)
            } else if (innerRef) {
                innerRef.current = node
            }
        },
        [innerRef],
    )

    useEffect(() => {
        if (isFocused && elRef.current) {
            elRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
    }, [isFocused])

    return (
        <div
            ref={setRef}
            className={classNames(
                'select-option',
                !isDisabled &&
                    !isSelected &&
                    'hover:text-gray-800 dark:hover:text-gray-100 hover:bg-blue-200 dark:hover:bg-blue-600/50',
                isSelected && 'text-primary bg-primary-subtle',
                isFocused && !isSelected && 'bg-blue-200 dark:bg-blue-600/50',
                isDisabled && 'opacity-50 cursor-not-allowed',
            )}
            {...restInnerProps}
        >
            {customLabel ? (
                customLabel(data, label)
            ) : (
                <span className="ml-2">{label}</span>
            )}
            {isSelected && <HiCheck className="text-xl" />}
        </div>
    )
}

export default Option
