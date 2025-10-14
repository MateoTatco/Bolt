import { mock } from './MockAdapter'
import './fakeApi/authFakeApi'
import './fakeApi/commonFakeApi'
import './fakeApi/leadsFakeApi'
import './fakeApi/clientsFakeApi'

mock.onAny().passThrough()
