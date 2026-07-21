import React, { useEffect, useMemo, useState } from 'react';
import { logger } from '@/services/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/Dialog';
import {
    Sparkles,
    Loader2,
    CheckCircle,
    AlertCircle,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    Package,
    MapPin
} from 'lucide-react';
import { Item } from '../../../types';
import { useInventory } from '../../../context/InventoryContext';

interface SmartAdjustModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    items: Item[];
}

const SmartAdjustModal: React.FC<SmartAdjustModalProps> = ({ isOpen, onClose, onSuccess, items }) => {
    const { updateStock, warehouses } = useInventory();

    const [applying, setApplying] = useState(false);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [adjustmentType, setAdjustmentType] = useState<'ADD' | 'REMOVE' | 'SET'>('ADD');
    const [quantity, setQuantity] = useState<number>(0);
    const [reason, setReason] = useState<string>('');
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('WH-MAIN');
    const [step, setStep] = useState<'preview' | 'applying' | 'success'>('preview');

    useEffect(() => {
        if (!isOpen) return;

        const lowStockIds = items
            .filter(item => (item.stock || 0) <= (item.minStockLevel || 0))
            .map(item => item.id);

        setSelectedItems(lowStockIds.length > 0 ? lowStockIds : items.map(item => item.id));
        setAdjustmentType('ADD');
        setQuantity(0);
        setReason('');
        setSelectedWarehouse(warehouses[0]?.id || 'WH-MAIN');
        setStep('preview');
        setApplying(false);
    }, [isOpen, items, warehouses]);

    const itemById = useMemo(() => {
        const map = new Map<string, Item>();
        items.forEach(item => map.set(item.id, item));
        return map;
    }, [items]);

    const selectedItemRows = useMemo(
        () => selectedItems.map(id => itemById.get(id)).filter(Boolean) as Item[],
        [selectedItems, itemById]
    );

    const getStockChange = (item: Item): number => {
        if (adjustmentType === 'SET') {
            return quantity - (item.stock || 0);
        }
        if (adjustmentType === 'REMOVE') {
            return -Math.abs(quantity);
        }
        return Math.abs(quantity);
    };

    const projectedNetChange = selectedItemRows.reduce((sum, item) => sum + getStockChange(item), 0);
    const projectedNegativeStock = selectedItemRows.some(item => (item.stock || 0) + getStockChange(item) < 0);
    const hasValidQuantity = adjustmentType === 'SET' ? quantity >= 0 : quantity > 0;

    const handleApplyAdjustments = async () => {
        if (selectedItems.length === 0 || !hasValidQuantity) return;

        setApplying(true);
        setStep('applying');

        try {
            const summaryReason = reason.trim() || `Smart stock adjustment (${adjustmentType})`;

            for (const itemId of selectedItems) {
                const item = itemById.get(itemId);
                if (!item) continue;

                const stockChange = getStockChange(item);
                if (stockChange === 0) continue;

                await updateStock(item.id, stockChange, selectedWarehouse, summaryReason, true);
            }

            setStep('success');

            setTimeout(() => {
                onSuccess();
                onClose();
                setStep('preview');
            }, 1500);
        } catch (error) {
            logger.error('Error applying adjustments:', error);
            setStep('preview');
            alert('Failed to apply stock adjustments. Please try again.');
        } finally {
            setApplying(false);
        }
    };

    const toggleItem = (id: string) => {
        setSelectedItems(prev =>
            prev.includes(id)
                ? prev.filter(itemId => itemId !== id)
                : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedItems.length === items.length) {
            setSelectedItems([]);
            return;
        }
        setSelectedItems(items.map(item => item.id));
    };

    const formatTypeLabel = (type: 'ADD' | 'REMOVE' | 'SET') => {
        if (type === 'SET') return 'Set Quantity';
        return type === 'ADD' ? 'Increase Stock' : 'Reduce Stock';
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onClose={onClose} title="Smart Stock Adjust">
            {step === 'applying' ? (
                <div className="flex flex-col items-center justify-center py-8 font-sans">
                    <Loader2 className="w-14 h-14 text-indigo-600 animate-spin mb-3" />
                    <p className="text-base font-semibold text-slate-800 mb-1">Applying Stock Adjustments</p>
                    <p className="text-[13px] text-slate-500">Updating stock levels in inventory records...</p>
                </div>
            ) : step === 'success' ? (
                <div className="flex flex-col items-center justify-center py-8 font-sans">
                    <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-3">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="text-base font-semibold text-slate-800 mb-1">Stock Adjustments Applied</p>
                    <p className="text-[13px] text-slate-500">Inventory stock levels have been updated</p>
                </div>
            ) : (
                <div className="overflow-y-auto max-h-[65vh] pr-1 space-y-4 font-sans leading-[1.45] text-[13.5px]">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-3 rounded-xl border border-blue-200/50">
                            <div className="text-xs font-semibold text-blue-600 uppercase mb-0.5">
                                Selected Items
                            </div>
                            <div className="text-xl font-semibold text-blue-800 tabular-nums">{selectedItems.length}</div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-3 rounded-xl border border-purple-200/50">
                            <div className="text-xs font-semibold text-purple-600 uppercase mb-0.5">
                                Operation
                            </div>
                            <div className="text-sm font-semibold text-purple-800">{formatTypeLabel(adjustmentType)}</div>
                        </div>
                        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-3 rounded-xl border border-indigo-200/50">
                            <div className="text-xs font-semibold text-indigo-600 uppercase mb-0.5">
                                Net Change
                            </div>
                            <div className="text-xl font-semibold text-indigo-800 tabular-nums">{projectedNetChange.toFixed(2)}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Warehouse</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <select
                                    value={selectedWarehouse}
                                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-[13px] appearance-none bg-white"
                                >
                                    {warehouses.length > 0 ? (
                                        warehouses.map(wh => (
                                            <option key={wh.id} value={wh.id}>{wh.name}</option>
                                        ))
                                    ) : (
                                        <option value="WH-MAIN">Main Warehouse</option>
                                    )}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Quantity</label>
                            <input
                                type="number"
                                min="0"
                                value={Number.isNaN(quantity) ? 0 : quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-[13px] font-semibold tabular-nums"
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Adjustment Type</label>
                        <div className="flex p-0.5 bg-slate-100 rounded-lg gap-0.5">
                            {(['ADD', 'REMOVE', 'SET'] as const).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setAdjustmentType(type)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all text-[13px] font-medium ${adjustmentType === type
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                        }`}
                                >
                                    {type === 'ADD' && <TrendingUp size={14} />}
                                    {type === 'REMOVE' && <TrendingDown size={14} />}
                                    {type === 'SET' && <RefreshCw size={14} />}
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Reason (Optional)</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-[13px]"
                            rows={2}
                            placeholder="e.g., Cycle count correction, damaged stock write-off..."
                        />
                    </div>

                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
                            <p className="text-base font-semibold text-slate-800 mb-1">No Inventory Items</p>
                            <p className="text-[13px] text-slate-500 max-w-md">Create inventory items before using Smart Adjust.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-slate-700">Select Items</h3>
                                <button
                                    type="button"
                                    onClick={toggleSelectAll}
                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                                >
                                    {selectedItems.length === items.length ? 'Clear All' : 'Select All'}
                                </button>
                            </div>
                            {items.map((item, idx) => {
                                const change = getStockChange(item);
                                const resultingStock = (item.stock || 0) + change;
                                const isSelected = selectedItems.includes(item.id);
                                return (
                                    <div
                                        key={`${item.id}-${idx}`}
                                        onClick={() => toggleItem(item.id)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all ${isSelected
                                            ? 'border-indigo-500 bg-indigo-50'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <h4 className="font-semibold text-slate-800 truncate">{item.name}</h4>
                                                    <span className="shrink-0 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-medium uppercase">{item.sku}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[13px]">
                                                    <div className="flex items-center gap-1">
                                                        <Package size={13} className="text-indigo-600 shrink-0" />
                                                        <span className="font-medium text-slate-700 tabular-nums">Current: {item.stock} {item.unit}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {change >= 0 ? (
                                                            <TrendingUp size={13} className="text-green-600 shrink-0" />
                                                        ) : (
                                                            <TrendingDown size={13} className="text-red-600 shrink-0" />
                                                        )}
                                                        <span className={`tabular-nums ${resultingStock < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                                                            New: {resultingStock.toFixed(2)} {item.unit}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all mt-0.5 ${isSelected
                                                ? 'bg-indigo-600 border-indigo-600'
                                                : 'border-slate-300'
                                                }`}>
                                                {isSelected && (
                                                    <CheckCircle size={12} className="text-white" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {projectedNegativeStock && (
                        <p className="text-xs text-amber-600 flex items-center gap-1 font-medium">
                            <AlertCircle size={12} />
                            One or more selected items will result in negative stock.
                        </p>
                    )}
                </div>
            )}

            {step === 'preview' && items.length > 0 && (
                <DialogFooter>
                    <div className="text-[13px] mr-auto">
                        <p className="font-semibold text-slate-800 tabular-nums">
                            {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
                        </p>
                        <p className="text-[13px] text-slate-500 tabular-nums">
                            Net stock change: {projectedNetChange.toFixed(2)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={applying}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50 text-[13px]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApplyAdjustments}
                        disabled={applying || selectedItems.length === 0 || !hasValidQuantity}
                        className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow disabled:opacity-50 disabled:cursor-not-allowed text-[13px]"
                    >
                        <Sparkles size={14} />
                        Apply Stock Adjustments
                    </button>
                </DialogFooter>
            )}
        </Dialog>
    );
};

export default SmartAdjustModal;
