
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';

function ManageApartments() {
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [tenant, setTenant] = useState('');
  const [floor, setFloor] = useState('');
  const [squareMeters, setSquareMeters] = useState('');
  const [owner, setOwner] = useState('');
  const [fi, setFi] = useState('');
  const [heating, setHeating] = useState('');
  const [elevator, setElevator] = useState('');

  useEffect(() => {
    // Fetch the list of buildings when component mounts
    fetchBuildings();
  }, []);

  const fetchBuildings = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/buildings');
      const { buildings } = response.data;
    //   setBuildings(buildings);
    } catch (error) {
      console.error('Error fetching buildings:', error);
    }
  };

  const handleTenantChange = (e) => {
    setTenant(e.target.value);
  };

  const handleFloorChange = (e) => {
    setFloor(e.target.value);
  };

  const handleSquareMetersChange = (e) => {
    setSquareMeters(e.target.value);
  };

  const handleOwnerChange = (e) => {
    setOwner(e.target.value);
  };

  const handleFiChange = (e) => {
    setFi(e.target.value);
  };

  const handleHeatingChange = (e) => {
    setHeating(e.target.value);
  };

  const handleElevatorChange = (e) => {
    setElevator(e.target.value);
  };

  const handleCreateApartment = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/apartments', {
        building: selectedBuilding,
        tenant,
        floor,
        square_meters: squareMeters,
        owner,
        fi,
        heating,
        elevator,
      });
      console.log('Apartment created:', response.data);
      // Reset the form fields
      setSelectedBuilding(null);
      setTenant('');
      setFloor('');
      setSquareMeters('');
      setOwner('');
      setFi('');
      setHeating('');
      setElevator('');
      // Perform any additional actions, such as fetching the updated list of apartments
      // fetchApartments();
    } catch (error) {
      console.error('Error creating apartment:', error);
    }
  };

  return (
    <div className="container">
      <h2>Create Apartment</h2>
      <form onSubmit={handleCreateApartment}>
        <div className="form-group">
          <label htmlFor="building">Building:</label>
          <select
            id="building"
            className="form-control"
            value={selectedBuilding}
            onChange={(e) => setSelectedBuilding(e.target.value)}
            required
          >
            {/* Render the options for buildings */}
            {/* {buildings.map((building) => (
              <option key={building._id} value={building._id}>
                {building.address}
              </option>
            ))} */}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="tenant">Tenant:</label>
          <input
            type="text"
            className="form-control"
            id="tenant"
            value={tenant}
            onChange={handleTenantChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="floor">Floor:</label>
          <input
            type="number"
            className="form-control"
            id="floor"
            value={floor}
            onChange={handleFloorChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="squareMeters">Square Meters:</label>
          <input
            type="number"
            className="form-control"
            id="squareMeters"
            value={squareMeters}
            onChange={handleSquareMetersChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="owner">Owner:</label>
          <input
            type="text"
            className="form-control"
            id="owner"
            value={owner}
            onChange={handleOwnerChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="fi">Fi:</label>
          <input
            type="text"
            className="form-control"
            id="fi"
            value={fi}
            onChange={handleFiChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="heating">Heating:</label>
          <input
            type="text"
            className="form-control"
            id="heating"
            value={heating}
            onChange={handleHeatingChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="elevator">Elevator:</label>
          <input
            type="text"
            className="form-control"
            id="elevator"
            value={elevator}
            onChange={handleElevatorChange}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Create
        </button>
      </form>
    </div>
  );
}

export default ManageApartments;