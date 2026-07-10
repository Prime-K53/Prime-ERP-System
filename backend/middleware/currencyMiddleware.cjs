/**
 * Currency Middleware
 * Injects company's default currency into requests
 */

class CurrencyMiddleware {
  constructor(currencyService) {
    this.currencyService = currencyService;
  }

  /**
   * Middleware to inject company currency into req object
   */
  injectCurrency() {
    return async (req, res, next) => {
      try {
        const companyId = req.companyId || '';
        if (companyId) {
          const companyCurrency = await this.currencyService.getCompanyCurrency(companyId);
          req.companyCurrency = companyCurrency;
        } else {
          req.companyCurrency = 'USD';
        }
        next();
      } catch (err) {
        console.error('[CurrencyMiddleware] Error injecting currency:', err);
        req.companyCurrency = 'USD'; // Fallback to USD
        next();
      }
    };
  }

  /**
   * Middleware to convert amounts to company currency
   */
  convertToCompanyCurrency() {
    return async (req, res, next) => {
      try {
        const companyId = req.companyId || '';
        const companyCurrency = await this.currencyService.getCompanyCurrency(companyId);
        
        // Convert request body amounts if present
        if (req.body && typeof req.body === 'object') {
          req.body = await this.convertObject(req.body, companyCurrency);
        }
        
        req.companyCurrency = companyCurrency;
        next();
      } catch (err) {
        console.error('[CurrencyMiddleware] Error converting currency:', err);
        next();
      }
    };
  }

  /**
   * Recursively convert currency fields in an object
   */
  async convertObject(obj, targetCurrency) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return await Promise.all(obj.map(item => this.convertObject(item, targetCurrency)));
    }

    const converted = { ...obj };
    const currencyFields = ['amount', 'total_amount', 'subtotal', 'opening_balance', 'current_balance', 'balance'];
    const currencyCodeField = 'currency';

    for (const [key, value] of Object.entries(converted)) {
      if (currencyFields.includes(key) && value && typeof value === 'number') {
        const sourceCurrency = converted[currencyCodeField] || 'USD';
        if (sourceCurrency !== targetCurrency) {
          converted[key] = await this.currencyService.convert(value, sourceCurrency, targetCurrency);
        }
      } else if (value && typeof value === 'object') {
        converted[key] = await this.convertObject(value, targetCurrency);
      }
    }

    return converted;
  }
}

module.exports = CurrencyMiddleware;