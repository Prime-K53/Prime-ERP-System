const sqlite3 = require('sqlite3');
const { initDb } = require('../db.cjs');

function createTestDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(':memory:', (err) => {
      if (err) return reject(err);
      resolve(db);
    });
  });
}

function createTestApp(db) {
  const express = require('express');
  const app = express();
  app.use(express.json());

  const FinanceService = require('../services/financeService.cjs');
  const ProcurementService = require('../services/procurementService.cjs');
  const ProductionService = require('../services/productionService.cjs');
  const HRService = require('../services/hrService.cjs');

  const services = {
    finance: new FinanceService(db),
    procurement: new ProcurementService(db),
    production: new ProductionService(db),
    hr: new HRService(db)
  };

  return { app, services, db };
}

function generateTestId(prefix = 'test') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = { createTestDb, createTestApp, generateTestId };
