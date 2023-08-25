import React, { useState, useEffect } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';

function ViewBuilding() {
  const [building, setBuilding] = useState(null);
  const [apartments, setApartments] = useState([]);

  useEffect(() => {
    const fetchBuildingAndApartments = async () => {
      try {
        const token = window.localStorage.getItem('token');
        const response = await axios.get('http://localhost:5000/api/profile', {
          headers: { Authorization: token },
        });

        // Check if the user's profile has a profileId
        if (response.data.profileId) {
          //if true give me the building that he's admin to
          const buildingResponse = await axios.get(
            `http://localhost:5000/api/buildings/${response.data.profileId}`
          );
          const fetchedBuilding = buildingResponse.data;
          setBuilding(fetchedBuilding);

          // Fetch apartments tied to the building
          const apartmentsResponse = await axios.get(
            `http://localhost:5000/aps/Apartments/${fetchedBuilding._id}`
          );
          // Extract the "apartments" field
          setApartments(apartmentsResponse.data);
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchBuildingAndApartments();
  }, []);

  //Log the length of the apartments array just before rendering 
  console.log('Apartments Array Length:' , apartments.length);

  return (
    <div className="container my-4">
      <div className='row'>
        <div className='col-lg-6'>
          {building ? (
          <div className="card mb-4">
          <div className='card-header'>
          <h2>Your Building</h2>
          </div>
          <div className="card-body">
            <p className="card-text">
              <span className="detail-label">Building Address:</span> {building.address}
            </p>
            <p className="card-text">
              <span className="detail-label">Floors:</span> {building.floors}
            </p>
            <p className="card-text">
              <span className="detail-label">Apartments:</span> {building.apartments}
            </p>
            <p className="card-text">
              <span className="detail-label">Reserve:</span> {building.reserve}
            </p>
          </div>
        </div>
      ) : (
        <p className="no-building">No building Assigned...</p>
      )}
      </div>
      <div className='col-lg-6'>
      {apartments.length > 0 ? (
        <div className="card">
          <div className='card-header'>
          <h2>Apartments in the Building</h2>
          </div>
          <div className="card-body">
          <ul className="list-group list-group-flush">
            {apartments.map((apartment) => (
              <li key={apartment._id} className="list-group-item">
                <p className='card-text'>
                <strong>Name:</strong> {apartment.name} 
                </p>
                <p className='card-text'>
                  <strong>Floor:</strong> {apartment.floor}
                </p>
                <p className='card-text'>
                  <strong>Square Meters:</strong> {apartment.square_meters}
                </p>
              </li>
            ))}
          </ul>
        </div>
        </div>
      ) : (
        <p className="no-apartments">No apartments tied to this building...</p>
      )}
    </div>
    </div>
    </div>
  );
}

export default ViewBuilding;