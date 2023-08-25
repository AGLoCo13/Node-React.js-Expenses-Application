import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {Link} from 'react-router-dom';
function BuildingAdministratorDashboard() {
    const [showComponent , setShowComponent] = useState(false);
    const navigate = useNavigate(); //Import useNavigate hook
    // Function to handle logout
    const handleLogout = () => {
        //Clear the token from local storage (assuming we store it as 'token')
        window.localStorage.removeItem('token')
        //Redirect the user to the login page 
        navigate('http://localhost:3000'); //Adjust the path based on your setup
    };
    const handleComponentClick = () => {
        setShowComponent(true);
    }

  return (
    <div>
        <header>
            <nav className='navbar navbar-expand-lg navbar-light bg-light'>
                <Link className="navbar-brand" to="/building-administrator/dashboard">
                    Building Administrator Dashboard
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
                        <ul className= "navbar-nav">
                            <li className='nav-item'>
                                <Link
                                className="nav-link"
                                to="/building-administrator/view-building"
                                onClick={handleComponentClick}
                                >
                                    View Building
                                </Link>
                            </li>
                            <li className="nav-item">
                                <Link className="nav-link" 
                                      to="/building-administrator/fuel-charge"
                                      onClick={handleComponentClick}
                                      >
                                      Fuel Charge
                                </Link> 
                            </li>
                            <li className='nav-item'>
                                <Link className ="nav-link"
                                      to="/building-administrator/expenses-charge"
                                      onClick={handleComponentClick}
                                      >
                                        Expenses Charge
                                      </Link>
                            </li>
                            <li className='nav-item'>
                                <Link className='nav-link'
                                      to="/building-administrator/view-expenses"
                                      onClick={handleComponentClick}>
                                        View Expenses
                                      </Link>
                            </li>
                            <li className='nav-item'>
                                <Link className='nav-link'
                                      to="/building-administrator/calculate-expenses"
                                      onClick={handleComponentClick}>
                                        Calculate Expenses
                                      </Link>
                                      
                            </li>
                            <li className='nav-item'>
                                <Link className='nav-link'
                                      to="/building-administrator/view-payments"
                                      onClick={handleComponentClick}>
                                        View Payments
                                      </Link>
                            </li>
                            <li className='nav-item'>
                                <Link className="nav-link" to="/" onClick={handleLogout}>
                                    Logout
                                </Link>
                            </li>
                             
                        </ul>
                    
                    </div>
            </nav>
        </header>   
           <div className='container'>
            <h1> Welcome Administrator!</h1>
            <p> Manage your Building's settings here.</p>
            </div>  
    </div>
  )
}

export default BuildingAdministratorDashboard
