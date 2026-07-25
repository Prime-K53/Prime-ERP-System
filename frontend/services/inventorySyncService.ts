import { dbService } from './db';
import { apiClient as fetchApiClient, OfflineRequestError } from './apiClient';
import { logger } from './logger';

async function fetchAllInventoryFromApi(): Promise<any[]> {
  try {
    const response = await fetchApiClient.requestJson<any[]>({ endpoint: '/inventory' });
    if (Array.isArray(response)) return response;
  } catch (err: any) {
    if (!(err instanceof OfflineRequestError || err?.name === 'OfflineRequestError')) {
      logger.warn('[InventorySync] API error fetching inventory:', err);
    }
  }
  return [];
}

export async function syncItemStockWithWarehouses(itemId: string): Promise<void> {
  const localInventory = await dbService.getAll<any>('inventory');
  const localItem = localInventory.find(i => i.id === itemId);
  if (!localItem) return;

  const apiInventory = await fetchAllInventoryFromApi();
  const apiItem = apiInventory.find((i: any) => i.id === itemId);

  const localWarehouseInventory = await dbService.getAll<any>('warehouseInventory');
  const itemWhInventories = localWarehouseInventory.filter((w: any) => w.itemId === itemId);

  if (itemWhInventories.length === 0) return;

  const totalStock = itemWhInventories.reduce((sum: number, w: any) => sum + (w.quantity || 0), 0);
  const totalReserved = itemWhInventories.reduce((sum: number, w: any) => sum + (w.reserved || 0), 0);

  const currentRemoteStock = apiItem ? Number(apiItem.quantity || apiItem.stock || 0) : localItem.stock;
  const currentRemoteReserved = apiItem ? Number(apiItem.reserved || 0) : (localItem.reservedStock || localItem.reserved || 0);

  if (currentRemoteStock !== totalStock || currentRemoteReserved !== totalReserved) {
    try {
      await fetchApiClient.requestJson({
        endpoint: `/inventory/${itemId}`,
        method: 'PUT',
        body: JSON.stringify({ quantity: totalStock, reserved: totalReserved })
      });
    } catch (apiErr: any) {
      if (!(apiErr instanceof OfflineRequestError || apiErr?.name === 'OfflineRequestError')) {
        logger.warn('[InventorySync] API error syncing item:', apiErr);
      }
    }
  }

  if (localItem.stock !== totalStock || (localItem.reservedStock || 0) !== totalReserved) {
    localItem.stock = totalStock;
    localItem.reservedStock = totalReserved;
    await dbService.put('inventory', localItem);
  }
}

export async function syncAllItemStockWithWarehouses(): Promise<number> {
  const localInventory = await dbService.getAll<any>('inventory');
  const localWarehouseInventory = await dbService.getAll<any>('warehouseInventory');
  const apiInventory = await fetchAllInventoryFromApi();
  let syncedCount = 0;

  for (const item of localInventory) {
    const itemWhInventories = localWarehouseInventory.filter((w: any) => w.itemId === item.id);
    if (itemWhInventories.length === 0) continue;

    const totalStock = itemWhInventories.reduce((sum: number, w: any) => sum + (w.quantity || 0), 0);
    const totalReserved = itemWhInventories.reduce((sum: number, w: any) => sum + (w.reserved || 0), 0);

    const apiItem = apiInventory.find((i: any) => i.id === item.id);
    const currentRemoteStock = apiItem ? Number(apiItem.quantity || apiItem.stock || 0) : item.stock;
    const currentRemoteReserved = apiItem ? Number(apiItem.reserved || 0) : (item.reservedStock || item.reserved || 0);

    if (currentRemoteStock !== totalStock || currentRemoteReserved !== totalReserved) {
      try {
        await fetchApiClient.requestJson({
          endpoint: `/inventory/${item.id}`,
          method: 'PUT',
          body: JSON.stringify({ quantity: totalStock, reserved: totalReserved })
        });
      } catch (apiErr: any) {
        if (!(apiErr instanceof OfflineRequestError || apiErr?.name === 'OfflineRequestError')) {
          logger.warn('[InventorySync] API error syncing item:', apiErr);
        }
      }

      item.stock = totalStock;
      item.reservedStock = totalReserved;
      await dbService.put('inventory', item);
      syncedCount++;
    }
  }

  return syncedCount;
}

