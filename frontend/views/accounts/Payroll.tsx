import React, { useState } from 'react';
import { Briefcase, DollarSign, Clock, UserPlus, Trash2, Edit2, FileText, Save, X, Eye, Calculator, AlertTriangle } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { Employee, PayrollRun, Payslip } from '../../types';

interface DeductionBreakdown {
  tax: number;
  socialSecurity: number;
  pension: number;
  healthInsurance: number;
  loanRepayment: number;
  other: number;
}

const Payroll: React.FC = () => {
  const { employees, payrollRuns, payslips, addEmployee, updateEmployee, deleteEmployee, runPayroll } = useFinance();
  const { companyConfig, notify } = useAuth();
  const currency = companyConfig?.currencySymbol || '$';

  const [activeTab, setActiveTab] = useState<'Run' | 'Employees' | 'History'>('Run');

  // Employee Modal
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editEmp, setEditEmp] = useState<Partial<Employee>>({ basicSalary: 0, status: 'Active' });

  // Payslip List Modal
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const runPayslips = selectedRun ? payslips.filter(p => p.payrollRunId === selectedRun.id) : [];

  // Payslip Detail Modal
  const [showPayslipDetail, setShowPayslipDetail] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  // Run Payroll State
  const [runMonth, setRunMonth] = useState(new Date().toISOString().slice(0, 7));
  const [runDate, setRunDate] = useState(new Date().toISOString().split('T')[0]);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Per-employee deduction overrides
  const [deductionOverrides, setDeductionOverrides] = useState<Record<string, Partial<DeductionBreakdown>>>({});

  const activeEmployees = employees.filter(e => e.status === 'Active');

  const defaultDeductionRate = (rate: number) => rate;

  const calculateEmployeeDeductions = (emp: Employee, overrides?: Partial<DeductionBreakdown>): DeductionBreakdown => {
    const salary = emp.basicSalary || 0;
    const over = overrides || {};
    return {
      tax: over.tax ?? Math.round(salary * 0.1),
      socialSecurity: over.socialSecurity ?? Math.round(salary * 0.05),
      pension: over.pension ?? Math.round(salary * 0.05),
      healthInsurance: over.healthInsurance ?? Math.round(salary * 0.03),
      loanRepayment: over.loanRepayment ?? 0,
      other: over.other ?? 0,
    };
  };

  const totalDeductions = (d: DeductionBreakdown) => d.tax + d.socialSecurity + d.pension + d.healthInsurance + d.loanRepayment + d.other;

  const calculateNetPay = (emp: Employee, overrides?: Partial<DeductionBreakdown>) => {
    const salary = emp.basicSalary || 0;
    const deductions = calculateEmployeeDeductions(emp, overrides);
    return Math.max(0, salary - totalDeductions(deductions));
  };

  const estTotalPayroll = activeEmployees.reduce((sum, e) => sum + e.basicSalary, 0);
  const estTotalDeductions = activeEmployees.reduce((sum, e) => sum + totalDeductions(calculateEmployeeDeductions(e, deductionOverrides[e.id])), 0);
  const estNetPay = estTotalPayroll - estTotalDeductions;

  const handleSaveEmployee = (e: React.FormEvent) => {
      e.preventDefault();
      if (!editEmp.name) return;

      const empData = {
          ...editEmp,
          id: editEmp.id || '',
          joinDate: editEmp.joinDate || new Date().toISOString().split('T')[0],
          basicSalary: Number(editEmp.basicSalary) || 0
      } as Employee;

      if (empData.basicSalary <= 0) {
          notify?.('Salary must be greater than zero.', 'error');
          return;
      }

      if (empData.id) updateEmployee(empData);
      else addEmployee(empData);

      setShowEmpModal(false);
  };

  const handleRunPayroll = () => {
      if (activeEmployees.length === 0) {
          notify?.("No active employees to pay.", 'error');
          return;
      }
      const normalizedMonth = runMonth.replace(/^(\d{4})-0?(\d{1,2})$/, '$1-$2');
      if (payrollRuns.some(r => r.month.replace(/^(\d{4})-0?(\d{1,2})$/, '$1-$2') === normalizedMonth)) {
          notify?.("Payroll already run for this month.", 'error');
          return;
      }

      setConfirmDialog({
          message: `Confirm Payroll Run for ${runMonth}?\nTotal Basic: ${currency}${estTotalPayroll.toLocaleString()}\nTotal Deductions: ${currency}${estTotalDeductions.toLocaleString()}\nNet Pay: ${currency}${estNetPay.toLocaleString()}`,
          onConfirm: () => {
              runPayroll(runMonth, runDate, activeEmployees);
              setActiveTab('History');
              setConfirmDialog(null);
          }
      });
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-[calc(100vh-4rem)] flex flex-col">

        {/* Employee Modal */}
        {showEmpModal && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-900">{editEmp.id ? 'Edit Employee' : 'New Employee'}</h2>
                        <button onClick={() => setShowEmpModal(false)}><X size={20}/></button>
                    </div>
                    <form onSubmit={handleSaveEmployee} className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                            <input className="w-full p-2 border rounded-lg" value={editEmp.name || ''} onChange={e => setEditEmp({...editEmp, name: e.target.value})} required/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role / Title</label>
                                <input className="w-full p-2 border rounded-lg" value={editEmp.role || ''} onChange={e => setEditEmp({...editEmp, role: e.target.value})} required/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Join Date</label>
                                <input type="date" className="w-full p-2 border rounded-lg" value={editEmp.joinDate || ''} onChange={e => setEditEmp({...editEmp, joinDate: e.target.value})}/>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Basic Salary ({currency})</label>
                                <input type="number" min="1" className="w-full p-2 border rounded-lg font-bold" value={editEmp.basicSalary} onChange={e => setEditEmp({...editEmp, basicSalary: parseFloat(e.target.value)})}/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                                <select className="w-full p-2 border rounded-lg bg-white" value={editEmp.status} onChange={e => setEditEmp({...editEmp, status: e.target.value})}>
                                    <option>Active</option>
                                    <option>Leave</option>
                                    <option>Terminated</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bank Details (Optional)</label>
                            <input className="w-full p-2 border rounded-lg mb-2" placeholder="Bank Name" value={editEmp.bankDetails?.bankName || ''} onChange={e => setEditEmp({...editEmp, bankDetails: { ...editEmp.bankDetails!, bankName: e.target.value }})}/>
                            <input className="w-full p-2 border rounded-lg" placeholder="Account Number" value={editEmp.bankDetails?.accountNumber || ''} onChange={e => setEditEmp({...editEmp, bankDetails: { ...editEmp.bankDetails!, accountNumber: e.target.value }})}/>
                        </div>
                        <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 mt-2 flex items-center justify-center gap-2">
                            <Save size={18}/> Save Record
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* Payslip List Modal */}
        {showPayslipModal && selectedRun && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-fadeIn">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Payslips for {selectedRun.month}</h2>
                            <p className="text-xs text-slate-500">Run ID: {selectedRun.id} | Net: {currency}{selectedRun.totalNetPay?.toLocaleString()}</p>
                        </div>
                        <button onClick={() => setShowPayslipModal(false)}><X size={20}/></button>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white text-slate-500 border-b border-slate-100 sticky top-0 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="p-4">Employee</th>
                                    <th className="p-4 text-right">Basic</th>
                                    <th className="p-4 text-right">Deductions</th>
                                    <th className="p-4 text-right">Net Pay</th>
                                    <th className="p-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {runPayslips.map(ps => (
                                    <tr key={ps.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-medium text-slate-900">{ps.employeeName}</td>
                                        <td className="p-4 text-right text-slate-600">{currency}{ps.basicSalary?.toLocaleString()}</td>
                                        <td className="p-4 text-right text-red-600">-{currency}{(ps.deductions || 0).toLocaleString()}</td>
                                        <td className="p-4 text-right font-bold text-emerald-600">{currency}{ps.netPay?.toLocaleString()}</td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => { setSelectedPayslip(ps); setShowPayslipDetail(true); }}
                                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                                                title="View Payslip Details"
                                            >
                                                <Eye size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <button onClick={() => setShowPayslipModal(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-300 text-sm">Close</button>
                    </div>
                </div>
            </div>
        )}

        {/* Payslip Detail Modal */}
        {showPayslipDetail && selectedPayslip && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-900">Payslip Details</h2>
                        <button onClick={() => setShowPayslipDetail(false)}><X size={20}/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <p className="text-sm text-slate-500">Employee</p>
                            <p className="font-bold text-slate-900">{selectedPayslip.employeeName}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Period</p>
                            <p className="font-medium">{selectedPayslip.date}</p>
                        </div>
                        <div className="border-t border-slate-200 pt-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Basic Salary</span>
                                <span className="font-medium">{currency}{selectedPayslip.basicSalary?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Allowances</span>
                                <span className="font-medium text-emerald-600">+{currency}{(selectedPayslip.allowances || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Deductions</span>
                                <span className="font-medium text-red-600">-{currency}{(selectedPayslip.deductions || 0).toLocaleString()}</span>
                            </div>
                            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-base">
                                <span>Net Pay</span>
                                <span className="text-emerald-600">{currency}{selectedPayslip.netPay?.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="text-xs text-slate-400">
                            Status: <span className="font-medium text-emerald-600">{selectedPayslip.status}</span>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="flex justify-between items-center mb-6 shrink-0">
            <div>
                <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Briefcase className="text-blue-600" size={20}/> Payroll Management</h1>
                <p className="text-xs text-slate-500 mt-0.5">Employee salaries, deductions, and payslips.</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
                {['Run', 'Employees', 'History'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTab === tab ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {tab === 'Run' ? 'Process Payroll' : tab}
                    </button>
                ))}
            </div>
        </div>

        {activeTab === 'Run' && (
            <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
                <div className="md:w-1/3 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm"><Clock size={16}/> Run Configuration</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Month</label>
                            <input type="month" className="w-full p-2 border rounded-lg text-sm" value={runMonth} onChange={e => setRunMonth(e.target.value)}/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Payment Date</label>
                            <input type="date" className="w-full p-2 border rounded-lg text-sm" value={runDate} onChange={e => setRunDate(e.target.value)}/>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Active Employees</span>
                                <span className="font-bold">{activeEmployees.length}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Basic Total</span>
                                <span className="font-bold">{currency}{estTotalPayroll.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Est. Deductions</span>
                                <span className="font-bold text-red-600">-{currency}{estTotalDeductions.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t border-blue-200 pt-2">
                                <span className="font-bold">Est. Net Pay</span>
                                <span className="font-bold text-emerald-600">{currency}{estNetPay.toLocaleString()}</span>
                            </div>
                        </div>
                        <button onClick={handleRunPayroll} className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 text-sm">
                            <DollarSign size={16}/> Process Payroll
                        </button>
                    </div>
                </div>

                <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-bold text-slate-700 text-sm"><Calculator size={14} className="inline mr-1"/> Eligible Employees</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white text-slate-500 border-b border-slate-100 sticky top-0 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="p-4">Name</th>
                                    <th className="p-4">Role</th>
                                    <th className="p-4 text-right">Basic</th>
                                    <th className="p-4 text-right">Deductions</th>
                                    <th className="p-4 text-right">Net</th>
                                    <th className="p-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {activeEmployees.map(emp => {
                                    const ded = calculateEmployeeDeductions(emp, deductionOverrides[emp.id]);
                                    const net = calculateNetPay(emp, deductionOverrides[emp.id]);
                                    return (
                                        <tr key={emp.id}>
                                            <td className="p-4 font-medium text-slate-900">{emp.name}</td>
                                            <td className="p-4 text-slate-500">{emp.role}</td>
                                            <td className="p-4 text-right font-mono">{currency}{emp.basicSalary?.toLocaleString()}</td>
                                            <td className="p-4 text-right text-red-600 font-mono">-{currency}{totalDeductions(ded).toLocaleString()}</td>
                                            <td className="p-4 text-right font-bold text-emerald-600 font-mono">{currency}{net.toLocaleString()}</td>
                                            <td className="p-4 text-center"><span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Ready</span></td>
                                        </tr>
                                    );
                                })}
                                {activeEmployees.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No active employees found.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'Employees' && (
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-700 text-sm">Staff Directory</h3>
                    <button onClick={() => { setEditEmp({basicSalary: 0, status: 'Active'}); setShowEmpModal(true); }} className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center gap-2 shadow-sm">
                        <UserPlus size={14}/> Add Employee
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white text-slate-500 border-b border-slate-100 sticky top-0 text-xs font-bold uppercase tracking-wider">
                            <tr>
                                <th className="p-4">Name</th>
                                <th className="p-4">Role</th>
                                <th className="p-4">Join Date</th>
                                <th className="p-4 text-right">Salary</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {employees.map(emp => (
                                <tr key={emp.id} className="hover:bg-slate-50">
                                    <td className="p-4 font-medium text-slate-900">{emp.name}</td>
                                    <td className="p-4 text-slate-500">{emp.role}</td>
                                    <td className="p-4 text-slate-500">{new Date(emp.joinDate).toLocaleDateString()}</td>
                                    <td className="p-4 text-right font-mono">{currency}{emp.basicSalary?.toLocaleString()}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${emp.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{emp.status}</span>
                                    </td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        <button onClick={() => { setEditEmp(emp); setShowEmpModal(true); }} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit2 size={16}/></button>
                                        <button onClick={() => deleteEmployee(emp.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'History' && (
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-slate-700 text-sm">Payroll Runs</h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white text-slate-500 border-b border-slate-100 sticky top-0 text-xs font-bold uppercase tracking-wider">
                            <tr>
                                <th className="p-4">Month</th>
                                <th className="p-4">Date</th>
                                <th className="p-4 text-center">Employees</th>
                                <th className="p-4 text-right">Basic</th>
                                <th className="p-4 text-right">Deductions</th>
                                <th className="p-4 text-right">Net Pay</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {payrollRuns.slice().reverse().map(run => (
                                <tr key={run.id} className="hover:bg-slate-50">
                                    <td className="p-4 font-bold text-slate-900">{run.month}</td>
                                    <td className="p-4 text-slate-500">{new Date(run.date).toLocaleDateString()}</td>
                                    <td className="p-4 text-center">{run.employeeCount}</td>
                                    <td className="p-4 text-right text-slate-600">{currency}{run.totalBasic?.toLocaleString()}</td>
                                    <td className="p-4 text-right text-red-600">-{currency}{(run.totalDeductions || 0).toLocaleString()}</td>
                                    <td className="p-4 text-right font-bold text-emerald-600">{currency}{run.totalNetPay?.toLocaleString()}</td>
                                    <td className="p-4 text-center"><span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Paid</span></td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => { setSelectedRun(run); setShowPayslipModal(true); }}
                                            className="text-blue-600 hover:underline flex items-center gap-1 justify-end text-xs font-bold"
                                        >
                                            <FileText size={14}/> Payslips
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {payrollRuns.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-400">No payroll history available.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* Confirm Dialog */}
        {confirmDialog && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
                    <div className="p-6 text-center space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 flex items-center justify-center border border-amber-200">
                            <AlertTriangle size={32} className="text-amber-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Confirm Payroll Run</h3>
                        <p className="text-sm text-slate-600 whitespace-pre-line">{confirmDialog.message}</p>
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                        <button
                            onClick={() => setConfirmDialog(null)}
                            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-50 text-sm transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDialog.onConfirm}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 text-sm transition-colors"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Payroll;
