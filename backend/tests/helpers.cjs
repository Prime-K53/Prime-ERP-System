const jwt = require('jsonwebtoken');

const TEST_JWT_SECRET = 'test-secret-do-not-use-in-production';
const TEST_COMPANY_ID = 'test-company-001';
const TEST_USER_ID = 'test-user-001';

function createTestToken(overrides = {}) {
  return jwt.sign(
    {
      id: TEST_USER_ID,
      role: 'Admin',
      companyId: TEST_COMPANY_ID,
      ...overrides
    },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function getAuthHeaders(overrides = {}) {
  const token = createTestToken(overrides);
  return {
    'Authorization': `Bearer ${token}`,
    'x-company-id': TEST_COMPANY_ID,
    'Content-Type': 'application/json'
  };
}

function createTestInvoiceData(overrides = {}) {
  return {
    id: generateTestId('inv'),
    customer_name: 'Test Customer',
    total_amount: 1000,
    status: 'Draft',
    ...overrides
  };
}

function createTestAccountData(overrides = {}) {
  return {
    code: '1000',
    name: 'Test Account',
    type: 'asset',
    ...overrides
  };
}

const { generateTestId } = require('./setup.cjs');

module.exports = {
  TEST_JWT_SECRET,
  TEST_COMPANY_ID,
  TEST_USER_ID,
  createTestToken,
  getAuthHeaders,
  createTestInvoiceData,
  createTestAccountData,
  generateTestId
};
