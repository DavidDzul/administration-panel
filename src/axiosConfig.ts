import axios from 'axios'
import { API_URL } from '@/constants'

axios.defaults.withCredentials = true
axios.defaults.baseURL = API_URL

export default axios
