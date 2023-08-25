import React , {useState} from 'react';
import {Link , useMatch} from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/adminDashboard.css';
function TenantDashboard() {

    const [showComponent , setShowComponent] = useState(false);
    const navigate = useNavigate(); //Import useNavigate hook
    const handleLogout = () => {
        //Clear the token from local storage 
        window.localStorage.removeItem('token')
        //Redirect the user to the login page
        navigate('http://localhost:3000') 
    };
    const handleComponentClick = () => {
        setShowComponent(true);
    }
  return (
    <div>
      <header>
        <nav className='navbar navbar-expand-lg navbar-light bg-light'>
            <Link className='navbar-brand' to="/tenant/dashboard">
                Tenant Dashboard
            </Link>
            
            <button 
                className='navbar-toggler'
                type="button"
                data-toggle="collapse"
                data-target="#navbarNav"
                aria-controls="navbarNav"
                aria-expanded="false"
                aria-label="Toggle navigation"
                >
                    <span className='navbar-toggler-icon'></span>
                </button>
                <div className='collapse navbar-collapse' id="navbarNav">
                    <ul className='navbar-nav'>
                        <li className='nav-item'>
                            <Link 
                                className='nav-link'
                                to="/tenant-dashboard/view-page"
                                onClick={handleComponentClick}
                                >
                                    View Information
                                </Link>
                        </li>
                        <li className='nav-item'>
                            <Link className='nav-link'
                                  to="/tenant/view-payments"
                                  onClick={handleComponentClick}
                                  >
                                    View Payments
                                  </Link>
                        </li>
                        <li className='nav-item'>
                            <Link className='nav-link' to="http://localhost:3000" onClick={handleLogout}>
                                Logout
                            </Link>
                        </li>
                </ul>
                </div>
                </nav>
                </header>

                        <div className="container">
                            <h1>Welcome, Tenant!</h1>
                            <p>View your profile and payments by clicking the corresponding links! </p>
                        </div>
      
    </div>
  )
}

export default TenantDashboard

