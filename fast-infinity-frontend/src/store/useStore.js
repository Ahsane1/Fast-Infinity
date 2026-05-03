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

    // --- THEME STATE & LOGIC ---
    // Pull theme from localStorage; default to 'dark'
    theme: localStorage.getItem('theme') || 'dark', 

    toggleTheme: () => set((state) => {
        const newTheme = state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        
        // Anti-flicker manual DOM injection
        // This ensures the theme swap is immediate across the entire app
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        return { theme: newTheme };
    }),

    // --- AUTH ACTIONS ---
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

    // --- DASHBOARD ACTIONS ---
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