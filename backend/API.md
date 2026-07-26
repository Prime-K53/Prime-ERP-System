# Prime ERP Backend API

Base URL: `http://localhost:3000/api`

Authentication: Bearer JWT token in `Authorization` header.
Company context: `x-company-id` header.

---

## Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server + database connectivity check |

## Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard?days=30` | Aggregated sales/invoice metrics |

## Sales
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sales` | view_sales | List sales with optional search/filter |
| POST | `/api/sales` | create_sale | Create POS sale |
| PUT | `/api/sales/:id` | edit_sale | Update sale |
| DELETE | `/api/sales/:id` | delete_sale | Soft-void sale |
| GET | `/api/sales-orders` | view_sales_orders | List sales orders |
| GET | `/api/sales-orders/:id` | view_sales_orders | Get sales order by ID |
| POST | `/api/sales-orders` | create_sales_order | Create sales order |
| PUT | `/api/sales-orders/:id` | edit_sales_order | Update sales order |
| DELETE | `/api/sales-orders/:id` | delete_sales_order | Delete sales order |
| GET | `/api/sales-exchanges` | view_exchanges | List exchanges |
| GET | `/api/sales-exchanges/:id` | view_exchanges | Get exchange detail |
| POST | `/api/sales-exchanges` | create_exchange | Create exchange request |
| POST | `/api/sales-exchanges/:id/approve` | approve_exchange | Approve exchange |

## Finance / Accounting
| Method | Path | Validation | Description |
|--------|------|-----------|-------------|
| GET | `/api/accounts` | — | List chart of accounts |
| GET | `/api/accounts/:id` | — | Get account by ID |
| POST | `/api/accounts` | accountSchemas.create | Create account |
| PUT | `/api/accounts/:id` | accountSchemas.update | Update account |
| DELETE | `/api/accounts/:id` | — | Delete account |
| GET | `/api/ledger` | — | List ledger entries (query: `?account_id=`) |
| POST | `/api/ledger` | journalEntry schema | Post journal entry (debit/credit lines) |
| GET | `/api/expenses` | — | List expenses |
| POST | `/api/expenses` | expenseSchemas.create | Create expense |
| PUT | `/api/expenses/:id` | expenseSchemas.update | Update expense |
| DELETE | `/api/expenses/:id` | — | Delete expense |
| GET | `/api/income` | — | List income records |
| POST | `/api/income` | incomeSchemas.create | Record income |
| DELETE | `/api/income/:id` | — | Delete income |
| GET | `/api/budgets` | — | List budgets |
| POST | `/api/budgets` | budgetSchemas.create | Create budget |
| PUT | `/api/budgets/:id` | budgetSchemas.update | Update budget |
| DELETE | `/api/budgets/:id` | — | Delete budget |
| GET | `/api/transfers` | — | List transfers (includes account names) |
| POST | `/api/transfers` | transferSchemas.create | Execute fund transfer |

## Procurement
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/suppliers` | List suppliers |
| GET | `/api/suppliers/:id` | Get supplier detail |
| POST | `/api/suppliers` | Create supplier |
| PUT | `/api/suppliers/:id` | Update supplier |
| DELETE | `/api/suppliers/:id` | Delete supplier |
| GET | `/api/purchases` | List purchase orders |
| GET | `/api/purchases/:id` | Get PO with line items |
| POST | `/api/purchases` | Create PO (with items array) |
| PUT | `/api/purchases/:id/status` | Update PO status `{ "status": "Approved" }` |
| GET | `/api/grn` | List goods receipts |
| POST | `/api/grn` | Create goods receipt |

## Production
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/production/work-centers` | List active work centers |
| POST | `/api/production/work-centers` | Create work center |
| GET | `/api/production/resources` | List active resources |
| POST | `/api/production/resources` | Create resource |
| GET | `/api/production/work-orders` | List work orders |
| GET | `/api/production/work-orders/:id` | Get work order |
| POST | `/api/production/work-orders` | Create work order |
| PUT | `/api/production/work-orders/:id` | Update work order |
| DELETE | `/api/production/work-orders/:id` | Delete work order |
| GET | `/api/production/batches` | List production batches |
| POST | `/api/production/batches` | Create batch |

## HR
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/employees` | List employees |
| POST | `/api/employees` | Create employee |
| PUT | `/api/employees/:id` | Update employee |
| DELETE | `/api/employees/:id` | Delete employee |
| GET | `/api/payroll-runs` | List payroll runs |
| POST | `/api/payroll-runs` | Create payroll run |
| GET | `/api/payslips` | List payslips |
| POST | `/api/payslips` | Create payslip |

## Documents
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/documents/register` | create_document | Register or update document |
| POST | `/api/documents` | create_document | Create new document |
| PUT | `/api/documents/:id` | edit_document | Update document payload |
| POST | `/api/documents/:id/finalize` | finalize_document | Finalize with blueprint |
| POST | `/api/documents/:id/void` | void_document | Void document |
| GET | `/api/documents/:identifier/preview` | view_document | Get preview render model |
| GET | `/api/documents/:id/export` | export_document | Export document |
| POST | `/api/documents/batch/finalize` | batch_finalize | Batch finalize |
| POST | `/api/documents/batch/export` | batch_export | Batch export |
| GET | `/api/documents/:id/verify` | verify_document | Verify document integrity |
| GET | `/api/reprint-jobs` | view_reprints | List reprint jobs |
| PUT | `/api/reprint-jobs/:id` | edit_reprint | Update reprint job |

## System
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| All | `/api/system/*` | admin_settings | System configuration routes |
| All | `/api/whatsapp` | — | WhatsApp integration routes |
| All | `/api/tasks` | — | Background task management |

## Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Current user info |
| GET | `/api/auth/users` | List users (admin) |

## Error Responses
All endpoints return JSON:
```json
{ "error": "message", "details": [...] }
```
HTTP status codes: 200 (success), 201 (created), 400 (validation), 401 (unauthorized), 403 (forbidden), 404 (not found), 500 (server error).
