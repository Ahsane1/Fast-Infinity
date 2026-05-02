import axios from 'axios';
import useStore from '../store/useStore';

const axiosClient = axios.create({
    baseURL: 'http://localhost:5000/api',
});

// Automatically attach the token to every request
axiosClient.interceptors.request.use((config) => {
    const token = useStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default axiosClient;
