import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import { toast } from 'react-toastify';
function CalculateExpenses() {
  //Defining the Data set
  const [data, setData] = useState({
    apartments: [],
    consumptions: [],
    building: {},
    expenses: [],
    total: {
      heating: 0.0,
      elevator: 0.0,
      general: 0.0,
    },
  });
  const [apartmentExpenses, setApartmentExpenses] = useState({});
  useEffect(() => {
    //Fetching the Required data from the database
    const fetchData = async () => {
      const token = window.localStorage.getItem('token');
      //Get the administrator's profile and authorize him if he has valid token
      const profileResponse = await axios.get('http://localhost:5000/api/profile', {
        headers: { Authorization: token },
      });

      if (profileResponse.data.profileId || profileResponse.data.userId) {
        const buildingId = profileResponse.data.profileId;
        const userId = profileResponse.data.userId;
        //Building response , expensesResponse
        const [buildingResponse, expensesResponse] = await Promise.all([
          axios.get(`http://localhost:5000/api/buildings/${buildingId}`),
          axios.get(`http://localhost:5000/api/expenses/${userId}`),
        ]);
        const fetchedBuilding = buildingResponse.data;
        //Apartments that are tied to the building Response
        const apartmentsResponse = await axios.get(`http://localhost:5000/aps/Apartments/${fetchedBuilding._id}`);
        const allConsumptionsResponses = await Promise.all(
          apartmentsResponse.data.map((apartment) =>
            axios.get(`http://localhost:5000/api/consumptions/${apartment._id}`)
          )
        );
        //Consumptions Response
        const allConsumptions = allConsumptionsResponses.flatMap(response => response.data);

        const newState = {
          apartments: apartmentsResponse.data,
          building: buildingResponse.data,
          expenses: expensesResponse.data,
          consumptions: allConsumptions,
        };
        //Finally set the data with the New State of fetched objects
        setData(newState);
      }
      
    };
    fetchData();
  }, []);
  //using the useMemo hook to memoize expensive computations so that they are not recalculated on every render
  useMemo(() => {
    //Calculation of the totals of every Expense with the use of reduce function
    const totalHeating = data.expenses.filter(e => e.type_expenses === 'Heating').reduce((acc, curr) => acc + curr.total, 0);
    const totalElevator = data.expenses.filter(e => e.type_expenses === 'Elevator').reduce((acc, curr) => acc + curr.total, 0);
    const totalGeneral = data.expenses.reduce((acc, curr) => acc + (curr.type_expenses !== 'Heating' && curr.type_expenses !== 'Elevator' ? curr.total : 0), 0);
    
    const apartmentProducts = {};
    const totalProduct = data.apartments.reduce((acc, apartment) => {
      //Get the consumption for every apartment
      const apartmentConsumption = data.consumptions.find(c => c.apartment._id === apartment._id)?.consumption || 0;
      //Multiply the heating millimetre with the hours of every apartment
      const product = apartment.heating * apartmentConsumption;
      apartmentProducts[apartment._id] = product;
      return acc + product;
    }, 0);

    const calculatedApartmentExpenses = {};
       
    data.apartments.forEach(apartment => {
      //Divide each apartment product with the total product
      const division = apartmentProducts[apartment._id] / totalProduct;
      //Total heating is equal to the division of apartmentProducts with the total product
      calculatedApartmentExpenses[apartment._id] = {
        heating: division * totalHeating,
        elevator: apartment.elevator * totalElevator ,
        general: apartment.general_expenses * totalGeneral,
      };
    });

    setApartmentExpenses(calculatedApartmentExpenses);
  }, [data]);

  const handleCreatePayment = async (apartment) => {
    const token = window.localStorage.getItem('token');
    try {
      const paymentData = {
        apartment: apartment._id,
        month: apartmentExpenses.month, //JS months are 0-indexed.
        year: apartmentExpenses.year,
        total_heating: apartmentExpenses[apartment._id]?.heating || 0,
        total_elevator: apartmentExpenses[apartment._id]?.elevator|| 0,
        total_general: apartmentExpenses[apartment._id]?.general || 0,
        payment_made: false,
      };
      const response = await axios.post('http://localhost:5000/api/payments', paymentData, {
        headers: {Authorization: token},
      })
      if (response.status === 200) {
        toast.success("Payment Created succesfully");
      }else{
        toast.error("Failed to create payment")
      }
    }catch(error){
      console.error('Error creating payment' , error);

    }
  }

  return (
    <div className='container mt-5'>
      <h1 className='mb-5'>Apartment Expenses</h1>
      {data.apartments.map((apartment) =>  (
      <div key={apartment._id} className='card mb-3' style= {{ maxWidth: "18rem"}}>
        <div className='card-header bg-primary text-white'>
            {apartment.name} - Floor: {apartment.floor}
            </div>
          <div className='card-body'>
            <p className='card-text'>
                <strong>Heating:</strong> {apartmentExpenses[apartment._id]?.heating.toFixed(2)}
              </p>
              <p className='card-text'>
                <strong>Elevator:</strong> {apartmentExpenses[apartment._id]?.elevator.toFixed(2)}
              </p>
              <p className='card-text'>
              <strong>General:</strong> {apartmentExpenses[apartment._id]?.general.toFixed(2)}
              </p>
              <button className= 'btn btn-success' onClick={() => handleCreatePayment(apartment)}> Create Payment</button>
            </div>
      </div>
      ))}
      </div>
  );
}

export default CalculateExpenses;