import { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import axiosClient from '../api/axiosClient';

const ADMIN_ROLLNUMBERS = ['24L-0561', '24L-3062', '24L-0556']; // Admin rollnums

const BOOKSHOP_CATEGORIES = ['TEXTBOOK', 'STATIONERY', 'ELECTRONICS', 'MERCHANDISE', 'OTHER'];

// ── Add Item Modal ────────────────────────────────────────────────────────────
function AddBookshopItemModal({ onClose, onAdded }) {
    const [form, setForm] = useState({
        item_name: '', item_category: '', isbn: '', author: '', price: '', stock_quantity: '',
    });
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState('');
    const [success, setSuccess] = useState('');

    const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        setLoading(true);
        try {
            const res = await axiosClient.post('/admin/bookshop/add-item', {
                item_name:      form.item_name.trim(),
                item_category:  form.item_category,
                isbn:           form.isbn.trim() || undefined,
                author:         form.author.trim() || undefined,
                price:          parseFloat(form.price),
                stock_quantity: parseInt(form.stock_quantity),
            });
            setSuccess(res.data.message);
            setForm({ item_name: '', item_category: '', isbn: '', author: '', price: '', stock_quantity: '' });
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
                        <h2 className="text-xl font-bold text-white">Add Bookshop Item</h2>
                        <p className="text-xs text-gray-500 mt-0.5">New item will be immediately visible in inventory</p>
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
                            placeholder="e.g. Data Structures & Algorithms"
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 p-3 text-white outline-none transition"
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Category <span className="text-red-400">*</span></label>
                        <select
                            required value={form.item_category}
                            onChange={e => set('item_category', e.target.value)}
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 p-3 text-white outline-none transition"
                        >
                            <option value="">Select a category…</option>
                            {BOOKSHOP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Author */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Author <span className="text-gray-600">(optional)</span></label>
                        <input
                            type="text" value={form.author}
                            onChange={e => set('author', e.target.value)}
                            placeholder="e.g. Thomas H. Cormen"
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 p-3 text-white outline-none transition"
                        />
                    </div>

                    {/* ISBN */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">ISBN <span className="text-gray-600">(optional)</span></label>
                        <input
                            type="text" value={form.isbn}
                            onChange={e => set('isbn', e.target.value)}
                            placeholder="e.g. 978-0262033848"
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 p-3 text-white outline-none transition"
                        />
                    </div>

                    {/* Price + Stock */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Price (Rs.) <span className="text-red-400">*</span></label>
                            <input
                                type="number" required min="0.01" step="0.01" value={form.price}
                                onChange={e => set('price', e.target.value)}
                                placeholder="e.g. 1200"
                                className="w-full rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 p-3 text-white outline-none transition"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Stock Qty <span className="text-red-400">*</span></label>
                            <input
                                type="number" required min="0" step="1" value={form.stock_quantity}
                                onChange={e => set('stock_quantity', e.target.value)}
                                placeholder="e.g. 30"
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
export default function Bookshop() {
    const [inventory,   setInventory]   = useState([]);
    const [cart,        setCart]        = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState('');
    const [checkoutMsg, setCheckoutMsg] = useState('');
    const [showModal,   setShowModal]   = useState(false);
    
    // NEW: Search State
    const [searchQuery, setSearchQuery] = useState('');

    const { deductBalance, dashboard } = useStore();
    const isAdmin = ADMIN_ROLLNUMBERS.includes(dashboard?.roll_number);

    useEffect(() => {
        axiosClient.get('/bookshop/inventory')
            .then(r => { setInventory(r.data); setLoading(false); })
            .catch(() => { setError('Failed to load the bookshop inventory.'); setLoading(false); });
    }, []);

    const addToCart = (item) => setCart(prev => {
        const ex = prev.find(c => c.item_id === item.item_id);
        return ex
            ? prev.map(c => c.item_id === item.item_id ? { ...c, quantity: c.quantity + 1 } : c)
            : [...prev, { ...item, quantity: 1 }];
    });

    const removeFromCart = (id) => setCart(prev => prev.filter(c => c.item_id !== id));
    const cartTotal = cart.reduce((t, i) => t + i.price * i.quantity, 0);

    const handleCheckout = async () => {
        if (!cart.length) return;
        setError(''); setCheckoutMsg('');
        const receipt = `BSP-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        try {
            const res = await axiosClient.post('/bookshop/checkout', {
                items: cart.map(i => ({ item_id: i.item_id, quantity: i.quantity })),
                receipt_number: receipt,
            });
            setCheckoutMsg(`Success! Receipt ${res.data.receipt} processed.`);
            deductBalance(res.data.total_charged);
            setCart([]);
        } catch (err) {
            setError(err.response?.data?.error || 'Checkout failed.');
        }
    };

    const handleItemAdded = (newItem) => {
        setInventory(prev => [...prev, newItem]);
    };

    // NEW: Filter logic (checks name, category, author, and ISBN)
    const filteredInventory = inventory.filter(item => 
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.item_category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.author && item.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.isbn && item.isbn.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (loading) return <div className="text-gray-400">Loading inventory...</div>;

    return (
        <>
            {showModal && (
                <AddBookshopItemModal
                    onClose={() => setShowModal(false)}
                    onAdded={handleItemAdded}
                />
            )}

            <div className="flex h-full gap-8">
                {/* LEFT: Inventory */}
                <div className="flex-1 space-y-6 overflow-y-auto pr-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white">Campus Bookshop</h1>
                            <p className="mt-2 text-gray-400">Textbooks, stationery, and FAST merchandise.</p>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={() => setShowModal(true)}
                                className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-bold text-white transition shadow-lg"
                                title="Add new bookshop item"
                            >
                                <span className="text-lg leading-none">+</span>
                                Add Item
                            </button>
                        )}
                    </div>

                    {/* NEW: Search Bar UI */}
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Search textbooks, merchandise, authors..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-xl border border-gray-700 bg-gray-800 p-4 pl-12 text-white outline-none focus:border-blue-500 transition"
                        />
                        <span className="absolute left-4 top-4 text-xl select-none">🔍</span>
                    </div>

                    {error       && <div className="rounded bg-red-500/20 p-4 text-red-400 border border-red-500/50">{error}</div>}
                    {checkoutMsg && <div className="rounded bg-green-500/20 p-4 text-green-400 border border-green-500/50">{checkoutMsg}</div>}

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {/* NEW: Empty state for search */}
                        {filteredInventory.length === 0 && !loading && (
                            <p className="text-gray-500 col-span-2 text-center py-8">No items found matching "{searchQuery}"</p>
                        )}
                        {/* NEW: Replaced inventory.map with filteredInventory.map */}
                        {filteredInventory.map(item => (
                            <div key={item.item_id} className="flex flex-col justify-between rounded-xl border border-gray-700 bg-gray-800 p-5 shadow">
                                <div>
                                    <div className="flex justify-between">
                                        <h3 className="font-bold text-white pr-4">{item.item_name}</h3>
                                        <span className="font-semibold text-green-400 whitespace-nowrap">Rs. {item.price}</span>
                                    </div>
                                    <p className="mt-1 text-xs font-bold text-blue-400 uppercase tracking-wider">{item.item_category}</p>
                                    {item.author && <p className="mt-2 text-sm text-gray-400">By {item.author}</p>}
                                    {item.isbn   && <p className="mt-0.5 text-xs text-gray-600 font-mono">ISBN: {item.isbn}</p>}
                                    <p className="mt-1 text-sm text-gray-500">Stock: {item.stock_quantity}</p>
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
                    <div className="flex-1 overflow-y-auto space-y-4">
                        {cart.length === 0 ? (
                            <p className="text-gray-500 text-sm">Your basket is empty.</p>
                        ) : cart.map(item => (
                            <div key={item.item_id} className="flex items-center justify-between">
                                <div className="pr-2">
                                    <p className="text-sm text-white line-clamp-1" title={item.item_name}>{item.item_name} (x{item.quantity})</p>
                                    <p className="text-xs text-gray-400">Rs. {item.price * item.quantity}</p>
                                </div>
                                <button onClick={() => removeFromCart(item.item_id)} className="text-red-400 text-xs hover:text-red-300">Remove</button>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="flex justify-between mb-4">
                            <span className="text-gray-400">Total:</span>
                            <span className="font-bold text-green-400 text-xl">Rs. {cartTotal.toFixed(2)}</span>
                        </div>
                        <button onClick={handleCheckout} disabled={cart.length === 0}
                            className={`w-full rounded py-3 font-bold text-white transition ${cart.length === 0 ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}>
                            Pay with Wallet
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}