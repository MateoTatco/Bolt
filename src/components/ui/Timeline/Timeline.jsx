import { Children } from 'react'
import classNames from 'classnames'
import mapCloneElement from '../utils/mapCloneElement'

const Timeline = (props) => {
    const { children, className, ref } = props

    const count = Children.count(children)

    // Only pass isLast to the composed TimeLineItem component and avoid leaking to DOM
    const items = mapCloneElement(children, (item, index) => {
        const { isLast: _ignored, ...restProps } = item.props || {}
        return {
            isLast: index === count - 1,
            ...restProps,
        }
    })

    return (
        <ul ref={ref} className={classNames('timeline', className)}>
            {items}
        </ul>
    )
}

export default Timeline
