import { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import axiosClient from '../api/axiosClient';
import { ArrowUp01 } from 'lucide-react';

export default function Cafeteria() {
    const [menu, setMenu] = useState([]);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [checkoutMsg, setCheckoutMsg] = useState('');

    const deductBalance = useStore((state) => state.deductBalance);

    useEffect(() => {
        const fetchMenu = async () => {
            try {
                const response = await axiosClient.get('/cafeteria/menu');
                setMenu(response.data);
                setLoading(false);
            }
            catch (err) {
                setError('Failed to load the menu.');
                setLoading(false);
            }
        };
        fetchMenu();
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
    }

    const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setError('');
        setCheckoutMsg('');

        try {
            const payloadItems = cart.map(item => ({
                item_id: item.item_id,
                quantity: item.quantity
            }));

            const response = await axiosClient.post('/cafeteria/checkout', {
                student_id: useStore.getState().user.id,
                items: payloadItems
            });

            // 1. Show success message
            setCheckoutMsg(`Success! Order #${response.data.order_id} placed.`);

            // 2. Instantly deduct the wallet in the Topbar without refreshing the page!
            deductBalance(response.data.total_charged);

            // 3. Clear the cart
            setCart([]);
        }
        catch (err) {
            setError(err.response?.data?.error || 'Checkout failed.');
        }
    };

    if (loading) return <div className="text-gray-400">Loading menu...</div>;

    return (
        <div className="flex h-full gap-8">
            
            {/* LEFT SIDE: Menu Grid */}
            <div className="flex-1 space-y-6 overflow-y-auto pr-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Campus Cafeteria</h1>
                    <p className="mt-2 text-gray-400">Grab a bite using your campus wallet.</p>
                </div>

                {error && <div className="rounded bg-red-500/20 p-4 text-red-400 border border-red-500/50">{error}</div>}
                {checkoutMsg && <div className="rounded bg-green-500/20 p-4 text-green-400 border border-green-500/50">{checkoutMsg}</div>}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {menu.map((item) => (
                        <div key={item.item_id} className="flex flex-col justify-between rounded-xl border border-gray-700 bg-gray-800 p-5 shadow">
                            <div>
                                <div className="flex justify-between">
                                    <h3 className="font-bold text-white">{item.item_name}</h3>
                                    <span className="font-semibold text-green-400">Rs. {item.price}</span>
                                </div>
                                <p className="mt-1 text-xs text-gray-500 uppercase tracking-wider">{item.category}</p>
                                <p className="mt-2 text-sm text-gray-400">Stock: {item.stock_quantity}</p>
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
                <h2 className="text-xl font-bold text-white mb-4 border-b border-gray-700 pb-2">Your Tray</h2>

                <div className="flex-1 overflow-y-auto space-y-4">
                    {cart.length === 0 ? (
                        <p className="text-gray-500 text-sm">Your tray is empty.</p>
                    ) : (
                        cart.map((item) => (
                            <div key={item.item_id} className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-white">{item.item_name} (x{item.quantity})</p>
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
                            cart.length === 0 ? 'bg-gray-600 curson-not-allowed' : 'bg-green-600 hover:bg-green-500'
                        }`}
                    >
                        Checkout
                    </button>
                </div>
            </div>
        </div>
    );
}
