const BaseAIService = require('./baseService.cjs');
const LLMClient = require('./llmClient.cjs');

class ConversationalAnalyzer extends BaseAIService {
  constructor() {
    super();
    this.llm = new LLMClient();
  }

  async query(companyId, question, options = {}) {
    const context = await this._buildContext(companyId, question);

    const systemPrompt = `You are Prime ERP's AI business analyst. You have access to business data context.
Answer questions concisely with specific numbers. When appropriate, include JSON data that can be used for charts.
Available data: sales, inventory, production, finances, customers, suppliers, purchase orders, employees.
Respond in markdown. If the user asks for a chart or visualization, include a JSON codeblock with chart data.`;

    let answer;
    if (options.useLLM !== false && process.env.AI_API_KEY) {
      answer = await this.llm.generate(systemPrompt, `Context:\n${context}\n\nQuestion: ${question}`);
    } else {
      answer = this._ruleBasedAnswer(question, context);
    }

    return {
      question,
      answer,
      context,
      timestamp: new Date().toISOString()
    };
  }

  async _buildContext(companyId, question) {
    const q = question.toLowerCase();
    const parts = [];

    if (this._mentions(q, ['sale', 'revenue', 'income', 'order', 'customer', 'client'])) {
      const salesData = await this._all(
        `SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total FROM sales WHERE company_id = ?`,
        [companyId]
      );
      const topCustomers = await this._all(
        `SELECT customer_name, COUNT(*) as orders, COALESCE(SUM(total_amount),0) as total
         FROM sales WHERE company_id = ? AND customer_name IS NOT NULL
         GROUP BY customer_name ORDER BY total DESC LIMIT 10`,
        [companyId]
      );
      parts.push(`Sales: ${salesData[0].count} transactions totaling ${Math.round(salesData[0].total)}`);
      if (topCustomers.length > 0) {
        parts.push(`Top Customers: ${topCustomers.map(c => `${c.customer_name} (${c.orders} orders, ${Math.round(c.total)})`).join(', ')}`);
      }
    }

    if (this._mentions(q, ['inventory', 'stock', 'item', 'material', 'warehouse'])) {
      const invData = await this._all(
        `SELECT COUNT(*) as count, COALESCE(SUM(quantity),0) as total_qty,
                COALESCE(SUM(quantity * cost_per_unit),0) as total_value
         FROM inventory WHERE company_id = ?`,
        [companyId]
      );
      const lowStock = await this._all(
        `SELECT material, quantity, reorder_point FROM inventory
         WHERE company_id = ? AND reorder_point > 0 AND quantity <= reorder_point
         ORDER BY quantity ASC LIMIT 10`,
        [companyId]
      );
      parts.push(`Inventory: ${invData[0].count} items, ${Math.round(invData[0].total_qty)} units, value ${Math.round(invData[0].total_value)}`);
      if (lowStock.length > 0) {
        parts.push(`Low Stock Items: ${lowStock.map(i => `${i.material} (${i.quantity}/${i.reorder_point})`).join(', ')}`);
      }
    }

    if (this._mentions(q, ['finance', 'account', 'ledger', 'expense', 'budget', 'profit', 'cash'])) {
      const accounts = await this._all(
        `SELECT type, COUNT(*) as count, COALESCE(SUM(CASE WHEN type='revenue' OR type='income' THEN 1 ELSE 0 END),0) as revenue_count
         FROM chart_of_accounts WHERE company_id = ? GROUP BY type`,
        [companyId]
      );
      const expenses = await this._all(
        `SELECT COALESCE(SUM(amount),0) as total FROM expenses
         WHERE company_id = ? AND status='paid' AND expense_date >= datetime('now', '-30 days')`,
        [companyId]
      );
      const income = await this._all(
        `SELECT COALESCE(SUM(amount),0) as total FROM income
         WHERE company_id = ? AND income_date >= datetime('now', '-30 days')`,
        [companyId]
      );
      parts.push(`Accounts: ${accounts.map(a => `${a.type} (${a.count})`).join(', ')}`);
      parts.push(`Last 30 days: Expenses ${Math.round(expenses[0].total)}, Income ${Math.round(income[0].total)}`);
    }

    if (this._mentions(q, ['production', 'work order', 'batch', 'manufacturing', 'bom'])) {
      const prodData = await this._all(
        `SELECT status, COUNT(*) as count FROM work_orders WHERE company_id = ? GROUP BY status`,
        [companyId]
      );
      parts.push(`Work Orders: ${prodData.map(d => `${d.status} (${d.count})`).join(', ')}`);
    }

    if (this._mentions(q, ['employee', 'staff', 'personnel', 'payroll', 'hr'])) {
      const empData = await this._all(
        `SELECT COUNT(*) as count, COALESCE(SUM(salary),0) as total_salary
         FROM employees WHERE company_id = ? AND status = 'active'`,
        [companyId]
      );
      parts.push(`Employees: ${empData[0].count} active, total salary ${Math.round(empData[0].total_salary)}`);
    }

    return parts.join('\n') || 'No specific data found for this query. Available data includes sales, inventory, finance, production, and HR information.';
  }

  _mentions(q, keywords) {
    return keywords.some(k => q.includes(k));
  }

  _ruleBasedAnswer(question, context) {
    const q = question.toLowerCase();

    if (q.includes('top customer') || (q.includes('customer') && q.includes('most'))) {
      const match = context.match(/Top Customers: (.+)/);
      if (match) return `**Top Customers:**\n\n${match[1].split(', ').map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
    }
    if (q.includes('low stock') || q.includes('reorder') || q.includes('restock')) {
      const match = context.match(/Low Stock Items: (.+)/);
      if (match) return `**Low Stock Alerts:**\n\n${match[1].split(', ').map(i => `- ${i}`).join('\n')}\n\nConsider reviewing these items and placing reorders.`;
    }
    if (q.includes('revenue') || q.includes('sale') || q.includes('income')) {
      const saleMatch = context.match(/Sales: (.+)/);
      const incomeMatch = context.match(/Income (.+)/);
      if (saleMatch) return `**Sales Overview:**\n\n${saleMatch[1]}`;
      if (incomeMatch) return `**Income:** ${incomeMatch[1]}`;
    }
    if (q.includes('expense') || q.includes('spend')) {
      const match = context.match(/Expenses (.+)/);
      if (match) return `**Expenses (Last 30 days):** ${match[1]}`;
    }
    if (q.includes('profit') || q.includes('margin')) {
      const income = context.match(/Income (.+)/);
      const expense = context.match(/Expenses (.+)/);
      if (income && expense) {
        return `**Profit Summary (Last 30 days):**\n- Income: ${income[1]}\n- Expenses: ${expense[1]}`;
      }
    }

    return `**Analysis based on available data:**\n\n${context}\n\nFor more detailed analysis, please ask a more specific question or configure an AI provider in settings.`;
  }
}

module.exports = ConversationalAnalyzer;
