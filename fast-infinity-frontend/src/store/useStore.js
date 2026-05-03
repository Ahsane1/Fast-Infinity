import { create } from 'zustand'

// Helper function to safely pull the user from localStorage on reload
const getSavedUser = () => {
    try {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
};

const useStore = create((set) => ({

    // Initialize with data from localStorage instead of null
    user: getSavedUser(),
    token: localStorage.getItem('token') || null,

    dashboard: null,

    login: (userData, token) => {
        // Save BOTH token and user data to localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        
        set({ user: userData, token: token });
    },

    logout: () => {
        // Clear BOTH on logout
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        set({ user: null, token: null, dashboard: null });
    },

    setDashboardData: (data) => set({ dashboard: data }),

    deductBalance: (amount) => set((state) => ({
        dashboard: state.dashboard ? {
            ...state.dashboard,
            current_balance: (parseFloat(state.dashboard.current_balance) - amount).toFixed(2)
        } : null
    })),

    addBalance: (amount) => set((state) => ({
        dashboard: state.dashboard ? {
            ...state.dashboard,
            current_balance: (parseFloat(state.dashboard.current_balance) + amount).toFixed(2)
        } : null
    }))
}));

export default useStore;