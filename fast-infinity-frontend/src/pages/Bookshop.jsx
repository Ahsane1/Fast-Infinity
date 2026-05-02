import { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import axiosClient from '../api/axiosClient';

export default function Bookshop() {
    const [inventory, setInventory] = useState([]);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [checkoutMsg, setCheckoutMsg] = useState('');

    const deductBalance = useStore((state) => state.deductBalance);

    useEffect(() => {
        const fetchInventory = async () => {
            try {
                const response = await axiosClient.get('/bookshop/inventory');
                setInventory(response.data);
                setLoading(false);
            }
            catch (err) {
                setError('Failed to load the bookshop inventory.');
                setLoading(false);
            }
        };
        fetchInventory();
    }, []);

    const addToCart = (item) => {
        setCart((prev) => {
            const existing = prev.find((cartItem) => cartItem.item_id === item.item_id);
            if (existing) {
                return prev.map((cartItem) =>
                    cartItem.item_id === item.item_id
                    ? { ...cartItem, quantity: cartItem.quantity + 1 }
                    : cartItem
                );
            }
            return [...prev, { ...item, quantity: 1 }];
        });
    };

    const removeFromCart = (itemId) => {
        setCart((prev) => prev.filter((item) => item.item_id !== itemId));
    };

    const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setError('');
        setCheckoutMsg('');

        const uniqueReceipt = `BSP-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        try {
            const payloadItems = cart.map(item => ({
                item_id: item.item_id,
                quantity: item.quantity
            }));

            const response = await axiosClient.post('/bookshop/checkout', {
                items: payloadItems,
                receipt_number: uniqueReceipt
            });

            setCheckoutMsg(`Success! Receipt ${response.data.receipt} processed.`);
            deductBalance(response.data.total_charged);
            setCart([]);
        }
        catch (err) {
            setError(err.response?.data?.error || 'Checkout failed.');
        }
    };

    if (loading) return <div className="text-gray-400">Loading inventory...</div>;

    return (
        <div className="flex h-full gap-8">
            
            {/* LEFT SIDE: Inventory Grid */}
            <div className="flex-1 space-y-6 overflow-y-auto pr-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Campus Bookshop</h1>
                    <p className="mt-2 text-gray-400">Textbooks, stationary, and FAST merchandise.</p>
                </div>

                {error && <div className="rounded bg-red-500/20 p-4 text-red-400 border border-red-500/50">{error}</div>}
                {checkoutMsg && <div className="rounded bg-green-500/20 p-4 text-green-400 border border-green-500/50">{checkoutMsg}</div>}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {inventory.map((item) => (
                        <div key={item.item_id} className="flex flex-col justify-between rounded-xl border border-gray-700 bg-gray-800 p-5 shadow">
                            <div>
                                <div className="flex justify-between">
                                    <h3 className="font-bold text-white pr-4">{item.item_name}</h3>
                                    <span className="font-semibold text-green-400 whitespace-nowrap">Rs. {item.price}</span>
                                </div>
                                <p className="mt-1 text-xs font-bold text-blue-400 uppercase tracking-wider">{item.item_category}</p>
                                {item.author && <p className="mt-2 text-sm text-gray-400">By {item.author}</p>}
                                <p className="mt-1 text-sm text-gray-500">Stock: {item.stock_quantity}</p>
                            </div>
                            <button
                                onClick={() => addToCart(item)}
                                className="mt-4 w-full rounded bg-blue-600 py-2 text-sm font-bold text-white transition hover:bg-blue-500"
                            >
                                Add to Cart
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* RIGHT SIDE: The Cart */}
            <div className="w-80 rounded-xl border border-gray-700 bg-gray-800 p-6 flex flex-col h-[calc(100vh-10rem)] sticky top-0">
                <h2 className="text-xl font-bold text-white mb-4 border-b border-gray-700 pb-2">Your Basket</h2>

                <div className="flex-1 overflow-y-auto space-y-4">
                    {cart.length === 0 ? (
                        <p className="text-gray-500 text-sm">Your basket is empty.</p>
                    ) : (
                        cart.map((item) => (
                            <div key={item.item_id} className="flex items-center justify-between">
                                <div className="pr-2">
                                    <p className="text-sm text-white line-clamp-1" title={item.item_name}>
                                        {item.item_name} (x{item.quantity})
                                    </p>
                                    <p className="text-xs text-gray-400">Rs. {item.price * item.quantity}</p>
                                </div>
                                <button
                                    onClick={() => removeFromCart(item.item_id)}
                                    className="text-red-400 text-xs hover:text-red-300"
                                >
                                    Remove
                                </button>
                            </div>
                        ))
                    )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="flex justify-between mb-4">
                        <span className="text-gray-400">Total:</span>
                        <span className="font-bold text-green-400 text-xl">Rs. {cartTotal.toFixed(2)}</span>
                    </div>
                    <button
                        onClick={handleCheckout}
                        disabled={cart.length === 0}
                        className={`w-full rounded py-3 font-bold text-white transition ${
                            cart.length === 0 ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'
                        }`}
                    >
                        Pay with Wallet
                    </button>
                </div>
            </div>
        </div>
    
    );
}
