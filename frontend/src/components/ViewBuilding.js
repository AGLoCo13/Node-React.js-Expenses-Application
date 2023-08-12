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
      {building ? (
        <div className="building-section">
          <h2>Your Building</h2>
          <div className="building-details">
            <p className="building-detail">
              <span className="detail-label">Building Address:</span> {building.address}
            </p>
            <p className="building-detail">
              <span className="detail-label">Floors:</span> {building.floors}
            </p>
            <p className="building-detail">
              <span className="detail-label">Apartments:</span> {building.apartments}
            </p>
            <p className="building-detail">
              <span className="detail-label">Reserve:</span> {building.reserve}
            </p>
          </div>
        </div>
      ) : (
        <p className="no-building">No building Assigned...</p>
      )}
      {apartments.length > 0 ? (
        <div className="apartments-section">
          <h2>Apartments in the Building</h2>
          <ul className="apartment-list">
            {apartments.map((apartment) => (
              <li key={apartment._id}>
                <p>{`Name: ${apartment.name} , Floor: ${apartment.floor}, Square Meters: ${apartment.square_meters}`}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="no-apartments">No apartments tied to this building...</p>
      )}
    </div>
  );
}

export default ViewBuilding;