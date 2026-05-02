import { create } from 'zustand'

const useStore = create((set) => ({

    user: null,
    token: localStorage.getItem('token') || null,

    dashboard: null,

    login: (userData, token) => {
        localStorage.setItem('token', token);
        set({ user: userData, token: token });
    },

    logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, dashboard: null });
    },

    setDashboardData: (data) => set({ dashboard: data }),

    deductBalance: (amount) => set((state) => ({
        dashboard: {
            ...state.dashboard,
            current_balance: (parseFloat(state.dashboard.current_balance) - amount).toFixed(2)
        }
    })),

    addBalance: (amount) => set((state) => ({
        dashboard: {
            ...state.dashboard,
            current_balance: (parseFloat(state.dashboard.current_balance) + amount).toFixed(2)
        }
    }))
}));

export default useStore;
