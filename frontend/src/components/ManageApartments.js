import React, { useEffect, useState } from 'react'
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer , toast } from 'react-toastify';

function ManageApartments() {
  const [buildings , setBuildings] = useState([]);
  const [apartments , setApartments] = useState([]);
  const [newApartment , setNewApartment] = useState({building:'',tenant:'',floor:'',name:''
  ,square_meters:'',owner:'',fi:'',heating:'',elevator:'',general_expenses:''})
  const [selectedApartment , setSelectedApartment] = useState(null);
  const [editApartment , setEditApartment] = useState({building:'',tenant:'',floor:'',name:''
  ,square_meters:'',owner:'',fi:'',heating:'',elevator:'',general_expenses:''});
  const [showConfirmation, setShowConfirmation] = useState(null);
  const [showEditForm , setShowEditForm] = useState(false);
  const [administrators, setAdministrators] = useState(false);
  const [tenants , setTenants] = useState(false);


  //Function to show edit Form
  const showEditApartmentForm = () => {
    setShowEditForm(true);
  };

  useEffect(() => {
    fetchTenants();
  } , []);

  const fetchTenants = async () => {
    try {
      const response = await axios.get('/api/tenants');
      const {tenants} = response.data;
      setTenants(tenants);
      console.log(tenants);
    }catch(error){
      console.error('Error fetching Tenants:', error);
    }
  };

  useEffect(() => {
    //Fetch the list of Buildings when the component mounts
    fetchAdministrators();
  }, []);

  const fetchAdministrators = async () => {
    try {
      const response = await axios.get("/api/administrators");
      const { administrators } = response.data;
      setAdministrators(administrators);
    }catch (error) {
      console.error("Error fetching administrators:", error);
    }
  };
  useEffect(() => {
    //Fetch the list of Buildings when the component mounts
    fetchBuildings();
  }, []);
  const fetchBuildings = async () => {
    try {
      const response = await axios.get("/api/buildings");
      setBuildings(response.data);
    }catch(error) {
      console.error("Error fetching Buildings:" , error);
    }
  };

  //UseEffect Hook to Fetch Apartments
  useEffect(() => {
    fetchApartments();
  }, []);

  const fetchApartments = async () => {
    try {
      const response = await axios.get('/api/apartments');
      const {apartments} = response.data;
      setApartments(apartments);
    }catch(error) {
      console.error("Error fetching Apartments:" , error);
    }
    };

  
  
 
  //Function to create Apartment
  const CreateApartment = async (e) => {
    e.preventDefault();

    try{
      await axios.post("/api/apartments", newApartment);
      setNewApartment({building:'',tenant:'',name:'',floor:''
      ,square_meters:'',owner:'',fi:'',heating:'',elevator:'',general_expenses:''});
      fetchApartments();
      toast.success('Apartment Created Succesfully!')
    }catch(error) {
      console.error('Error creating apartment:' , error.response.data);
      toast.error("Error creating Apartment")
    }
  };
  //Function to select an Apartment
  const selectApartment = (apartment) => {
    setSelectedApartment(apartment);
    setEditApartment({
      building : apartment.building,
      tenant : apartment.tenant,
      name : apartment.name,
      floor: apartment.floor,
      square_meters: apartment.square_meters,
      owner: apartment.owner,
      fi: apartment.fi,
      heating: apartment.heating,
      elevator: apartment.elevator,
      general_expenses: apartment.general_expenses
    });
  };

//Function to update an apartment
  const UpdateApartment = async (e) => {
    e.preventDefault();
    try{
      const {building, tenant, name ,  floor , square_meters , owner,
      fi, heating , elevator , general_expenses} = editApartment;
      const updatedField = {building , tenant , name, floor , square_meters , owner,
      fi , heating , elevator , general_expenses};
      await axios.put(`/api/apartments/${selectedApartment._id}`, updatedField);
      setSelectedApartment(null);
      setEditApartment({building:'', tenant:'', name:'' , floor:'' , square_meters:'' , owner:'',
        fi:'', heating:'' , elevator:'' , general_expenses:''});
        fetchApartments();
        toast.success('Apartment Created successfully!')
      }catch (error) {
        console.error('Error updating apartment:', error);
        toast.error('Error updating Apartment!')
      }
    };

    const deleteApartment = (apartment) => {
      setSelectedApartment(apartment);
      setShowConfirmation(true);
    }

    const handleDeleteConfirmation = async(confirmed) => {
      setShowConfirmation(false);
      if (confirmed && selectedApartment) {
        try{
          await axios.delete(`/api/apartments/${selectedApartment._id}`);
          fetchApartments();
          toast.success('Apartment deleted successfully!');
        }catch(error) {
          console.error('Error deleting apartment:' , error) ;
          toast.error('Error deleting Apartment!')
        }
      }
    }
  
  //Input Handler of Creation and Deletion of apartment
  const handleInputChange = (e) => {
    const {name , value} = e.target;
    //MUST CHECK AGAIN CAUSE OWNER FIELD CANNOT BE WRITTEN AS TRUE IN THE DATABASE!
    // Convert the 'owner' field to a boolean value
  const newValue = name === 'owner' ? value === 'true' : value;
    if(selectedApartment) {
      setEditApartment((prevEditApartment) => ({
        ...prevEditApartment,
        //building value maybe...
        [name] : newValue,
      }));
    }else {
        setNewApartment((prevNewApartment) => ({
          ...prevNewApartment,
          [name]: newValue, // Use the ObjectId for the tenant field
        }));
      }
    }
  
  

  return (
    <div className='container'>
      <h2> Create Apartment</h2>
      <form onSubmit={CreateApartment}>
            <div className='form-group'>
              <label htmlFor='building'>Building:</label>
              <select
                 id="building"
                 name='building'
                 className='form-control'
                 value={newApartment.building}
                 onChange={handleInputChange}
                 required
              >
                <option value="">Select a Building</option>
                {buildings ? (
                  buildings.map((building) => (
                    <option key={building._id} value={building._id} >
                      Address : {building.address}
                    </option>
                  ))
                ) : (
                  <option> Loading...</option>
                )}
             </select>
              <label htmlFor='tenant'>Tenant:</label>
              <select
                  id='tenant'
                  name='tenant'
                  className='form-control'
                  value={newApartment.tenant}
                  onChange={handleInputChange}
                  required
                  >
                  <option value="">Select a Tenant</option>
                  {tenants ? (
                    tenants.map((tenant) => (
                      <option key={tenant._id} value={tenant._id} >
                        {tenant?.user?.name || tenant.address}
                      </option>
                    ))
                  ):(
                    <option> Loading...</option>
                  )}
                  </select>
                  <div className='form-group'>
                    <label htmlFor='name'>Name:</label>
                    <input 
                      type="text"
                      className='form-control'
                      id='name'
                      name='name'
                      value={newApartment.name}
                      onChange={handleInputChange}
                      required
                      />
                  </div>
                  <div className="form-group">
                    <label htmlFor='floor'>Floor:</label>
                    <input 
                      type="number"
                      className='form-control'
                      id='floor'
                      name='floor'
                      value={newApartment.floor}
                      onChange={handleInputChange}
                      required
                      />
                  </div>
                  <div className="form-group">
                    <label htmlFor='square_meters'>Square Meters:</label>
                    <input
                     type="number"
                     className='form-control'
                     id="square_meters"
                     name="square_meters"
                     value={newApartment.square_meters}
                     onChange={handleInputChange}
                     required
                     />
                  </div>
                  <div className="form-group">
                    <label htmlFor="owner">Owner:</label>
                    <select
                      id='owner'
                      name='owner'
                      className='form-control'
                      value={newApartment.owner.toString()} //Convert to string since owner is boolean
                      onChange={handleInputChange}
                      required
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                  </div>
                  <div className='form-group'>
                    <label htmlFor="fi">Load Factor(fi):</label>
                    <input
                      type="number"
                      className='form-control'
                      id="fi"
                      name="fi"
                      placeholder= "0.6 for ground floor , 0.65 mezzanine properties , 0.55 for others"
                      value={newApartment.fi}
                      onChange={handleInputChange}
                      required
                      />
                  </div>
                  <div className='heating'>
                    <label htmlFor='heating'>Heating (millimetres):</label>
                    <input 
                      type='number'
                      className='form-control'
                      id='heating'
                      name='heating'
                      placeholder = "Can be left empty as it can be calculated automatically"
                      value={newApartment.heating}
                      onChange={handleInputChange}
                      
                      />
                      <div className='elevator'>
                        <label htmlFor='elevator'>Elevator (millimetres):</label>
                        <input
                           type='number'
                           className='form-control'
                           id='elevator'
                           name='elevator'
                           placeholder = "Can be left empty as it can be calculated automatically"
                           value={newApartment.elevator}
                           onChange={handleInputChange}
                           
                           />
                              <div className='general_expenses'>
                                <label htmlFor='general_expenses'>General Expenses (millimetres):</label>
                                <input 
                                  type='number'
                                  className='form-control'
                                  id='general_expenses'
                                  name='general_expenses'
                                  placeholder = "Can be left empty as it can be calculated automatically"
                                  value={newApartment.general_expenses}
                                  onChange={handleInputChange}
                                  
                                  />
                           </div>
                      </div>
                  </div>
                  
            </div>
            <button type="submit" className='btn btn-primary'>Create Apartment</button>
      </form>
      {apartments && apartments.length > 0 ? (
        <>
      <h3 className='text-center'>Apartment List:</h3>
      <ul className='list-group'>
        {apartments.map((apartment) => (
            <li key={apartment._id} className='list-group-item d-flex justify-content-between align-items-center'>
               Name: {apartment.name} / Address: {apartment.building && apartment.building?.address ? `Address: ${apartment.building?.address}` : 'No Building'} / Floor: {apartment.floor} / Tenant: {apartment.tenant?.user?.name || apartment.building?.address}
              <button className='btn btn-primary mr-2' onClick={() => {selectApartment(apartment); showEditApartmentForm();}}>Edit</button>
              <button className='btn btn-danger' onClick={() => deleteApartment(apartment)}>Delete</button>
            </li>
        ))}
    </ul>
    {showConfirmation && (
      <div className='confirmation-popup'>
        <p> Are you sure you want to delete this apartment?</p>
        <button className="btn btn-danger" onClick={() => handleDeleteConfirmation(true)}>Yes</button>
        <button className='btn btn-secondary' onClick={() => handleDeleteConfirmation(false)}>No</button>
    </div>
  )}
  </>
): (
  <p> No apartments found</p>
)}
{showEditForm && selectedApartment &&(
  <div className='edit-building-container mt-4'>
    <h3 className='text-center'>Edit Apartment</h3>
    <form onSubmit={UpdateApartment}>
      <div className='form-group'>
        <label htmlFor="tenant">Tenant:</label>
        <select 
          id="tenant"
          name="tenant"
          className="form-control"
          value={editApartment.tenant}
          onChange={handleInputChange}
          required
          >
          <option value="">Select a Tenant</option>
                  {tenants ? (
                    tenants.map((tenant) => (
                      <option key={tenant._id} value={tenant._id} >
                        {tenant?.user?.name || tenant.address}
                      </option>
                    ))
                  ):(
                    <option> Loading...</option>
                  )}
                  </select>
      </div>
      <div className='form-group'>
        <label htmlFor='owner'>Owner:</label>
       <select
          type="number"
          className='form-control'
          id='owner'
          name='owner'
          value={editApartment.owner}
          onChange={handleInputChange}
          required
          >
          <option value={true}>Yes</option>
          <option value={false}>No</option>
          </select>
      </div>
      <div className='form-group'>
        <label htmlFor="fi"> Load Factor:</label>
        <input
          type="number"
          className='form-control'
          id='fi'
          name='fi'
          value={editApartment.fi}
          onChange={handleInputChange}
          required
          />
      </div>
      <div className='form-group'>
        <label htmlFor="heating"> Heating (millimetres):</label>
        <input
          type="number"
          className='form-control'
          id='heating'
          name='heating'
          value={editApartment.heating}
          onChange={handleInputChange}
          required
          />
      </div>
      <div className='form-group'>
        <label htmlFor="elevator"> Elevator (millimeters):</label>
        <input
          type="number"
          className='form-control'
          id='elevator'
          name='elevator'
          value={editApartment.elevator}
          onChange={handleInputChange}
          required
          />
      </div>
      <div className='form-group'>
        <label htmlFor="general_expenses"> General Expenses (millimeters):</label>
        <input
          type="number"
          className='form-control'
          id='general_expenses'
          name='general_expenses'
          value={editApartment.general_expenses}
          onChange={handleInputChange}
          required
          />
      </div>
      <button type="submit" className="btn btn-primary">Update Apartment</button>
      <button className="btn btn-secondary ml-2" onClick={() => setSelectedApartment(null)}>Cancel</button>
    </form>
    </div>
)}
<ToastContainer />
</div>
  );
}

export default ManageApartments;
