import { dbService } from './db';
import { jobTicketService } from './jobTicketService';

type SourceType = 'quotation' | 'examination_batch';

type ConversionOptions = {
  requestedBy?: string;
  requesterRole?: string;
  force?: boolean;
};

type ConversionResult = {
  success: boolean;
  sourceType: SourceType;
  sourceId: string;
  jobTicketId: string;
  message: string;
  workflowStarted: boolean;
};

const nowIso = () => new Date().toISOString();

const toSafeString = (value: any) => String(value || '').trim();
const toSafeNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value: any) => Math.round(toSafeNumber(value, 0) * 100) / 100;

const normalizeJobTicketPriority = (value: any): 'Normal' | 'Rush' | 'Express' | 'Urgent' => {
  const normalized = toSafeString(value).toLowerCase();
  if (normalized === 'urgent' || normalized === 'critical' || normalized === 'high') return 'Urgent';
  if (normalized === 'express') return 'Express';
  if (normalized === 'rush') return 'Rush';
  return 'Normal';
};

const buildQuotationDescription = (quotation: any) => {
  const itemNames = (Array.isArray(quotation?.items) ? quotation.items : [])
    .map((item: any) => toSafeString(item?.name || item?.description || item?.id))
    .filter(Boolean);

  if (itemNames.length === 0) return `Converted from quotation ${quotation?.id || ''}`.trim();
  if (itemNames.length === 1) return itemNames[0];
  return `${itemNames[0]} +${itemNames.length - 1} more item${itemNames.length - 1 === 1 ? '' : 's'}`;
};

const buildBatchDescription = (batch: any) => {
  const classes = Array.isArray(batch?.classes) ? batch.classes : [];
  const classNames = classes
    .map((cls: any) => toSafeString(cls?.class_name || cls?.name))
    .filter(Boolean);

  if (classNames.length === 0) {
    return `Examination batch ${toSafeString(batch?.name || batch?.id)}`.trim();
  }

  if (classNames.length === 1) {
    return `${classNames[0]} examination printing`;
  }

  return `${classNames[0]} +${classNames.length - 1} more class${classNames.length - 1 === 1 ? '' : 'es'}`;
};

