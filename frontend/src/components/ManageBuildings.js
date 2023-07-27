// ManageBuildings.js
import React, { useState,useEffect } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/manageBuildings.css'
import { ToastContainer , toast} from 'react-toastify';

function ManageBuildings() {
  const [buildings , setBuildings] = useState([]);
  const [newBuilding, setNewBuilding] = useState({profile:'',address:'',floors:'',apartments:'',reserve:''});
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [editBuilding, setEditBuilding] = useState({profile:'',address:'',floors:'',apartments:'',reserve:''});
  const [showConfirmation,setShowConfirmation] = useState(false);
  const [administrators,setAdministrators] = useState(null);
  const [showEditForm , setShowEditForm] = useState(false);

//Function to show the edit Form
  const showEditBuildingForm = () => {
    setShowEditForm(true);
  };

//Function to hide the edit Form
const hideEditBuildingForm = () => {
  setSelectedBuilding(null);
  setEditBuilding({ profile: '', address: '', floors: '', apartments: '', reserve: '' });
  setShowEditForm(false);
};




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
    setBuildings(response.data);
  }catch (error) {
      console.error("Error fetching Buildings:", error);
  }
  };


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
      toast.success("Building Created Successfully!")
    }catch(error){
      console.error('Error creating building:', error.response.data);
      toast.error("Error creating Building!")
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
    });
  };

  const UpdateBuilding = async (e) => {
    e.preventDefault();
    try {
      const {profile , address , floors , apartments , reserve} = editBuilding;
      const updatedField = {profile , address , floors , apartments , reserve};
      await axios.put(`http://localhost:5000/api/buildings/${selectedBuilding._id}`, updatedField);
      setSelectedBuilding(null);
      setEditBuilding({profile:'', address:'' , floors:'', apartments:'', reserve:''});
      fetchBuildings();
      toast.success('Building updated Successfully!')
      
    } catch (error) {
      console.error('Error updating building:', error);
      toast.error('Error updating Building!')
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
        await axios.delete(`http://localhost:5000/api/buildings/${selectedBuilding._id}`);
        fetchBuildings();
        toast.success('Building deleted successfully!')
      }catch (error) {
        console.error('Error deleting building:' , error);
        toast.error("Error deleting Building!")
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
    {buildings && buildings.length > 0 ? (
      <>
    <h3 className="text-center">Buildings List:</h3>
    <ul className="list-group">
      {buildings.map((building) => (
        <li key={building._id} className="list-group-item d-flex justify-content-between align-items-center">
          Building Address : {building.address} - Administrator: {building.profile.user.name}
          <button className='btn btn-primary mr-2' onClick={() => {selectBuilding(building); showEditBuildingForm();}}>Edit</button>
          <button className='btn btn-danger' onClick={() => DeleteBuilding(building)}>Delete</button>
        </li>
      ))}
    </ul>
    {showConfirmation && (
      <div className='confirmation-popup'>
        <p>Are you sure you want to delete this building?</p>
        <button className="btn btn-danger" onClick={()=>handleDeleteConfirmation(true)}>Yes</button>
        <button className='btn btn-secondary' onClick={() => handleDeleteConfirmation(false)}>No</button>
      </div>
    )}
    </>
    ): (
      <p> No buildings found</p>
    )}
    {showEditForm && selectedBuilding &&(
      <div className="edit-building-container mt-4">
      <h3 className="text-center">Edit Building</h3>
      <form onSubmit={UpdateBuilding}>
        <div className="form-group">
        <label htmlFor="profile">Profile:</label>
        <select
          id="profile"
          name="profile"
          className="form-control"
          value={editBuilding.profile}
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
  <div className="form-group">
        <label htmlFor="address">Address:</label>
        <input
          type="text"
          className="form-control"
          id="address"
          name="address"
          value={editBuilding.address}
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
          value={editBuilding.floors}
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
          value={editBuilding.apartments}
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
          value={editBuilding.reserve}
          onChange={handleInputChange}
          required
        />
      </div>
        </div>
        <button type="submit" className="btn btn-primary">Update Building</button>
        <button className="btn btn-secondary ml-2" onClick={() => setSelectedBuilding(null)}>Cancel</button>
      </form>
    </div>
        
    )}
    <ToastContainer />
  </div>
  );
}

export default ManageBuildings;