export async function syncWarehouseFromMaster(itemId: string): Promise<void> {
  try {
    await fetchApiClient.requestJson({
      endpoint: '/warehouses/sync-master',
      method: 'POST',
      body: JSON.stringify({ itemId })
    });
  } catch (apiErr: any) {
    if (apiErr instanceof OfflineRequestError || apiErr?.name === 'OfflineRequestError') {
      const inventory = await dbService.getAll<any>('inventory');
      const item = inventory.find(i => i.id === itemId);
      if (!item) return;

      const warehouseInventory = await dbService.getAll<any>('warehouseInventory');
      const existingWh = warehouseInventory.find((w: any) => w.itemId === itemId);

      if (!existingWh) {
        await dbService.put('warehouseInventory', {
          id: `WH-MAIN_${itemId}`,
          itemId,
          warehouseId: 'WH-MAIN',
          quantity: item.stock || 0,
          reserved: item.reservedStock || 0
        });
      }
    } else {
      logger.warn('[InventorySync] API error syncing warehouse from master:', apiErr);
    }
  }

  const inventory = await dbService.getAll<any>('inventory');
  const item = inventory.find(i => i.id === itemId);
  if (!item) return;

  const warehouseInventory = await dbService.getAll<any>('warehouseInventory');
  const existingWh = warehouseInventory.find((w: any) => w.itemId === itemId);

  if (!existingWh) {
    await dbService.put('warehouseInventory', {
      id: `WH-MAIN_${itemId}`,
      itemId,
      warehouseId: 'WH-MAIN',
      quantity: item.stock || 0,
      reserved: item.reservedStock || 0
    });
  }
}

export async function createWarehouseSnapshot(notes?: string): Promise<{ itemId: string; warehouseId: string; quantity: number; reserved: number }[]> {
  const warehouseInventory = await dbService.getAll<any>('warehouseInventory');
  const snapshotData = warehouseInventory.map((w: any) => ({
    itemId: w.itemId,
    warehouseId: w.warehouseId,
    quantity: w.quantity || 0,
    reserved: w.reserved || 0,
  }));

  try {
    await fetchApiClient.requestJson({
      endpoint: '/warehouses/snapshot',
      method: 'POST',
      body: JSON.stringify({ snapshot_data: snapshotData, snapshot_type: 'manual', notes: notes || '' })
    });
  } catch (apiErr: any) {
    if (!(apiErr instanceof OfflineRequestError || apiErr?.name === 'OfflineRequestError')) {
      logger.warn('[InventorySync] API error saving snapshot:', apiErr);
    }
  }

  return snapshotData;
}

export async function getWarehouseSnapshots(limit: number = 20): Promise<any[]> {
  try {
    const response = await fetchApiClient.requestJson<any[]>({ endpoint: `/warehouses/snapshot?limit=${limit}` });
    if (Array.isArray(response)) {
      for (const snap of response) {
        await dbService.put('warehouseSnapshots', snap);
      }
      return response;
    }
  } catch (apiErr: any) {
    if (!(apiErr instanceof OfflineRequestError || apiErr?.name === 'OfflineRequestError')) {
      logger.warn('[InventorySync] API error fetching snapshots:', apiErr);
    }
  }
  return (await dbService.getAll<any>('warehouseSnapshots'))
    .sort((a: any, b: any) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime())
    .slice(0, limit);
}

export async function getWarehouseInventory(warehouseId?: string): Promise<any[]> {
  try {
    if (warehouseId) {
      const response = await fetchApiClient.requestJson<any[]>({ endpoint: `/inventory/warehouse/${warehouseId}` });
      if (Array.isArray(response)) {
        for (const wh of response) {
          await dbService.put('warehouseInventory', wh);
        }
        return response;
      }
    } else {
      const response = await fetchApiClient.requestJson<any[]>({ endpoint: '/warehouses' });
      if (Array.isArray(response)) return response;
    }
  } catch (apiErr: any) {
    if (!(apiErr instanceof OfflineRequestError || apiErr?.name === 'OfflineRequestError')) {
      logger.warn('[InventorySync] API error fetching warehouse inventory:', apiErr);
    }
  }

  const inventory = await dbService.getAll<any>('warehouseInventory');
  if (warehouseId) {
    return inventory.filter((i: any) => i.warehouseId === warehouseId);
  }
  return inventory;
}
