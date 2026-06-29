import React, { useState, useMemo } from 'react';
import { X, Package, ChevronRight, Scale } from 'lucide-react';
import { inventoryResourceService } from '../../../services/inventoryResourceService';
import { useInventory } from '../../../context/InventoryContext';

interface PurchaseReceiveModalProps {
    purchase: any;
    onClose: () => void;
    onComplete: () => void;
}

export const PurchaseReceiveModal: React.FC<PurchaseReceiveModalProps> = ({ purchase, onClose, onComplete }) => {
    const { inventory, updatePurchase } = useInventory();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const items = purchase.items || [];

    const findItem = (itemId: string) => inventory.find((i: any) => i.id === itemId);

    const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>(() => {
        const initial: Record<string, number> = {};
        for (const item of items) {
            const remaining = (item.quantity || 0) - (item.receivedQty || 0);
            if (remaining > 0) initial[item.itemId || item.itemId] = remaining;
        }
        return initial;
    });

    const handleQtyChange = (itemId: string, value: string) => {
        const parsed = parseFloat(value);
        setReceivedQuantities(prev => ({
            ...prev,
            [itemId]: isNaN(parsed) ? 0 : Math.max(0, parsed)
        }));
    };

    const handleReceiveAll = () => {
        const all: Record<string, number> = {};
        for (const item of items) {
            const remaining = (item.quantity || 0) - (item.receivedQty || 0);
            if (remaining > 0) all[item.itemId || item.itemId] = remaining;
        }
        setReceivedQuantities(all);
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        try {
            const updatedItems = [...items];
            let allFullyReceived = true;

            for (let i = 0; i < updatedItems.length; i++) {
                const poItem = updatedItems[i];
                const itemId = poItem.itemId || poItem.itemId;
                const qtyToReceive = receivedQuantities[itemId] || 0;
                if (qtyToReceive <= 0) continue;

                const invItem = findItem(itemId);

                try {
                    await inventoryResourceService.recordPurchase({
                        itemId,
                        purchaseQuantity: qtyToReceive,
                        purchaseUnit: poItem.unit || invItem?.purchaseUnit || invItem?.unit || 'pcs',
                        totalCost: qtyToReceive * (poItem.cost || 0),
                        supplierId: purchase.supplierId,
                        supplierName: purchase.supplierName || purchase.supplierName,
                        invoiceRef: purchase.id,
                    });
                } catch (err) {
                    console.warn(`[PurchaseReceive] Could not record purchase lot for ${poItem.name}:`, err);
                }

                const oldReceived = poItem.receivedQty || 0;
                updatedItems[i] = { ...poItem, receivedQty: oldReceived + qtyToReceive };
                if ((oldReceived + qtyToReceive) < (poItem.quantity || 0)) {
                    allFullyReceived = false;
                }
            }

            const updatedPurchase = {
                ...purchase,
                items: updatedItems,
                status: allFullyReceived ? 'Received' : 'Partially Received',
            };
            await updatePurchase(updatedPurchase);
            onComplete();
        } catch (err: any) {
            setError(err?.message || 'Failed to process receipt');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Receive Goods</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Bill #{purchase.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                            {items.filter((i: any) => (i.quantity || 0) - (i.receivedQty || 0) > 0).length} items pending
                        </span>
                        <button
                            onClick={handleReceiveAll}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-tight"
                        >
                            Receive All
                        </button>
                    </div>

                    {items.map((poItem: any, idx: number) => {
                        const itemId = poItem.itemId || poItem.itemId;
                        const ordered = poItem.quantity || 0;
                        const received = poItem.receivedQty || 0;
                        const remaining = ordered - received;
                        if (remaining <= 0) return null;

                        const invItem = findItem(itemId);
                        const isInventoryResource = invItem?.inventoryRole === 'internal' || invItem?.inventoryRole === 'both' || invItem?.type === 'Raw Material' || invItem?.type === 'Material';
                        const currentQty = receivedQuantities[itemId] ?? remaining;
                        const lineTotal = currentQty * (poItem.cost || 0);

                        return (
                            <div key={itemId || idx} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="font-bold text-sm text-slate-900">{poItem.name}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                            Ordered: {ordered} × {poItem.unit || 'pcs'} @ ${(poItem.cost || 0).toFixed(2)}
                                            {received > 0 && <span className="text-emerald-600 ml-2">(Previously received: {received})</span>}
                                        </div>
                                    </div>
                                    {isInventoryResource && (
                                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-100 rounded-lg">
                                            <Scale size={10} className="text-blue-500" />
                                            <span className="text-[9px] font-bold text-blue-600 uppercase tracking-tight">
                                                {invItem?.consumptionUnit || invItem?.unit || 'pcs'} {invItem?.conversionFactor && invItem.conversionFactor !== 1 ? `(×${invItem.conversionFactor})` : ''}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-1 block">
                                            Receive Qty
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={remaining}
                                            step="any"
                                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl bg-white text-sm font-bold text-slate-900 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                            value={currentQty}
                                            onChange={(e) => handleQtyChange(itemId, e.target.value)}
                                        />
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-1">Line Total</div>
                                        <div className="text-sm font-bold text-slate-900">${lineTotal.toFixed(2)}</div>
                                    </div>
                                </div>

                                {isInventoryResource && invItem && (
                                    <div className="mt-2 pt-2 border-t border-slate-200/50">
                                        <div className="text-[9px] text-slate-400">
                                            Purchase unit: <span className="font-semibold text-slate-600">{poItem.unit || invItem.purchaseUnit || 'pcs'}</span>
                                            {invItem.conversionFactor && invItem.conversionFactor !== 1 && (
                                                <>
                                                    <ChevronRight size={10} className="inline mx-1" />
                                                    Consumption unit: <span className="font-semibold text-slate-600">{invItem.consumptionUnit || invItem.unit}</span>
                                                    <span className="ml-1">(×{invItem.conversionFactor})</span>
                                                    <span className="ml-2 text-emerald-600">
                                                        = {(currentQty * (invItem.conversionFactor || 1)).toFixed(2)} {invItem.consumptionUnit || invItem.unit}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {items.every((i: any) => (i.quantity || 0) <= (i.receivedQty || 0)) && (
                        <div className="p-6 text-center">
                            <Package size={32} className="mx-auto text-emerald-400 mb-2" />
                            <p className="text-sm font-bold text-slate-700">All items already received</p>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !Object.values(receivedQuantities).some((q: number) => q > 0)}
                        className="flex-[2] px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-2xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
                    >
                        {loading ? 'Processing...' : 'Confirm Receive'}
                    </button>
                </div>
            </div>
        </div>
    );
};
