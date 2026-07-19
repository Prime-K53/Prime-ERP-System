/**
 * Inventory Transaction Service
 * 
 * Provides secure inventory deduction with:
 * - Multi-warehouse support
 * - Batch/lot tracking
 * - Full audit trail
 * - Transaction rollback support
 */


import { logger } from './logger';
import { InventoryTransaction, MaterialBatch, WarehouseInventory } from '../types';
import { dbService } from './db';
import { generateOpaqueId } from '../utils/idGeneration';

export interface InventoryDeductionRequest {
  itemId: string;
  warehouseId: string;
  quantity: number;
  batchId?: string;
  reason: string;
  reference?: string;
  referenceId?: string;
  performedBy: string;
}

export interface InventoryDeductionResult {
  success: boolean;
  transaction?: InventoryTransaction;
  remainingQuantity?: number;
  error?: string;
  alreadyProcessed?: boolean;
}

export interface InventoryAdditionRequest {
  itemId: string;
  warehouseId: string;
  quantity: number;
  batchId?: string;
  unitCost: number;
  reason: string;
  reference?: string;
  referenceId?: string;
  performedBy: string;
  supplierId?: string;
  supplierName?: string;
  expiryDate?: string;
}

class InventoryTransactionService {
  /**
   * Deduct inventory from warehouse with full tracking
   */
  async deductInventory(request: InventoryDeductionRequest): Promise<InventoryDeductionResult> {
    const { itemId, warehouseId, quantity, batchId, reason, reference, referenceId, performedBy } = request;

    try {
      // Idempotency check: skip if this reference+item was already deducted
      if (reference && referenceId) {
        const existingTxns = await dbService.getAll<InventoryTransaction>('inventoryTransactions');
        const alreadyDeducted = existingTxns.some(t =>
          t.reference === reference &&
          t.referenceId === referenceId &&
          t.itemId === itemId &&
          t.batchId === (batchId || undefined) &&
          t.type === 'OUT'
        );
        if (alreadyDeducted) {
          return { success: true, alreadyProcessed: true };
        }
      }

      // Get current inventory
      const item = await dbService.get<any>('inventory', itemId);
      
      if (!item) {
        return { success: false, error: 'Item not found' };
      }

      // Check warehouse inventory if multi-warehouse is enabled
      const warehouseInventoryList = await dbService.getAll<WarehouseInventory>('warehouseInventory');
      let currentQuantity = item.stock || 0;
      
      if (warehouseId) {
        const whInv = warehouseInventoryList.find(w => w.itemId === itemId && w.warehouseId === warehouseId);
        currentQuantity = whInv?.quantity || 0;
      }

      // Check if sufficient quantity available
      const companyConfig = JSON.parse(localStorage.getItem('nexus_company_config') || '{}');
      const allowNegative = companyConfig?.inventorySettings?.allowNegativeStock === true;
      if (!allowNegative && currentQuantity < quantity) {
        return { 
          success: false, 
          error: `Insufficient stock. Available: ${currentQuantity}, Requested: ${quantity}` 
        };
      }

      // Handle batch-specific deduction
      if (batchId) {
        const batches = await dbService.getAll<MaterialBatch>('materialBatches');
        const batch = batches.find(b => b.id === batchId && b.itemId === itemId);
        
        if (!batch) {
          return { success: false, error: 'Batch not found' };
        }

        if (batch.remainingQuantity < quantity) {
          return { 
            success: false, 
            error: `Insufficient batch quantity. Available: ${batch.remainingQuantity}, Requested: ${quantity}` 
          };
        }

        // Update batch
        const updatedBatch = {
          ...batch,
          remainingQuantity: batch.remainingQuantity - quantity,
          status: batch.remainingQuantity - quantity <= 0 ? 'depleted' as const : 'active' as const,
          updatedAt: new Date().toISOString()
        };
        await dbService.put('materialBatches', updatedBatch);
      }

      // Calculate costs
      const unitCost = item.cost || 0;
      const totalCost = quantity * unitCost;

      // Create transaction record
      const transaction: InventoryTransaction = {
        id: generateOpaqueId('TXN'),
        itemId,
        warehouseId,
        batchId,
        type: 'OUT',
        quantity: -quantity,  // Negative for deduction
        previousQuantity: currentQuantity,
        newQuantity: currentQuantity - quantity,
        unitCost,
        totalCost: -totalCost,
        reference,
        referenceId,
        reason,
        performedBy,
        timestamp: new Date().toISOString()
      };

      // Save transaction
      await dbService.put('inventoryTransactions', transaction);

      // Update main inventory
      const updatedItem = {
        ...item,
        stock: (item.stock || 0) - quantity
      };
      await dbService.put('inventory', updatedItem);

      // Update warehouse inventory if tracking
      if (warehouseId) {
        const whInv = warehouseInventoryList.find(w => w.itemId === itemId && w.warehouseId === warehouseId);
        if (whInv) {
          const updatedWhInv = {
            ...whInv,
            quantity: (whInv.quantity || 0) - quantity,
            available: ((whInv.available || 0) - quantity),
            lastUpdated: new Date().toISOString()
          };
          await dbService.put('warehouseInventory', updatedWhInv);
        }
      }

      return {
        success: true,
        transaction,
        remainingQuantity: currentQuantity - quantity
      };

    } catch (error) {
      logger.error('[InventoryTransactionService] Error deducting inventory:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add inventory to warehouse with full tracking
   */
  async addInventory(request: InventoryAdditionRequest): Promise<InventoryDeductionResult> {
    const { 
      itemId, warehouseId, quantity, batchId, unitCost, reason, 
      reference, referenceId, performedBy, supplierId, supplierName, expiryDate 
    } = request;

    try {
      // Get current inventory
      const item = await dbService.get<any>('inventory', itemId);
      
      if (!item) {
        return { success: false, error: 'Item not found' };
      }

      let currentQuantity = item.stock || 0;
      let newQuantity = currentQuantity + quantity;

      // Create batch if provided
      if (batchId && quantity > 0) {
        const batchNumber = batchId || generateOpaqueId('BATCH');
        
        const newBatch: MaterialBatch = {
          id: batchNumber,
          itemId,
          batchNumber,
          quantity,
          remainingQuantity: quantity,
          costPerUnit: unitCost,
          receivedDate: new Date().toISOString(),
          expiryDate,
          supplierId,
          supplierName,
          warehouseId,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        
        await dbService.put('materialBatches', newBatch);
      }

      // Calculate costs
      const totalCost = quantity * unitCost;

      // Create transaction record
      const transaction: InventoryTransaction = {
        id: generateOpaqueId('TXN'),
        itemId,
        warehouseId,
        batchId,
        type: 'IN',
        quantity,
        previousQuantity: currentQuantity,
        newQuantity,
        unitCost,
        totalCost,
        reference,
        referenceId,
        reason,
        performedBy,
        timestamp: new Date().toISOString()
      };

      // Save transaction
      await dbService.put('inventoryTransactions', transaction);

      // Update main inventory with weighted-average normalized cost
      const currentCost = item.normalizedCP ?? item.cost ?? 0;
      const newNormalizedCP = currentQuantity > 0
        ? ((currentCost * currentQuantity) + (unitCost * quantity)) / newQuantity
        : unitCost;
      const updatedItem = {
        ...item,
        stock: newQuantity,
        normalizedCP: newNormalizedCP,
        cost: newNormalizedCP,
        costPrice: newNormalizedCP,
      };
      await dbService.put('inventory', updatedItem);

      // Update or create warehouse inventory
      const warehouseInventoryList = await dbService.getAll<WarehouseInventory>('warehouseInventory');
      const whInv = warehouseInventoryList.find(w => w.itemId === itemId && w.warehouseId === warehouseId);
      
      if (whInv) {
        const updatedWhInv = {
          ...whInv,
          quantity: (whInv.quantity || 0) + quantity,
          available: ((whInv.available || 0) + quantity),
          lastUpdated: new Date().toISOString()
        };
        await dbService.put('warehouseInventory', updatedWhInv);
      } else if (warehouseId) {
        const newWhInv: WarehouseInventory = {
          id: generateOpaqueId('WHINV'),
          itemId,
          warehouseId,
          quantity,
          reserved: 0,
          available: quantity,
          lastUpdated: new Date().toISOString()
        };
        await dbService.put('warehouseInventory', newWhInv);
      }

      return {
        success: true,
        transaction,
        remainingQuantity: newQuantity
      };

    } catch (error) {
      logger.error('[InventoryTransactionService] Error adding inventory:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get transaction history for an item
   */
  async getTransactionHistory(itemId: string, limit: number = 50): Promise<InventoryTransaction[]> {
    const transactions = await dbService.getAll<InventoryTransaction>('inventoryTransactions');
    return transactions
      .filter(t => t.itemId === itemId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get active batches for an item
   */
  async getActiveBatches(itemId: string): Promise<MaterialBatch[]> {
    const batches = await dbService.getAll<MaterialBatch>('materialBatches');
    return batches
      .filter(b => b.itemId === itemId && b.status === 'active' && b.remainingQuantity > 0)
      .sort((a, b) => new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime());
  }

  /**
   * Get warehouse inventory summary
   */
  async getWarehouseInventory(warehouseId?: string): Promise<WarehouseInventory[]> {
    const inventory = await dbService.getAll<WarehouseInventory>('warehouseInventory');
    if (warehouseId) {
      return inventory.filter(i => i.warehouseId === warehouseId);
    }
    return inventory;
  }
}

/**
 * Inventory Reservation Service
 * 
 * Manages material reservations for work orders to prevent inventory conflicts
 */
export interface ReservationRequest {
  workOrderId: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unitCost: number;
  warehouseId?: string;
}

export interface ReservationResult {
  success: boolean;
  reservationId?: string;
  available?: number;
  error?: string;
}

export interface ReservationReleaseRequest {
  workOrderId: string;
  materialId?: string;
}

class InventoryReservationService {
  /**
   * Check if materials are available for reservation
   */
  async checkAvailability(materialId: string, quantity: number, warehouseId?: string): Promise<{ available: number; canReserve: boolean }> {
    try {
      const inventory = await dbService.getAll<any>('inventory');
      const item = inventory.find(i => i.id === materialId);
      
      if (!item) {
        return { available: 0, canReserve: false };
      }

      // Get current reservations for this material
      const reservations = await this.getActiveReservationsForMaterial(materialId);
      const totalReserved = reservations.reduce((sum, r) => sum + r.quantityReserved, 0);

      // Check warehouse-specific availability if requested
      let availableQuantity = item.stock || 0;
      if (warehouseId) {
        const warehouseInventory = await dbService.getAll<WarehouseInventory>('warehouseInventory');
        const whInv = warehouseInventory.find(w => w.itemId === materialId && w.warehouseId === warehouseId);
        availableQuantity = whInv?.available || 0;
      }

      // Calculate truly available (stock - reserved)
      const trulyAvailable = availableQuantity - totalReserved;

      const companyConfig = JSON.parse(localStorage.getItem('nexus_company_config') || '{}');
      const allowNegative = companyConfig?.inventorySettings?.allowNegativeStock === true;

      return {
        available: trulyAvailable,
        canReserve: allowNegative || trulyAvailable >= quantity
      };
    } catch (error) {
      logger.error('[InventoryReservationService] Error checking availability:', error);
      return { available: 0, canReserve: false };
    }
  }

  /**
   * Create material reservations for a work order
   */
  async createReservations(requests: ReservationRequest[]): Promise<ReservationResult[]> {
    const results: ReservationResult[] = [];

    for (const request of requests) {
      const { workOrderId, materialId, materialName, quantity, unitCost, warehouseId } = request;

      try {
        // Check availability first with over-reservation validation
        const { available, canReserve } = await this.checkAvailability(materialId, quantity, warehouseId);

        if (!canReserve) {
          results.push({
            success: false,
            available,
            error: `Insufficient stock. Available: ${available}, Requested: ${quantity}`
          });
          continue;
        }

        // Validate that requested quantity is positive
        if (quantity <= 0) {
          results.push({
            success: false,
            error: `Invalid reservation quantity: ${quantity}. Must be greater than 0.`
          });
          continue;
        }

        // Create reservation record
        const reservationId = `RES-${workOrderId}-${materialId}`;
        const reservation = {
          id: reservationId,
          workOrderId,
          materialId,
          materialName,
          quantityReserved: quantity,
          quantityConsumed: 0,
          unitCost,
          status: 'Reserved' as const,
          reservedAt: new Date().toISOString(),
          warehouseId
        };

        // Save to database
        await dbService.put('materialReservations', reservation);

        // Update reserved stock in inventory
        await this.updateReservedStock(materialId, quantity, warehouseId);

        results.push({
          success: true,
          reservationId
        });

      } catch (error) {
        logger.error('[InventoryReservationService] Error creating reservation:', error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Consume reserved materials (called when work order is completed)
   */
  async consumeReservation(workOrderId: string, materialId: string, quantity: number): Promise<ReservationResult> {
    try {
      const reservationId = `RES-${workOrderId}-${materialId}`;
      const reservations = await dbService.getAll<any>('materialReservations');
      const reservation = reservations.find((r: any) => r.id === reservationId);

      if (!reservation) {
        return { success: false, error: 'Reservation not found' };
      }

      // Update reservation
      const updatedReservation = {
        ...reservation,
        quantityConsumed: reservation.quantityConsumed + quantity,
        status: (reservation.quantityConsumed + quantity >= reservation.quantityReserved) 
          ? 'Fully Consumed' as const 
          : 'Partially Consumed' as const,
        consumedAt: new Date().toISOString()
      };

      await dbService.put('materialReservations', updatedReservation);

      // Deduct from reserved stock
      await this.updateReservedStock(materialId, -quantity, reservation.warehouseId);

      return { success: true, reservationId };
    } catch (error) {
      logger.error('[InventoryReservationService] Error consuming reservation:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Release reservations (called when work order is cancelled)
   */
  async releaseReservations(workOrderId: string, materialId?: string): Promise<ReservationResult[]> {
    const results: ReservationResult[] = [];

    try {
      const reservations = await dbService.getAll<any>('materialReservations');
      const workOrderReservations = reservations.filter((r: any) => 
        r.workOrderId === workOrderId && 
        (materialId ? r.materialId === materialId : true) &&
        r.status !== 'Released' &&
        r.status !== 'Fully Consumed'
      );

      for (const reservation of workOrderReservations) {
        const remainingQty = reservation.quantityReserved - reservation.quantityConsumed;

        // Update reservation status
        const updatedReservation = {
          ...reservation,
          status: 'Released' as const,
          releasedAt: new Date().toISOString()
        };

        await dbService.put('materialReservations', updatedReservation);

        // Release reserved stock
        if (remainingQty > 0) {
          await this.updateReservedStock(reservation.materialId, -remainingQty, reservation.warehouseId);
        }

        results.push({ success: true, reservationId: reservation.id });
      }

      return results;
    } catch (error) {
      logger.error('[InventoryReservationService] Error releasing reservations:', error);
      return [{ success: false, error: error instanceof Error ? error.message : 'Unknown error' }];
    }
  }

  /**
   * Get active reservations for a material
   */
  async getActiveReservationsForMaterial(materialId: string): Promise<any[]> {
    const reservations = await dbService.getAll<any>('materialReservations');
    return reservations.filter((r: any) => 
      r.materialId === materialId && 
      (r.status === 'Reserved' || r.status === 'Partially Consumed')
    );
  }

  /**
   * Get reservations for a work order
   */
  async getReservationsForWorkOrder(workOrderId: string): Promise<any[]> {
    const reservations = await dbService.getAll<any>('materialReservations');
    return reservations.filter((r: any) => r.workOrderId === workOrderId);
  }

  /**
   * Update reserved stock in inventory
   * Writes to both `reserved` (canonical) and `reservedStock` (backward compat)
   */
  private async updateReservedStock(materialId: string, quantity: number, warehouseId?: string): Promise<void> {
    const inventory = await dbService.getAll<any>('inventory');
    const item = inventory.find(i => i.id === materialId);
    
    if (item) {
      const newReserved = (item.reserved || 0) + quantity;
      const updatedItem = {
        ...item,
        reserved: newReserved,
        reservedStock: newReserved
      };
      await dbService.put('inventory', updatedItem);
    }

    // Update warehouse inventory if specified
    if (warehouseId) {
      const warehouseInventory = await dbService.getAll<WarehouseInventory>('warehouseInventory');
      const whInv = warehouseInventory.find(w => w.itemId === materialId && w.warehouseId === warehouseId);
      
      if (whInv) {
        const updatedWhInv = {
          ...whInv,
          reserved: (whInv.reserved || 0) + quantity,
          available: (whInv.available || whInv.quantity || 0) - quantity
        };
        await dbService.put('warehouseInventory', updatedWhInv);
      }
    }
  }

  /**
   * Check if sales order items can be reserved (have sufficient stock)
   */
  async checkSalesOrderAvailability(items: { productId: string; quantity: number }[]): Promise<{ available: boolean; unavailable: { productId: string; available: number; requested: number }[] }> {
    const unavailable: { productId: string; available: number; requested: number }[] = [];
    const inventory = await dbService.getAll<any>('inventory');

    for (const item of items) {
      const invItem = inventory.find(i => i.id === item.productId);
      if (!invItem) {
        unavailable.push({ productId: item.productId, available: 0, requested: item.quantity });
        continue;
      }

      const reservations = await this.getActiveReservationsForMaterial(item.productId);
      const totalReserved = reservations.reduce((sum, r) => sum + r.quantityReserved, 0);
      const available = (invItem.stock || 0) - (invItem.reserved || invItem.reservedStock || 0) - totalReserved;

      if (available < item.quantity) {
        unavailable.push({ productId: item.productId, available, requested: item.quantity });
      }
    }

    return { available: unavailable.length === 0, unavailable };
  }

  /**
   * Create reservations for a sales order
   */
  async createSalesOrderReservations(
    salesOrderId: string,
    items: { productId: string; productName?: string; quantity: number; unitPrice: number; warehouseId?: string }[]
  ): Promise<{ success: boolean; results: { productId: string; success: boolean; error?: string }[] }> {
    const results: { productId: string; success: boolean; error?: string }[] = [];

    for (const item of items) {
      try {
        const { available, canReserve } = await this.checkAvailability(item.productId, item.quantity, item.warehouseId);

        if (!canReserve) {
          results.push({ productId: item.productId, success: false, error: `Insufficient stock. Available: ${available}, Requested: ${item.quantity}` });
          continue;
        }

        const reservation = {
          id: `SO-RES-${salesOrderId}-${item.productId}`,
          salesOrderId,
          itemId: item.productId,
          quantityReserved: item.quantity,
          quantityConsumed: 0,
          unitPrice: item.unitPrice,
          status: 'Reserved' as const,
          reservedAt: new Date().toISOString(),
          warehouseId: item.warehouseId
        };

        await dbService.put('materialReservations', reservation);
        await this.updateReservedStock(item.productId, item.quantity, item.warehouseId);

        results.push({ productId: item.productId, success: true });
      } catch (error) {
        results.push({ productId: item.productId, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return { success: results.every(r => r.success), results };
  }

  /**
   * Release all reservations for a sales order (on cancel/fulfill)
   */
  async releaseSalesOrderReservations(salesOrderId: string, consumeFulfilled?: boolean): Promise<void> {
    const reservations = await dbService.getAll<any>('materialReservations');
    const orderReservations = reservations.filter(
      (r: any) => r.salesOrderId === salesOrderId && r.status !== 'Released' && r.status !== 'Fully Consumed'
    );

    for (const reservation of orderReservations) {
      const remainingQty = reservation.quantityReserved - (consumeFulfilled ? reservation.quantityReserved : 0);

      const updatedReservation = {
        ...reservation,
        status: consumeFulfilled ? 'Fully Consumed' as const : 'Released' as const,
        consumedAt: consumeFulfilled ? new Date().toISOString() : undefined,
        releasedAt: consumeFulfilled ? undefined : new Date().toISOString()
      };

      await dbService.put('materialReservations', updatedReservation);

      if (remainingQty > 0 && !consumeFulfilled) {
        await this.updateReservedStock(reservation.itemId, -remainingQty, reservation.warehouseId);
      }
    }
  }
}

export const inventoryReservationService = new InventoryReservationService();

// Export singleton instances
export const inventoryTransactionService = new InventoryTransactionService();
export default inventoryTransactionService;
