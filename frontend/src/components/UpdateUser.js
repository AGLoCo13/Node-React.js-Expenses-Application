import React, { useState } from 'react';
import axios from 'axios';
import { FaUser, FaEnvelope, FaMapMarkerAlt, FaPhone, FaSave } from 'react-icons/fa';
import { toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';

const UpdateUser = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    address: '',
    cellphone: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const config = {
        headers: {
          Authorization: token,
        },
      };

      const response = await axios.put('/api/profile', formData, config);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Error updating profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ 
      backgroundColor: 'white', 
      borderRadius: '0.75rem', 
      padding: '2rem', 
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      maxWidth: '800px'
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <FaUser style={{ color: '#2563eb' }} />
        Update Profile
      </h2>

      <form onSubmit={handleUpdate}>
        <div className="row">
          {/* Name */}
          <div className="col-md-6 form-group">
            <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FaUser style={{ color: '#2563eb' }} />
              Name:
            </label>
            <input
              type="text"
              name="name"
              className="form-control"
              placeholder="Enter your name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          {/* Email */}
          <div className="col-md-6 form-group">
            <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FaEnvelope style={{ color: '#10b981' }} />
              Email:
            </label>
            <input
              type="email"
              name="email"
              className="form-control"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          {/* Address */}
          <div className="col-md-6 form-group">
            <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FaMapMarkerAlt style={{ color: '#f59e0b' }} />
              Address:
            </label>
            <input
              type="text"
              name="address"
              className="form-control"
              placeholder="Enter your address"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>

          {/* Cellphone */}
          <div className="col-md-6 form-group">
            <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FaPhone style={{ color: '#3b82f6' }} />
              Cellphone:
            </label>
            <input
              type="tel"
              name="cellphone"
              className="form-control"
              placeholder="Enter your phone number"
              value={formData.cellphone}
              onChange={handleChange}
              required
            />
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
                Updating...
              </>
            ) : (
              <>
                <FaSave /> Update Profile
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UpdateUser;
