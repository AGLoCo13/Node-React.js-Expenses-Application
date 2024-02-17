import React , { useEffect, useState } from 'react'
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import {ToastContainer , toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ConsumptionHistory from './ConsumptionHistory';

function FuelCharge() {
    const [formData , setFormData] = useState({
      apartment: '',
      month: '',
      year: '',
      consumption: '',
    });
    const [apartments , setApartments] = useState([]);
    const [building , setBuilding ] = useState(null);
    const [refreshHistory , setRefreshHistory] = useState(false);

    const months = [
      {value: 1, label: 'January'},
      {value:2 , label: 'February'},
      {value:3 , label: 'March'},
      {value:4 , label: 'April'},
      {value:5 , label: 'May'},
      {value:6 , label: 'June'},
      {value:7 , label: 'July'},
      {value:8 , label: 'August'},
      {value:9 , label: 'September'},
      {value:10, label: 'October'},
      {value:11, label: 'November'},
      {value:12, label: 'December'}
    ];

    //Generate a list of years startong from the current year up to some number of years in the future
    const currentYear = new Date().getFullYear();
    const futureYears = 10;
    const years = Array.from({length: futureYears}, (_, i) => currentYear + i);
    //Get the building and apartments the building Administrator is tied to.
    useEffect(() => {
      const fetchBuildingAndApartments = async () => {
        try {
          const token = window.localStorage.getItem('token');
          const response = await axios.get('/api/profile', {
            headers: { Authorization : token} , 
          });

          if (response.data.profileId) {
            //If true give me the building he's admin to 
            const buildingResponse = await axios.get(
              `/api/buildings/${response.data.profileId}`
            );
            const fetchedBuilding = buildingResponse.data;
            setBuilding(fetchedBuilding);

            //Fetch apartments tied to the building 
            const apartmentsResponse = await axios.get(`/aps/Apartments/${fetchedBuilding._id}`);
            //Extract the "apartments" field
            setApartments(apartmentsResponse.data);
          }
        } catch(error) {
          console.error(error);
        }
      };
      fetchBuildingAndApartments();
    }, []);

    const handleInputChange = (event) => {
      const {name , value } = event.target;
      setFormData({
        ...formData,
        [name]: value,
      });
    };

    const handleSubmit = async (event) => {
      event.preventDefault();
      try{
        await axios.post('/api/consumption', formData);
        toast.success('Fuel Charge for apartment passed successfully!');

        //Force a refresh on the ConsumptionHistory component
        setRefreshHistory(prev => !prev);
      }catch(error) {
        toast.error('Error passing fuel charge')
      }
      
    };
  return (
    <div className='container'>
      <h2 className='text-center'> Gas Consumption for Apartment </h2>
      <form onSubmit= {handleSubmit}>
          <label htmlFor = "apartment">Apartment: </label>
          <select 
            id='apartment'
            name='apartment'
            className='form-control'
            value={formData.apartment}
            onChange={handleInputChange}

        >
          <option value="">Select an apartment</option>
          {apartments.map((apartment) => (
            <option key={apartment._id} value={apartment._id}>
               {apartment.name} - Floor {apartment.floor}
            </option>
          ))}
        </select>
        <label htmlFor = "month" > Month: </label>
        <select
          id="month"
          name="month"
          className='form-control'
          value={formData.month}
          onChange={handleInputChange}
          >
            <option value="">Select a month</option>
            {months.map((month) => (
              <option key = {month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>

          <label htmlFor= "year"> Year: </label>
          <select 
            id="year"
            name="year"
            className='form-control'
            value={formData.year}
            onChange={handleInputChange}
            >
              <option value="">Select a year</option>
              {years.map((year)=> (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <label htmlFor="consumption">Gas Consumption (hours)</label>
            <input  
              type="number"
              id="consumption"
              name="consumption"
              className='form-control'
              value={formData.consumption}
              onChange={handleInputChange}
              />

              <button type="submit" className="btn btn-primary">Save Consumption</button>
      </form>
      {formData.apartment && (
        <ConsumptionHistory apartmentId={formData.apartment} refresh={refreshHistory}/>
      )}
    </div>
  )
}

export default FuelCharge;
