import classNames from 'classnames'
import { APP_NAME } from '@/constants/app.constant'

const LOGO_SRC_PATH = '/img/newLogoFav/BOLT Logo.png'

const Logo = (props) => {
    const {
        type = 'full',
        mode = 'light',
        className,
        imgClass,
        style,
        logoWidth = 'auto',
    } = props

    return (
        <div
            className={classNames('logo', className)}
            style={{
                ...style,
                ...{ width: logoWidth },
            }}
        >
            <img
                className={imgClass}
                src={LOGO_SRC_PATH}
                alt={`${APP_NAME} logo`}
            />
        </div>
    )
}

export default Logo
