import React, { useState, useEffect, useMemo } from 'react';
import { X, Package, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { inventoryTransactionService } from '../../../services/inventoryTransactionService';
import { formatNumber } from '../../../utils/helpers';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '../../../components/Dialog';

interface BatchSelection {
  batchId: string;
  batchNumber: string;
  quantity: number;
}

interface BatchPickerModalProps {
  itemId: string;
  itemName: string;
  targetQuantity: number;
  isOpen: boolean;
  onConfirm: (selections: BatchSelection[]) => void;
  onClose: () => void;
}

const BatchPickerModal: React.FC<BatchPickerModalProps> = ({
  itemId, itemName, targetQuantity, isOpen, onConfirm, onClose
}) => {
  const { companyConfig, notify } = useAuth();
  const currency = companyConfig.currencySymbol;
  const [batches, setBatches] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    inventoryTransactionService.getActiveBatches(itemId).then((data) => {
      setBatches(data);
      const initial: Record<string, number> = {};
      data.forEach((b) => { initial[b.id] = 0; });
      setSelections(initial);
      setLoading(false);
    });
  }, [itemId, isOpen]);

  const totalSelected = useMemo(
    () => Object.values(selections).reduce((sum, q) => sum + q, 0),
    [selections]
  );
  const remaining = targetQuantity - totalSelected;
  const isComplete = totalSelected >= targetQuantity;

  const updateSelection = (batchId: string, value: number) => {
    const batch = batches.find((b) => b.id === batchId);
    const max = batch ? batch.remainingQuantity : 0;
    const clamped = Math.max(0, Math.min(value, max));
    setSelections((prev) => ({ ...prev, [batchId]: clamped }));
  };

  const quickFill = (batchId: string) => {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return;
    const canTake = Math.min(remaining, batch.remainingQuantity);
    updateSelection(batchId, (selections[batchId] || 0) + canTake);
  };

  const handleConfirm = () => {
    const result = Object.entries(selections)
      .filter(([, qty]) => qty > 0)
      .map(([batchId, qty]) => ({
        batchId,
        batchNumber: batches.find((b) => b.id === batchId)?.batchNumber || batchId,
        quantity: qty,
      }));
    if (result.length === 0) {
      notify('Select at least one batch', 'warning');
      return;
    }
    if (totalSelected > targetQuantity) {
      notify('Total selected exceeds target quantity', 'error');
      return;
    }
    if (totalSelected < targetQuantity) {
      notify(`Partial selection: ${totalSelected} of ${targetQuantity}. Remaining will use general stock.`, 'info');
    }
    onConfirm(result);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogHeader className="flex items-center justify-between">
        <div>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Package size={16} className="text-[#0077c5]" /> Select Batch / Lot
          </DialogTitle>
          <p className="text-[10px] text-[#6b6c7f] font-medium">{itemName} &mdash; Need {targetQuantity} units</p>
        </div>
        <button onClick={onClose} className="text-[#8d9096] hover:text-[#d52b1e]" title="Close" aria-label="Close"><X size={20} /></button>
      </DialogHeader>

      {loading ? (
        <div className="flex items-center justify-center text-[#6b6c7f] text-sm p-8">Loading batches...</div>
      ) : batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-[#6b6c7f] p-8 gap-3">
          <AlertTriangle size={32} className="text-amber-400" />
          <p className="text-sm font-bold">No active batches found for this item.</p>
          <p className="text-xs">The item will be added to cart without batch tracking.</p>
          <button onClick={() => onConfirm([])} className="mt-2 px-4 py-2 bg-[#0077c5] text-white text-xs font-bold rounded hover:bg-[#0066a8]">
            Continue Without Batch
          </button>
        </div>
      ) : (
        <>
          <div className="px-4 py-2 bg-[#fafbfc] border-b border-[#d4d7dc] flex items-center justify-between text-[10px] font-bold text-[#6b6c7f] uppercase tracking-wider">
            <span>Selected: {totalSelected} / {targetQuantity}</span>
            <span className={remaining > 0 ? 'text-amber-600' : 'text-green-600'}>
              {remaining > 0 ? `${remaining} remaining` : 'Complete'}
            </span>
          </div>

          <div className="overflow-y-auto flex-1 custom-scrollbar max-h-[50vh]">
            <table className="w-full text-[12px]">
              <thead className="bg-[#f4f5f8] text-[10px] font-bold text-[#6b6c7f] uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2">Batch #</th>
                  <th className="text-right px-2 py-2">Available</th>
                  <th className="text-center px-2 py-2">Expiry</th>
                  <th className="text-right px-2 py-2">Unit Cost</th>
                  <th className="text-center px-2 py-2">Use</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f5f8]">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-[#fafbfc]">
                    <td className="px-4 py-3 font-mono font-bold text-[#393a3d]">{batch.batchNumber}</td>
                    <td className="px-2 py-3 text-right font-bold text-[#393a3d]">{batch.remainingQuantity}</td>
                    <td className="px-2 py-3 text-center">
                      {batch.expiryDate ? (
                        <span className="flex items-center justify-center gap-1 text-[10px] text-[#6b6c7f]">
                          <Calendar size={10} />{new Date(batch.expiryDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-[#babec5]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-[#6b6c7f]">{currency}{formatNumber(batch.costPerUnit)}</td>
                    <td className="px-2 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max={batch.remainingQuantity}
                          className="w-16 p-1 border border-[#babec5] rounded text-[12px] font-bold text-center focus:border-[#0077c5] outline-none"
                          value={selections[batch.id] || 0}
                          onChange={(e) => updateSelection(batch.id, parseInt(e.target.value) || 0)}
                        />
                        {remaining > 0 && batch.remainingQuantity > 0 && (
                          <button
                            onClick={() => quickFill(batch.id)}
                            className="text-[9px] px-1.5 py-0.5 bg-[#eceef1] text-[#6b6c7f] font-bold rounded hover:bg-[#d4d7dc]"
                            title="Fill remaining"
                          >
                            Fill
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter className="flex justify-between items-center">
            <div className="text-[10px] text-[#6b6c7f]">
              <Clock size={10} className="inline mr-1" />
              FIFO order — oldest batches shown first
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-[11px] font-bold text-[#6b6c7f] hover:text-[#393a3d] rounded border border-[#d4d7dc] hover:bg-[#eceef1]">
                Cancel
              </button>
              <button onClick={handleConfirm} className={`px-4 py-2 text-[11px] font-bold text-white rounded ${isComplete ? 'bg-green-600 hover:bg-green-700' : 'bg-[#0077c5] hover:bg-[#0066a8]'}`}>
                {isComplete ? 'Confirm Full Selection' : `Confirm (${totalSelected}/${targetQuantity})`}
              </button>
            </div>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
};

export default BatchPickerModal;
