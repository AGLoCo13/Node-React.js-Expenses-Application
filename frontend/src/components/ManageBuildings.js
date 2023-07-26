// ManageBuildings.js
import React, { useState,useEffect } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/manageBuildings.css'

function ManageBuildings() {
  const [buildings , setBuildings] = useState([]);
  const [newBuilding, setNewBuilding] = useState({profile:'',address:'',floors:'',apartments:'',reserve:''});
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [editBuilding, setEditBuilding] = useState({profile:'',address:'',floors:'',apartments:'',reserve:''});
  const [showConfirmation,setShowConfirmation] = useState(false);
  const [administrators,setAdministrators] = useState(null);


  useEffect(() => {
    //Fetch the list of administrators when component mounts
    fetchAdministrators();
  } , []);

  const fetchAdministrators = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/administrators");
      const { administrators } = response.data;
      setAdministrators(administrators);
      console.log(administrators);
    }catch (error) {
      console.error("Error fetching administrators:", error);
    }
  };

  useEffect(() => {
    fetchBuildings();
  }, []);

  const fetchBuildings = async () => {
    try{
    const response = await axios.get('http://localhost:5000/api/buildings');
    const {buildings} = response.data;
    setBuildings(buildings);
  }catch (error) {
      console.error("Error fetching Buildings:", error);
  }
  }


  const handleInputChange = (e) => {
    const {name , value} = e.target;
    if(selectedBuilding) {
      setEditBuilding((prevEditBuilding) => ({
        ...prevEditBuilding,
        //profile value maybe.. 
        [name]:value,
      }));
    }else{
      setNewBuilding((prevNewBuilding) => ({
        ...prevNewBuilding,
        [name]:value,
      }));
    }
  }
  

  const CreateBuilding = async (e) => {
    e.preventDefault();
    
    try{
      await axios.post('http://localhost:5000/api/buildings' , newBuilding);
      setNewBuilding({profile:'',address:'',floors:'',apartments:'',reserve:''});
      fetchBuildings();
    }catch(error){
      console.error('Error creating building:', error.response.data);
    }
  };

  const selectBuilding = (building) => {
    setSelectedBuilding(building);
    setEditBuilding({
      profile: building.profile,
      address: building.address,
      floors: building.floors,
      apartments: building.apartments,
      reserve : building.reserve
    })
  }

  const UpdateBuilding = async (e) => {
    e.preventDefault();
    try {
      const {profile , address , floors , apartments , reserve} = editBuilding;
      const updatedField = {profile , address , floors , apartments , reserve};
      await axios.put(`http://localhost:5000/api/buildings/${selectedBuilding._id}`, updatedField);
      setSelectedBuilding(null);
      setEditBuilding({profile:'', address:'' , floors:'', apartments:'', reserve:''});
      fetchBuildings();
      
    } catch (error) {
      console.error('Error updating building:', error);
    }
  };

  const DeleteBuilding = (building) => {
    setSelectedBuilding(building);
    setShowConfirmation(true);
  }

  const handleDeleteConfirmation = async(confirmed) => {
    setShowConfirmation(false);
    if (confirmed && selectedBuilding) {
      try{
        await axios.delete(`http://localhost:5000/api/buildings/${selectBuilding._id}`);
        fetchBuildings();
      }catch (error) {
        console.error('Error deleting building:' , error);
      }
    }
  }

  return (
    <div className="container">
    <h2>Create Building</h2>
    <form onSubmit={CreateBuilding}>
      <div className="form-group">
        <label htmlFor="profile">Profile:</label>
        <select
          id="profile"
          name="profile"
          className="form-control"
          value={newBuilding.profile}
          onChange={handleInputChange}
          required
          style = {{backgroundColor: 'white', color:'black'}}
          >
       <option value="">Select a profile</option>
        {administrators ? (
              administrators.map((administrator) => (
                <option key={administrator._id} value={administrator._id}>
                  {administrator.user.name}
          </option>
        ))
        ): (
          <option>Loading...</option>
        )}
  </select>
        
      </div>
      <div className="form-group">
        <label htmlFor="address">Address:</label>
        <input
          type="text"
          className="form-control"
          id="address"
          name="address"
          value={newBuilding.address}
          onChange={handleInputChange}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="floors">Floors:</label>
        <input
          type="number"
          className="form-control"
          id="floors"
          name="floors"
          value={newBuilding.floors}
          onChange={handleInputChange}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="apartments">Apartments:</label>
        <input
          type="number"
          className="form-control"
          id="apartments"
          name="apartments"
          value={newBuilding.apartments}
          onChange={handleInputChange}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="reserve">Reserve:</label>
        <input
          type="text"
          className="form-control"
          id="reserve"
          name="reserve"
          value={newBuilding.reserve}
          onChange={handleInputChange}
          required
        />
      </div>
      <button type="submit" className="btn btn-primary">Create</button>
    </form>
  </div>
  );
}

export default ManageBuildings;
