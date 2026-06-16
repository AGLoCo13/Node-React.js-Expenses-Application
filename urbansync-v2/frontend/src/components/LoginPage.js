import React, { useState } from 'react';
import axios from 'axios';
import { FaEnvelope, FaLock, FaBuilding, FaArrowRight, FaEye, FaEyeSlash } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../css/loginPage.css';
import jwtDecode from 'jwt-decode';
import buildingImg from '../assets/buildingImage.png';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post('/api/login', { email, password });
      const { token } = response.data;

      // Decode the token to get the payload
      const decodedToken = jwtDecode(token);
      const userRole = decodedToken.role;

      // Store the token in local storage
      window.localStorage.setItem('token', token);

      // Show success message
      toast.success('Login successful! Redirecting...', {
        position: 'top-right',
        autoClose: 1500,
      });

      // Redirect based on the user's role after a short delay
      setTimeout(() => {
        if (userRole === 'Site-admin') {
          window.location.href = '/admin-dashboard';
        } else if (userRole === 'Administrator') {
          window.location.href = '/building-administrator';
        } else if (userRole === 'Tenant') {
          window.location.href = '/tenant-dashboard';
        }
      }, 1500);
    } catch (error) {
      setLoading(false);
      if (error.response && error.response.status === 401) {
        toast.error('Invalid email or password', {
          position: 'top-right',
          autoClose: 3000,
        });
      } else {
        toast.error('An error occurred. Please try again later', {
          position: 'top-right',
          autoClose: 3000,
        });
      }
      console.error(error);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left Side - Image & Branding */}
        <div className="login-left">
          <div className="login-overlay">
            <div className="login-branding">
              <div className="brand-icon">
                <FaBuilding />
              </div>
              <h1 className="brand-title">UrbanSync</h1>
              <p className="brand-subtitle">Your Building, Simplified</p>
            </div>
            <div className="features-list">
              <div className="feature-item">
                <div className="feature-icon">✓</div>
                <span>Manage Properties</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">✓</div>
                <span>Track Expenses</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">✓</div>
                <span>Monitor Payments</span>
              </div>
            </div>
          </div>
          <img src={buildingImg} alt="Building" className="login-bg-image" />
        </div>

        {/* Right Side - Login Form */}
        <div className="login-right">
          <div className="login-form-container">
            <div className="login-header">
              <h2 className="login-title">Welcome Back</h2>
              <p className="login-description">
                Please login with your credentials to continue
              </p>
              <span style={{ fontSize: '20px', color: '#fa0000' }}>v9 — CI/CD pipeline active with ArgoCD!</span>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group-modern">
                <label htmlFor="email" className="form-label-modern">
                  Email Address
                </label>
                <div className="input-wrapper">
                  <FaEnvelope className="input-icon" />
                  <input
                    type="email"
                    id="email"
                    className="form-input-modern"
                    placeholder="Enter your email"
                    value={email}
                    onChange={handleEmailChange}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group-modern">
                <label htmlFor="password" className="form-label-modern">
                  Password
                </label>
                <div className="input-wrapper">
                  <FaLock className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    className="form-input-modern"
                    placeholder="Enter your password"
                    value={password}
                    onChange={handlePasswordChange}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={togglePasswordVisibility}
                    disabled={loading}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={`btn-login-modern ${loading ? 'loading' : ''}`}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <FaArrowRight className="btn-icon" />
                  </>
                )}
              </button>
            </form>

            <div className="login-footer">
              <p className="footer-text">
                Need access? Contact your site administrator
              </p>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}

export default LoginPage;
