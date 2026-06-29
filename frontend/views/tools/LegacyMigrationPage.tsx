import React, { useState } from 'react';
import {
    Database, Play, AlertTriangle, CheckCircle, XCircle,
    SkipForward, RefreshCw, Download
} from 'lucide-react';
import { legacyMigrationService, type MigrationSummary } from '../../services/legacyMigrationService';

const LegacyMigrationPage: React.FC = () => {
    const [running, setRunning] = useState(false);
    const [summary, setSummary] = useState<MigrationSummary | null>(null);
    const [progress, setProgress] = useState<{ current: number; total: number; percent: number; currentItem: string } | null>(null);

    const handleRun = async () => {
        if (!window.confirm(
            'This will scan all inventory items and populate productType, inventoryRole, and Variant fields from legacy type data.\n\n' +
            'Items already migrated will be skipped.\n\nContinue?'
        )) return;

        setRunning(true);
        setSummary(null);
        setProgress({ current: 0, total: 0, percent: 0, currentItem: 'Starting...' });

        try {
            const result = await legacyMigrationService.migrateLegacyTypes((p) => {
                setProgress(p);
            });
            setSummary(result);
        } catch (err) {
            setSummary({
                totalItems: 0,
                processed: 0,
                errors: 1,
                skipped: 0,
                details: [{
                    itemId: '',
                    itemName: '',
                    action: 'error',
                    error: err instanceof Error ? err.message : 'Migration failed',
                }],
            });
        } finally {
            setRunning(false);
            setProgress(null);
        }
    };

    const handleExport = () => {
        if (!summary) return;
        const csv = [
            ['Item ID', 'Item Name', 'Action', 'Product Type', 'Inventory Role', 'Resource Subtype', 'Variant Created', 'Error'].join(','),
            ...summary.details.map(d =>
                [d.itemId, `"${d.itemName}"`, d.action, d.productType || '', d.inventoryRole || '', d.resourceSubtype || '', d.variantCreated ? 'Yes' : '', d.error || ''].join(',')
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `legacy-migration-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                        <Database size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Legacy Type Migration</h2>
                        <p className="text-sm text-slate-500">Populate productType, inventoryRole, and Variant data from legacy Item records</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                        <h3 className="font-bold text-slate-900 mb-4">Migration Rules</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-xs font-bold">RM</div>
                                <div><span className="font-bold">Raw Material</span> → productType: INVENTORY, inventoryRole: internal, resourceSubtype: raw_material</div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 text-xs font-bold">M</div>
                                <div><span className="font-bold">Material</span> → productType: INVENTORY, inventoryRole: internal, resourceSubtype: consumable</div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 text-xs font-bold">S</div>
                                <div><span className="font-bold">Stationery</span> → productType: INVENTORY, inventoryRole: both</div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 text-xs font-bold">P</div>
                                <div><span className="font-bold">Product</span> → productType: MANUFACTURED, inventoryRole: sellable</div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0 text-xs font-bold">SV</div>
                                <div><span className="font-bold">Service</span> → productType: SERVICE, inventoryRole: sellable</div>
                            </div>
                        </div>
                    </div>

                    {!running && !summary && (
                        <button
                            onClick={handleRun}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 shadow-lg shadow-amber-200 transition-all active:scale-[0.98]"
                        >
                            <Play size={20} /> Run Migration
                        </button>
                    )}

                    {running && progress && (
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 text-center space-y-4">
                            <RefreshCw size={32} className="mx-auto text-amber-500 animate-spin" />
                            <div>
                                <p className="font-bold text-slate-900">Migrating...</p>
                                <p className="text-sm text-slate-500 mt-1">{progress.currentItem}</p>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                                    style={{ width: `${progress.percent}%` }}
                                />
                            </div>
                            <p className="text-xs text-slate-400">{progress.current} / {progress.total} items ({progress.percent}%)</p>
                        </div>
                    )}

                    {summary && !running && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-3">
                                <div className="bg-emerald-50 rounded-2xl p-4 text-center border border-emerald-100">
                                    <CheckCircle size={20} className="mx-auto text-emerald-500 mb-1" />
                                    <p className="text-2xl font-bold text-emerald-700">{summary.processed}</p>
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-tight">Migrated</p>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-200">
                                    <SkipForward size={20} className="mx-auto text-slate-400 mb-1" />
                                    <p className="text-2xl font-bold text-slate-600">{summary.skipped}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Skipped</p>
                                </div>
                                <div className="bg-red-50 rounded-2xl p-4 text-center border border-red-100">
                                    <XCircle size={20} className="mx-auto text-red-500 mb-1" />
                                    <p className="text-2xl font-bold text-red-700">{summary.errors}</p>
                                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-tight">Errors</p>
                                </div>
                                <div className="bg-blue-50 rounded-2xl p-4 text-center border border-blue-100">
                                    <Database size={20} className="mx-auto text-blue-500 mb-1" />
                                    <p className="text-2xl font-bold text-blue-700">{summary.totalItems}</p>
                                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-tight">Total Items</p>
                                </div>
                            </div>

                            {summary.errors > 0 && (
                                <div className="bg-red-50 rounded-2xl p-4 border border-red-200">
                                    <h4 className="font-bold text-red-700 text-sm mb-2 flex items-center gap-2">
                                        <AlertTriangle size={16} /> Errors
                                    </h4>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {summary.details.filter(d => d.action === 'error').map((d, i) => (
                                            <p key={i} className="text-xs text-red-600">{d.itemName}: {d.error}</p>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={handleRun}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 shadow-lg shadow-amber-200 transition-all"
                                >
                                    <RefreshCw size={16} /> Run Again
                                </button>
                                <button
                                    onClick={handleExport}
                                    className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                                >
                                    <Download size={16} /> Export CSV
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LegacyMigrationPage;
