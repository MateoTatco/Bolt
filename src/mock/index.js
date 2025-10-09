import { mock } from './MockAdapter'
import './fakeApi/authFakeApi'
import './fakeApi/commonFakeApi'
import './fakeApi/leadsFakeApi'

mock.onAny().passThrough()
