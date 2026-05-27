import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaHome, FaBuilding, FaFire, FaFileInvoiceDollar, FaCalculator, FaMoneyBillWave, FaHistory, FaUpload, FaCalendarAlt, FaEuroSign, FaUser, FaCheck } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import { toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';


function ExpensesCharge() {
  const [isExtracting , setIsExtracting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({
    profile: '',
    total: '',
    date_created: '',
    document: '',
    month: '',
    year: '',
    type_expenses: ''
  });
  const [building, setBuilding] = useState(null);
  const [administratorProfile, setAdministrator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const navItems = [
    { label: 'Dashboard', path: '/building-administrator', icon: FaHome },
    { label: 'View Building', path: '/building-administrator/view-building', icon: FaBuilding },
    { label: 'Fuel Charge', path: '/building-administrator/fuel-charge', icon: FaFire },
    { label: 'Expenses Charge', path: '/building-administrator/expenses-charge', icon: FaFileInvoiceDollar },
    { label: 'View Expenses', path: '/building-administrator/view-expenses', icon: FaHistory },
    { label: 'Calculate Expenses', path: '/building-administrator/calculate-expenses', icon: FaCalculator },
    { label: 'View Payments', path: '/building-administrator/view-payments', icon: FaMoneyBillWave }
  ];

  const expenseTypes = ['Heating', 'Elevator', 'General'];
  const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ];

  const currentYear = new Date().getFullYear();
  const futureYears = 10;
  const years = Array.from({ length: futureYears }, (_, i) => currentYear + i);

  useEffect(() => {
    fetchBuildingAdministrator();
  }, []);

  const fetchBuildingAdministrator = async () => {
    try {
      const token = window.localStorage.getItem('token');
      const response = await axios.get('/api/profile', {
        headers: { Authorization: token },
      });

      if (response.data.profileId) {
        const buildingResponse = await axios.get(
          `/api/buildings/${response.data.profileId}`
        );
        const fetchedBuilding = buildingResponse.data;
        setBuilding(fetchedBuilding);
        setAdministrator(fetchedBuilding.profile.user);
      }
      setLoading(false);
    } catch (error) {
      console.error(error);
      toast.error('Error loading administrator profile');
      setLoading(false);
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleFileInputChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);

    if (file) {
      //Επιτρέπουμε και εικονες και pdf
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';

      if (isImage || isPdf) {
        handleReceiptAi(file);
    }
  }
  };

  const handleReceiptAi = async (file) => {
    if (!file) return;
    setIsExtracting(true);
    const aiFormData = new FormData();
    aiFormData.append('receipt', file);

    try {
      toast.info('AI is analyzing the receipt, please wait...');

      const token = window.localStorage.getItem('token');
      const response = await axios.post('/api/expenses/knative-extract', aiFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: token
        }
      });

      const { amount, month, year, type } = response.data;

      // --- ΔΙΟΡΘΩΣΗ: Μετατροπή του string "January" σε value 1 ---
      const matchedMonth = months.find(m => m.label === month);

      setFormData(prevData => ({
        ...prevData,
        total: amount || prevData.total,
        month: matchedMonth ? matchedMonth.value : prevData.month, // Εδώ γίνεται η μαγεία
        year: year || prevData.year,
        type_expenses: type || prevData.type_expenses
      }));
      
      toast.success('AI has extracted data from the receipt!');
    } catch (error) {
      console.error('Error extracting data from receipt:', error);
      toast.error('Failed to extract data from receipt');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const newFormData = { ...formData, profile: administratorProfile._id };
      newFormData.date_created = new Date();

      const formDataToSend = new FormData();
      for (const key in newFormData) {
        formDataToSend.append(key, newFormData[key]);
      }

      if (selectedFile) {
        formDataToSend.append('document', selectedFile);
      }

      const token = window.localStorage.getItem('token');
      const response = await axios.post('/api/expenses', formDataToSend, {
        headers: { Authorization: token },
      });

      if (response.data.receiptInfo && response.data.receiptInfo.uploaded) {
        toast.success('Expense added and receipt uploaded to secure storage!');
      } else {
        toast.success('Expense added successfully!');
      }
      
      // Reset form
      setFormData({
        profile: '',
        total: '',
        date_created: '',
        document: '',
        month: '',
        year: '',
        type_expenses: ''
      });
      setSelectedFile(null);
    } catch (error) {
      console.error('Error passing expense:', error);
      toast.error('Error adding expense');
    } finally {
      setSubmitting(false);
    }
  };

  const getExpenseTypeIcon = (type) => {
    switch (type) {
      case 'Heating':
        return <FaFire style={{ color: '#ef4444' }} />;
      case 'Elevator':
        return <FaMoneyBillWave style={{ color: '#3b82f6' }} />;
      default:
        return <FaFileInvoiceDollar style={{ color: '#10b981' }} />;
    }
  };

  return (
    <DashboardLayout
      navItems={navItems}
      userName="Administrator"
      userRole="Building Administrator"
      dashboardTitle="Expenses Charge"
    >
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FaFileInvoiceDollar style={{ color: '#f59e0b' }} />
          Pass Building Expenses
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          Add new building expenses and upload receipts
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
        </div>
      ) : (
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '0.75rem', 
          padding: '2rem', 
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          maxWidth: '800px'
        }}>
          <form onSubmit={handleSubmit}>
            <div className="row">
              {/* Administrator Info */}
              <div className="col-12 form-group">
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FaUser style={{ color: '#2563eb' }} />
                  Administrator:
                </label>
                <div style={{ 
                  padding: '0.875rem', 
                  backgroundColor: '#f8fafc', 
                  borderRadius: '0.5rem',
                  border: '1px solid #e2e8f0',
                  fontWeight: '500'
                }}>
                  {administratorProfile ? administratorProfile.name : 'Loading...'}
                </div>
              </div>

              {/* Expense Type */}
              <div className="col-md-6 form-group">
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FaFileInvoiceDollar style={{ color: '#f59e0b' }} />
                  Expense Type:
                </label>
                <div style={{ position: 'relative' }}>
                  {formData.type_expenses && (
                    <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                      {getExpenseTypeIcon(formData.type_expenses)}
                    </div>
                  )}
                  <select
                    id="type_expenses"
                    name="type_expenses"
                    className="form-control"
                    value={formData.type_expenses}
                    onChange={handleInputChange}
                    required
                    style={{ paddingLeft: formData.type_expenses ? '2.5rem' : '0.75rem' }}
                  >
                    <option value="">Select Expense Type</option>
                    {expenseTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Total Amount */}
              <div className="col-md-6 form-group">
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FaEuroSign style={{ color: '#10b981' }} />
                  Total Amount:
                </label>
                <input
                  type="number"
                  step="0.01"
                  id="total"
                  name="total"
                  className="form-control"
                  placeholder="0.00"
                  value={formData.total}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* Month */}
              <div className="col-md-6 form-group">
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FaCalendarAlt style={{ color: '#8b5cf6' }} />
                  Month:
                </label>
                <select
                  id="month"
                  name="month"
                  className="form-control"
                  value={formData.month}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a month</option>
                  {months.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div className="col-md-6 form-group">
                <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FaCalendarAlt style={{ color: '#8b5cf6' }} />
                  Year:
                </label>
                <select
                  id="year"
                  name="year"
                  className="form-control"
                  value={formData.year}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a year</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

               {/* Receipt Upload */}
                <div className="col-12 form-group">
                  <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaUpload style={{ color: '#3b82f6' }} />
                    Receipt (Optional):
                  </label>
                  <div style={{ 
                    border: isExtracting ? '2px solid #3b82f6' : '2px dashed #e2e8f0', // Γίνεται μπλε όταν δουλεύει το AI
                    borderRadius: '0.5rem', 
                    padding: '1.5rem',
                    textAlign: 'center',
                    backgroundColor: isExtracting ? '#eff6ff' : '#f8fafc',
                    transition: 'all 0.3s ease',
                    position: 'relative'
                  }}>
                    {/* Spinner που εμφανίζεται πάνω δεξιά στο upload box */}
                    {isExtracting && (
                      <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                        <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                      </div>
                    )}
                    
                    <input
                      type="file"
                      id="document"
                      name="document"
                      accept="image/*, .pdf"
                      onChange={handleFileInputChange}
                      style={{ display: 'none' }}
                      disabled={isExtracting} // Απενεργοποίηση κατά το extraction
                    />
                    <label 
                      htmlFor="document" 
                      style={{ 
                        cursor: isExtracting ? 'wait' : 'pointer', 
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <FaUpload style={{ fontSize: '2rem', color: isExtracting ? '#3b82f6' : '#94a3b8' }} />
                      <span style={{ color: isExtracting ? '#3b82f6' : '#64748b', fontWeight: '500' }}>
                        {isExtracting ? 'AI is analyzing...' : (selectedFile ? selectedFile.name : 'Click to upload receipt')}
                      </span>
                      <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                        PDF, PNG, JPG (Max 10MB)
                      </span>
                    </label>
                  </div>
                </div>
                </div>
            {/* Submit Button */}
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  minWidth: '150px',
                  justifyContent: 'center'
                }}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Submitting...
                  </>
                ) : (
                  <>
                    <FaCheck /> Pass Expense
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
export default ExpensesCharge;
