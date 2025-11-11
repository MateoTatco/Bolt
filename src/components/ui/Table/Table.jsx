import { useRef, useEffect } from 'react'
import classNames from 'classnames'

const Table = (props) => {
    const {
        asElement: Component = 'table',
        cellBorder,
        children,
        className,
        compact = false,
        hoverable = true,
        overflow = true,
        ref,
        ...rest
    } = props

    const tableWrapperRef = useRef(null)
    const topScrollbarRef = useRef(null)

    // Sync top scrollbar with main scroll and set width
    useEffect(() => {
        if (!overflow || !tableWrapperRef.current || !topScrollbarRef.current) return

        const tableWrapper = tableWrapperRef.current
        const topScrollbar = topScrollbarRef.current
        const table = tableWrapper.querySelector('table')

        const updateScrollbar = () => {
            if (table) {
                const scrollWidth = table.scrollWidth
                topScrollbar.scrollLeft = tableWrapper.scrollLeft
                // Match the scrollbar content width to table width
                const scrollbarContent = topScrollbar.querySelector('div')
                if (scrollbarContent) {
                    scrollbarContent.style.minWidth = `${scrollWidth}px`
                }
            }
        }

        const handleScroll = () => {
            topScrollbar.scrollLeft = tableWrapper.scrollLeft
        }

        // Initial update
        updateScrollbar()

        // Update on resize
        const resizeObserver = new ResizeObserver(updateScrollbar)
        if (table) {
            resizeObserver.observe(table)
        }

        tableWrapper.addEventListener('scroll', handleScroll)
        return () => {
            tableWrapper.removeEventListener('scroll', handleScroll)
            resizeObserver.disconnect()
        }
    }, [overflow])

    const tableClass = classNames(
        Component === 'table' ? 'table-default' : 'table-flex',
        hoverable && 'table-hover',
        compact && 'table-compact',
        cellBorder && 'table-border',
        className,
    )

    return (
        <div className="relative">
            {/* Subtle top scrollbar */}
            {overflow && (
                <div 
                    ref={topScrollbarRef}
                    className="overflow-x-auto mb-1 opacity-30 hover:opacity-60 transition-opacity scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent pointer-events-auto"
                    style={{ height: '8px' }}
                    onScroll={(e) => {
                        if (tableWrapperRef.current) {
                            tableWrapperRef.current.scrollLeft = e.target.scrollLeft
                        }
                    }}
                >
                    <div style={{ height: '1px', minWidth: '100%' }}></div>
                </div>
            )}
            <div 
                ref={tableWrapperRef}
                className={classNames(
                    overflow && 'overflow-x-auto',
                    'scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent'
                )}
                style={{
                    WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
                }}
            >
                <Component className={tableClass} {...rest} ref={ref}>
                    {children}
                </Component>
            </div>
        </div>
    )
}

export default Table
