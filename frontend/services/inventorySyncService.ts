import { dbService } from './db';
// WarehouseInventory is typed loosely in types.ts

export async function syncItemStockWithWarehouses(itemId: string): Promise<void> {
  const inventory = await dbService.getAll<any>('inventory');
  const item = inventory.find(i => i.id === itemId);
  if (!item) return;

  const warehouseInventory = await dbService.getAll<any>('warehouseInventory');
  const itemWhInventories = warehouseInventory.filter((w: any) => w.itemId === itemId);

  if (itemWhInventories.length === 0) return;

  const totalStock = itemWhInventories.reduce((sum: number, w: any) => sum + (w.quantity || 0), 0);
  const totalReserved = itemWhInventories.reduce((sum: number, w: any) => sum + (w.reserved || 0), 0);

  if (item.stock !== totalStock || (item.reservedStock || 0) !== totalReserved) {
    item.stock = totalStock;
    item.reservedStock = totalReserved;
    await dbService.put('inventory', item);
  }
}

export async function syncAllItemStockWithWarehouses(): Promise<number> {
  const inventory = await dbService.getAll<any>('inventory');
  const warehouseInventory = await dbService.getAll<any>('warehouseInventory');
  let syncedCount = 0;

  for (const item of inventory) {
    const itemWhInventories = warehouseInventory.filter((w: any) => w.itemId === item.id);
    if (itemWhInventories.length === 0) continue;

    const totalStock = itemWhInventories.reduce((sum: number, w: any) => sum + (w.quantity || 0), 0);
    const totalReserved = itemWhInventories.reduce((sum: number, w: any) => sum + (w.reserved || 0), 0);

    if (item.stock !== totalStock || (item.reservedStock || 0) !== totalReserved) {
      item.stock = totalStock;
      item.reservedStock = totalReserved;
      await dbService.put('inventory', item);
      syncedCount++;
    }
  }

  return syncedCount;
}

export async function createWarehouseSnapshot(): Promise<{ itemId: string; warehouseId: string; quantity: number; reserved: number }[]> {
  const warehouseInventory = await dbService.getAll<any>('warehouseInventory');
  return warehouseInventory.map((w: any) => ({
    itemId: w.itemId,
    warehouseId: w.warehouseId,
    quantity: w.quantity || 0,
    reserved: w.reserved || 0,
  }));
}