const createAuditLog = (params: {
  sourceType: SourceType;
  sourceId: string;
  jobTicketId: string;
  requestedBy: string;
  requesterRole: string;
  details: string;
}) => ({
  id: `LOG-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  date: nowIso(),
  action: 'CREATE',
  entityType: 'JobTicketConversion',
  entityId: params.jobTicketId,
  details: params.details,
  userId: params.requestedBy,
  userRole: params.requesterRole,
  newValue: {
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    jobTicketId: params.jobTicketId
  }
});

const getLockId = (sourceType: SourceType, sourceId: string) => `CONV-${sourceType}-${sourceId}`;

const validateQuotationForConversion = (quotation: any) => {
  const errors: string[] = [];
  if (!toSafeString(quotation?.id)) errors.push('Quotation ID is required');
  if (!toSafeString(quotation?.customerName)) errors.push('Customer name is required');
  if (!Array.isArray(quotation?.items) || quotation.items.length === 0) errors.push('At least one quotation item is required');
  const quotationType = toSafeString(quotation?.quotationType || 'General').toLowerCase();
  if (quotationType !== 'general') errors.push('Only General quotations can be converted through this conversion flow');
  if (toSafeString(quotation?.status).toLowerCase() === 'converted') errors.push('Quotation already converted');
  if (toSafeString((quotation as any)?.convertedJobTicketId)) errors.push('Quotation already linked to a job ticket');
  return errors;
};

const validateBatchForConversion = (batch: any) => {
  const errors: string[] = [];
  if (!toSafeString(batch?.id)) errors.push('Batch ID is required');
  if (!toSafeString(batch?.name)) errors.push('Batch name is required');
  if (!Array.isArray(batch?.classes) || batch.classes.length === 0) errors.push('At least one class is required');
  if (toSafeString(batch?.status).toLowerCase() === 'cancelled') errors.push('Cancelled batch cannot be converted');
  if (toSafeString((batch as any)?.convertedJobTicketId)) errors.push('Batch already linked to a job ticket');
  return errors;
};

const createQuotationJobTicket = async (quotation: any) => {
  const items = Array.isArray(quotation?.items) ? quotation.items : [];
  const totalQuantity = Math.max(1, items.reduce((sum: number, item: any) => sum + toSafeNumber(item?.quantity, 0), 0) || 0);
  const totalAmount = roundMoney(
    quotation?.totalAmount
    ?? quotation?.total
    ?? items.reduce(
      (sum: number, item: any) =>
        sum + toSafeNumber(item?.total, toSafeNumber(item?.quantity, 0) * toSafeNumber(item?.price, 0)),
      0
    )
  );
  const unitPrice = totalQuantity > 0 ? roundMoney(totalAmount / totalQuantity) : totalAmount;
  const baseNotes = `Generated from quotation ${quotation.id}`;
  const internalNotes = items
    .map((item: any) => `- ${toSafeString(item?.name || item?.description || item?.id || 'Item')} x${Math.max(1, toSafeNumber(item?.quantity, 1))}`)
    .join('\n');

  const createdTicket = await jobTicketService.create({
    type: 'Printing',
    customerId: quotation?.customerId || undefined,
    customerName: quotation?.customerName || 'Walk-in',
    customerPhone: quotation?.customerPhone || quotation?.phone || undefined,
    description: buildQuotationDescription(quotation),
    quantity: totalQuantity,
    priority: normalizeJobTicketPriority(quotation?.priority),
    status: 'Received',
    dueDate: quotation?.validUntil || undefined,
    unitPrice,
    notes: baseNotes,
    internalNotes,
    createdBy: quotation?.updatedBy || quotation?.createdBy || undefined,
    dateReceived: nowIso()
  } as any);

  const finalizedTicket = await jobTicketService.update(createdTicket.id, {
    rushFee: 0,
    finishingCost: 0,
    discount: 0,
    subtotal: totalAmount,
    tax: 0,
    total: totalAmount,
    notes: baseNotes,
    internalNotes
  });

  return finalizedTicket || createdTicket;
};

const createBatchJobTicket = async (batch: any) => {
  const classes = Array.isArray(batch.classes) ? batch.classes : [];
  const totalLearners = classes.reduce((sum: number, cls: any) => {
    const learners = toSafeNumber(cls.learners ?? cls.student_count ?? cls.number_of_learners, 0);
    return sum + learners;
  }, 0);
  const totalQuantity = Math.max(1, totalLearners || classes.length);
  const totalAmount = roundMoney(
    batch?.total_amount
    ?? batch?.totalAmount
    ?? classes.reduce((sum: number, cls: any) => {
      const learners = Math.max(1, toSafeNumber(cls?.learners ?? cls?.student_count ?? cls?.number_of_learners, 1));
      const fee = toSafeNumber(cls?.fee_per_learner ?? cls?.price_per_learner, 0);
      return sum + (learners * fee);
    }, 0)
  );
  const unitPrice = totalQuantity > 0 ? roundMoney(totalAmount / totalQuantity) : totalAmount;
  const classSummary = classes
    .map((cls: any, index: number) => {
      const className = toSafeString(cls?.class_name || cls?.name || `Class ${index + 1}`) || `Class ${index + 1}`;
      const learners = Math.max(1, toSafeNumber(cls?.learners ?? cls?.student_count ?? cls?.number_of_learners, 1));
      return `- ${className} (${learners} learner${learners === 1 ? '' : 's'})`;
    })
    .join('\n');
  const baseNotes = `Generated from examination batch ${batch.id}`;

  const createdTicket = await jobTicketService.create({
    type: 'Printing',
    customerId: batch?.school_id || batch?.customer_id || undefined,
    customerName: batch?.school_name || batch?.customer_name || batch?.name || 'Walk-in',
    customerPhone: batch?.school_phone || batch?.customer_phone || batch?.phone || undefined,
    description: buildBatchDescription(batch),
    quantity: totalQuantity,
    priority: normalizeJobTicketPriority(batch?.priority),
    status: 'Received',
    dueDate: batch?.examination_date || batch?.due_date || undefined,
    unitPrice,
    notes: baseNotes,
    internalNotes: classSummary,
    createdBy: batch?.updated_by || batch?.created_by || undefined,
    dateReceived: nowIso()
  } as any);

  const finalizedTicket = await jobTicketService.update(createdTicket.id, {
    rushFee: 0,
    finishingCost: 0,
    discount: 0,
    subtotal: totalAmount,
    tax: 0,
    total: totalAmount,
    notes: baseNotes,
    internalNotes: classSummary
  });

  return finalizedTicket || createdTicket;
};

const convertQuotationToJobTicket = async (quotationId: string, options: ConversionOptions = {}): Promise<ConversionResult> => {
  const requestedBy = toSafeString(options.requestedBy) || 'system';
  const requesterRole = toSafeString(options.requesterRole) || 'System';
  const force = Boolean(options.force);
  let createdTicketId: string | null = null;

  try {
    const conversion = await dbService.executeAtomicOperation(
      ['quotations', 'auditLogs', 'idempotencyKeys'],
      async (tx) => {
        const quotationStore = tx.objectStore('quotations');
        const auditLogStore = tx.objectStore('auditLogs');
        const idempotencyStore = tx.objectStore('idempotencyKeys');

        const quotation = await quotationStore.get(quotationId);
        if (!quotation) {
          throw new Error('Quotation not found');
        }

        const validationErrors = validateQuotationForConversion(quotation);
        if (!force && validationErrors.length > 0) {
          throw new Error(validationErrors.join('; '));
        }

        const lockId = getLockId('quotation', quotationId);
        const existingLock = await idempotencyStore.get(lockId);
        if (existingLock && !force) {
          throw new Error('Conversion already in progress or completed for this quotation');
        }

        await idempotencyStore.put({
          id: lockId,
          scope: 'job_ticket_conversion',
          sourceId: quotationId,
          createdAt: nowIso(),
          metadata: { sourceType: 'quotation', requestedBy }
        });

        const ticket = await createQuotationJobTicket(quotation);
        createdTicketId = ticket.id;
        const jobTicketId = ticket.ticketNumber || ticket.id;

        const updatedQuotation = {
          ...quotation,
          status: 'Converted',
          conversionStatus: 'Converted',
          convertedJobTicketId: jobTicketId,
          convertedAt: nowIso()
        };

        await quotationStore.put(updatedQuotation);

        const auditEntry = createAuditLog({
          sourceType: 'quotation',
          sourceId: quotationId,
          jobTicketId,
          requestedBy,
          requesterRole,
          details: `Quotation ${quotationId} converted to job ticket ${jobTicketId}`
        });
        await auditLogStore.put(auditEntry);

        return { jobTicketId, sourceId: quotationId, sourceType: 'quotation' as const };
      }
    );

    return {
      success: true,
      sourceType: 'quotation',
      sourceId: conversion.sourceId,
      jobTicketId: conversion.jobTicketId,
      message: `Quotation ${quotationId} converted successfully`,
      workflowStarted: false
    };
  } catch (error) {
    if (createdTicketId) {
      try {
        await jobTicketService.delete(createdTicketId);
      } catch {
        // Best-effort rollback for local job ticket storage.
      }
    }
    throw error;
  }
};

const convertExaminationBatchToJobTicket = async (batchId: string, options: ConversionOptions = {}): Promise<ConversionResult> => {
  const requestedBy = toSafeString(options.requestedBy) || 'system';
  const requesterRole = toSafeString(options.requesterRole) || 'System';
  const force = Boolean(options.force);
  let createdTicketId: string | null = null;

  try {
    const conversion = await dbService.executeAtomicOperation(
      ['examinationBatches', 'auditLogs', 'idempotencyKeys'],
      async (tx) => {
        const batchStore = tx.objectStore('examinationBatches');
        const auditLogStore = tx.objectStore('auditLogs');
        const idempotencyStore = tx.objectStore('idempotencyKeys');

        const batch = await batchStore.get(batchId);
        if (!batch) {
          throw new Error('Examination batch not found');
        }

        const validationErrors = validateBatchForConversion(batch);
        if (!force && validationErrors.length > 0) {
          throw new Error(validationErrors.join('; '));
        }

        const lockId = getLockId('examination_batch', batchId);
        const existingLock = await idempotencyStore.get(lockId);
        if (existingLock && !force) {
          throw new Error('Conversion already in progress or completed for this batch');
        }

        await idempotencyStore.put({
          id: lockId,
          scope: 'job_ticket_conversion',
          sourceId: batchId,
          createdAt: nowIso(),
          metadata: { sourceType: 'examination_batch', requestedBy }
        });

        const ticket = await createBatchJobTicket(batch);
        createdTicketId = ticket.id;
        const jobTicketId = ticket.ticketNumber || ticket.id;

        const updatedBatch = {
          ...batch,
          conversionStatus: 'Converted',
          convertedJobTicketId: jobTicketId,
          convertedAt: nowIso()
        };

        await batchStore.put(updatedBatch);

        const auditEntry = createAuditLog({
          sourceType: 'examination_batch',
          sourceId: batchId,
          jobTicketId,
          requestedBy,
          requesterRole,
          details: `Examination batch ${batchId} converted to job ticket ${jobTicketId}`
        });
        await auditLogStore.put(auditEntry);

        return { jobTicketId, sourceId: batchId, sourceType: 'examination_batch' as const };
      }
    );

    return {
      success: true,
      sourceType: 'examination_batch',
      sourceId: conversion.sourceId,
      jobTicketId: conversion.jobTicketId,
      message: `Examination batch ${batchId} converted successfully`,
      workflowStarted: false
    };
  } catch (error) {
    if (createdTicketId) {
      try {
        await jobTicketService.delete(createdTicketId);
      } catch {
        // Best-effort rollback for local job ticket storage.
      }
    }
    throw error;
  }
};

export const jobTicketConversionService = {
  convertQuotationToJobTicket,
  convertExaminationBatchToJobTicket
};

export type { ConversionOptions, ConversionResult, SourceType };
