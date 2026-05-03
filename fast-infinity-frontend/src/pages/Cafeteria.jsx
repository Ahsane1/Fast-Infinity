import { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import axiosClient from '../api/axiosClient';

const ADMIN_ROLL_NUMBERS = ['24L-0561', '24L-3062', '24L-0556']; // Example admin roll numbers

const CAFETERIA_CATEGORIES = ['Meals', 'Snacks', 'Drinks', 'Desserts', 'Breakfast', 'Other'];

const formatRs = (amount) => {
    return Number(amount || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

// ── Add Item Modal ────────────────────────────────────────────────────────────
function AddCafeteriaItemModal({ onClose, onAdded }) {
    const [form, setForm] = useState({
        item_name: '', description: '', price: '', stock_quantity: '', category: '', is_active: true,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const [success, setSuccess] = useState('');

    const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        setLoading(true);
        try {
            const res = await axiosClient.post('/admin/cafeteria/add-item', {
                item_name:      form.item_name.trim(),
                description:    form.description.trim() || undefined,
                price:          parseFloat(form.price),
                stock_quantity: parseInt(form.stock_quantity),
                category:       form.category,
            });
            setSuccess(res.data.message);
            setForm({ item_name: '', description: '', price: '', stock_quantity: '', category: '', is_active: true });
            onAdded(res.data.item);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add item.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
                    <div>
                        <h2 className="text-xl font-bold text-white">Add Cafeteria Item</h2>
                        <p className="text-xs text-gray-500 mt-0.5">New item will be immediately available on the menu</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none transition">×</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error   && <div className="rounded-lg bg-red-500/15 border border-red-500/40 p-3 text-sm text-red-400">{error}</div>}
                    {success && <div className="rounded-lg bg-green-500/15 border border-green-500/40 p-3 text-sm text-green-400">{success}</div>}

                    {/* Item Name */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Item Name <span className="text-red-400">*</span></label>
                        <input
                            type="text" required value={form.item_name}
                            onChange={e => set('item_name', e.target.value)}
                            placeholder="e.g. Chicken Shawarma"
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 p-3 text-white outline-none transition"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Description <span className="text-gray-600">(optional)</span></label>
                        <textarea
                            value={form.description}
                            onChange={e => set('description', e.target.value)}
                            placeholder="e.g. Grilled chicken with garlic sauce"
                            rows={2}
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 p-3 text-white outline-none transition resize-none"
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Category <span className="text-red-400">*</span></label>
                        <select
                            required value={form.category}
                            onChange={e => set('category', e.target.value)}
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 p-3 text-white outline-none transition"
                        >
                            <option value="">Select a category…</option>
                            {CAFETERIA_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Price + Stock */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Price (Rs.) <span className="text-red-400">*</span></label>
                            <input
                                type="number" required min="0.01" step="0.01" value={form.price}
                                onChange={e => set('price', e.target.value)}
                                placeholder="e.g. 150"
                                className="w-full rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 p-3 text-white outline-none transition"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Stock Qty <span className="text-red-400">*</span></label>
                            <input
                                type="number" required min="0" step="1" value={form.stock_quantity}
                                onChange={e => set('stock_quantity', e.target.value)}
                                placeholder="e.g. 50"
                                className="w-full rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 p-3 text-white outline-none transition"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 rounded-lg border border-gray-700 py-3 font-bold text-gray-400 hover:text-white hover:border-gray-500 transition">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed py-3 font-bold text-white transition">
                            {loading ? 'Adding…' : 'Add Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Cafeteria() {
    const [menu,        setMenu]        = useState([]);
    const [cart,        setCart]        = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState('');
    const [checkoutMsg, setCheckoutMsg] = useState('');
    const [showModal,   setShowModal]   = useState(false);
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    const { deductBalance, dashboard } = useStore();
    const isAdmin = ADMIN_ROLL_NUMBERS.includes(dashboard?.roll_number);

    useEffect(() => {
        axiosClient.get('/cafeteria/menu')
            .then(r => { setMenu(r.data); setLoading(false); })
            .catch(() => { setError('Failed to load the menu.'); setLoading(false); });
    }, []);

    // Increments quantity, or adds new item if it doesn't exist
    const addToCart = (item) => setCart(prev => {
        const ex = prev.find(c => c.item_id === item.item_id);
        return ex
            ? prev.map(c => c.item_id === item.item_id ? { ...c, quantity: c.quantity + 1 } : c)
            : [...prev, { ...item, quantity: 1 }];
    });

    // Decrements quantity, or removes item completely if quantity hits 0
    const handleDecrement = (itemId) => setCart(prev => {
        const existingItem = prev.find(c => c.item_id === itemId);
        if (existingItem.quantity > 1) {
            return prev.map(c => 
                c.item_id === itemId ? { ...c, quantity: c.quantity - 1 } : c
            );
        } else {
            return prev.filter(c => c.item_id !== itemId);
        }
    });

    const cartTotal = cart.reduce((t, i) => t + i.price * i.quantity, 0);

    const handleCheckout = async () => {
        if (!cart.length) return;
        setError(''); setCheckoutMsg('');
        try {
            const res = await axiosClient.post('/cafeteria/checkout', {
                student_id: useStore.getState().user.id,
                items: cart.map(i => ({ item_id: i.item_id, quantity: i.quantity })),
            });
            setCheckoutMsg(`Success! Order #${res.data.order_id} placed.`);
            deductBalance(res.data.total_charged);
            setCart([]);
        } catch (err) {
            setError(err.response?.data?.error || 'Checkout failed.');
        }
    };

    const handleItemAdded = (newItem) => {
        setMenu(prev => [...prev, newItem]);
    };

    const filteredMenu = menu.filter(item => 
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="text-gray-400">Loading menu...</div>;

    return (
        <>
            {showModal && (
                <AddCafeteriaItemModal
                    onClose={() => setShowModal(false)}
                    onAdded={handleItemAdded}
                />
            )}

            <div className="flex h-full gap-8">
                {/* LEFT: Menu */}
                <div className="flex-1 space-y-6 overflow-y-auto pr-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white">Campus Cafeteria</h1>
                            <p className="mt-2 text-gray-400">Grab a bite using your campus wallet.</p>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={() => setShowModal(true)}
                                className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-bold text-white transition shadow-lg"
                                title="Add new menu item"
                            >
                                <span className="text-lg leading-none">+</span>
                                Add Item
                            </button>
                        )}
                    </div>

                    {/* Search Bar UI */}
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Search for items or categories..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-xl border border-gray-700 bg-gray-800 p-4 pl-12 text-white outline-none focus:border-blue-500 transition"
                        />
                        <span className="absolute left-4 top-4 text-xl select-none">🔍</span>
                    </div>

                    {error       && <div className="rounded bg-red-500/20 p-4 text-red-400 border border-red-500/50">{error}</div>}
                    {checkoutMsg && <div className="rounded bg-green-500/20 p-4 text-green-400 border border-green-500/50">{checkoutMsg}</div>}

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {/* Empty state for search */}
                        {filteredMenu.length === 0 && !loading && (
                            <p className="text-gray-500 col-span-2 text-center py-8">No items found matching "{searchQuery}"</p>
                        )}
                        {/* Menu Items */}
                        {filteredMenu.map(item => (
                            <div key={item.item_id} className="flex flex-col justify-between rounded-xl border border-gray-700 bg-gray-800 p-5 shadow">
                                <div>
                                    <div className="flex justify-between">
                                        <h3 className="font-bold text-white">{item.item_name}</h3>
                                        <span className="font-semibold text-green-400 whitespace-nowrap">Rs. {formatRs(item.price)}</span>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500 uppercase tracking-wider">{item.category}</p>
                                    {item.description && <p className="mt-1 text-sm text-gray-400">{item.description}</p>}
                                    <p className="mt-2 text-sm text-gray-500">Stock: {item.stock_quantity}</p>
                                </div>
                                <button onClick={() => addToCart(item)}
                                    className="mt-4 w-full rounded bg-blue-600 py-2 text-sm font-bold text-white transition hover:bg-blue-500">
                                    Add to Cart
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Cart */}
                <div className="w-80 rounded-xl border border-gray-700 bg-gray-800 p-6 flex flex-col h-[calc(100vh-10rem)] sticky top-0">
                    <h2 className="text-xl font-bold text-white mb-4 border-b border-gray-700 pb-2">Your Basket</h2>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-1">
                        {cart.length === 0 ? (
                            <p className="text-gray-500 text-sm mt-2">Your basket is empty.</p>
                        ) : cart.map(item => (
                            <div key={item.item_id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                                <div>
                                    <p className="text-sm font-medium text-white">{item.item_name}</p>
                                    <p className="text-xs text-gray-400">Rs. {formatRs(item.price * item.quantity)}</p>
                                </div>
                                
                                <div className="flex items-center space-x-3 rounded-lg border border-white/10 bg-white/5 px-2 py-1 backdrop-blur-sm">
                                    <button
                                        onClick={() => handleDecrement(item.item_id)}
                                        className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-500/20 hover:text-red-400"
                                    >
                                        -
                                    </button>
                                    
                                    <span className="w-4 text-center text-sm font-bold text-white">
                                        {item.quantity}
                                    </span>
                                    
                                    <button
                                        onClick={() => addToCart(item)}
                                        className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-blue-500/20 hover:text-blue-400"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="flex justify-between mb-6">
                            <span className="text-gray-400">Total:</span>
                            <span className="font-bold text-green-400 text-xl">Rs. {formatRs(cartTotal)}</span>
                        </div>
                        
                        {/* NEW: Modern Glassy Loop Button */}
                        <button 
                            onClick={handleCheckout} 
                            disabled={cart.length === 0}
                            className={`w-full rounded-full py-3.5 font-bold tracking-wide transition-all duration-300 backdrop-blur-md border ${
                                cart.length === 0 
                                    ? 'border-gray-600/30 bg-gray-600/10 text-gray-500 cursor-not-allowed' 
                                    : 'border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:text-green-300 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:scale-[1.02] active:scale-95'
                            }`}
                        >
                            Checkout
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}