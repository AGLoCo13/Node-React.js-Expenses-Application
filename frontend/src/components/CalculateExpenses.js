import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';

function CalculateExpenses() {
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
    const fetchData = async () => {
      const token = window.localStorage.getItem('token');
      const profileResponse = await axios.get('http://localhost:5000/api/profile', {
        headers: { Authorization: token },
      });
      if (profileResponse.data.profileId || profileResponse.data.userId) {
        const buildingId = profileResponse.data.profileId;
        const userId = profileResponse.data.userId;

        const [buildingResponse, expensesResponse] = await Promise.all([
          axios.get(`http://localhost:5000/api/buildings/${buildingId}`),
          axios.get(`http://localhost:5000/api/expenses/${userId}`),
        ]);
        const fetchedBuilding = buildingResponse.data;

        const apartmentsResponse = await axios.get(`http://localhost:5000/aps/Apartments/${fetchedBuilding._id}`);
        const allConsumptions = await Promise.all(
          apartmentsResponse.data.map((apartment) =>
            axios.get(`http://localhost:5000/api/consumptions/${apartment._id}`)
          )
        );

        let localTotalHeating = 0;
        let localTotalElevator = 0;
        let localTotalGeneral = 0;

        expensesResponse.data.forEach(expense => {
          switch (expense.type_expenses) {
            case 'Heating':
              localTotalHeating += expense.total;
              break;
            case 'Elevator':
              localTotalElevator += expense.total;
              break;
            default:
              localTotalGeneral += expense.total;
          }
        });

        const newState = {
          apartments: apartmentsResponse.data,
          building: buildingResponse.data,
          expenses: expensesResponse.data,
          consumptions: allConsumptions.flat(),
          total: {
            heating: localTotalHeating,
            elevator: localTotalElevator,
            general: localTotalGeneral,
          },
        };
        setData(newState);
      }
    };
    fetchData();
  }, []);

  useMemo(() => {
     // Initialize the variables and objects
  let total_heating = 0;
  let total_elevator = 0;
  let total_general = 0;
  let total_product = 0;
  let product_static = 0;
  let static_val = 0;
  const apartment_heating = {};
  const apartment_elevator = {};
  const apartment_general = {};
  const product = {};
  const division = {};
  const apartment_cons = {};

  // Calculate the total of every type of expense
  data.expenses.forEach((expense) => {
    switch(expense.type_expenses) {
      case 'Heating':
        total_heating += expense.total;
        break;
      case 'Elevator':
        total_elevator += expense.total;
        break;
      default:
        total_general += expense.total;
    }
  });
  console.log("Total Heating:" , total_heating);
  console.log("Total Elevator:" , total_elevator);
  console.log("Total General:" , total_general);

  // Create a lookup object for consumptions based on apartmentId
  const consumptionLookup = {};
  data.consumptions.forEach(consumption => {
    if (consumption?.apartment?.$oid && typeof consumption.consumption === "number") {
      consumptionLookup[consumption.apartment.$oid] = consumption.consumption;
    }
  });
  console.log("Consumption Lookup:" , consumptionLookup);

  // Calculate product and total_product
  data.apartments.forEach((apartment) => {
    product[apartment._id] = apartment.heating * consumptionLookup[apartment._id];
    total_product += product[apartment._id];
  });
  console.log("Product:" , product);
  console.log("Total Product:" , total_product);

  // Calculate division
  data.apartments.forEach((apartment) => {
    division[apartment._id] = product[apartment._id] / total_product;
  });
  console.log("Division:" , division);

  // Calculate product_static and static_val
  data.apartments.forEach((apartment) => {
    product_static += apartment.heating * apartment.fi;
  });
  static_val = 1 - product_static;

  console.log("Product Static:" , product_static);
  console.log("Static val:" , static_val);

  // Calculate apartment_cons
  data.apartments.forEach((apartment) => {
    apartment_cons[apartment._id] = (division[apartment._id] * static_val) + (apartment.heating * apartment.fi);
  });
  console.log("Apartment Cons:" , apartment_cons);

  // Calculate the expenses for each apartment
  data.apartments.forEach((apartment) => {
    apartment_heating[apartment._id] = total_heating * apartment_cons[apartment._id];
    apartment_elevator[apartment._id] = total_elevator * apartment.elevator;
    apartment_general[apartment._id] = total_general * apartment.general_expenses;
  });
  console.log("Apartment Heating:" , apartment_heating);
  console.log("Apartment Elevator:" , apartment_elevator);
  console.log("Apartment General:" , apartment_general);

  const calculatedApartmentExpenses = {};
  data.apartments.forEach((apartment) => {
    calculatedApartmentExpenses[apartment._id] = {
      heating: apartment_heating[apartment._id] || 0,
      elevator: apartment_elevator[apartment._id] || 0,
      general: apartment_general[apartment._id] || 0,
    };
  });
  console.log("Calculated Apartment Expenses:" , calculatedApartmentExpenses);

  setApartmentExpenses(calculatedApartmentExpenses);
  }, [data]);

  return (
    <div>
      <h1>Apartment Expenses</h1>
      {Object.keys(apartmentExpenses).map((apartmentId) => (
        <div key={apartmentId}>
          <h3>Apartment ID: {apartmentId}</h3>
          <p>Heating: {apartmentExpenses[apartmentId].heating.toFixed(2)}</p>
          <p>Elevator: {apartmentExpenses[apartmentId].elevator.toFixed(2)}</p>
          <p>General: {apartmentExpenses[apartmentId].general.toFixed(2)}</p>
        </div>
      ))}
    </div>
  );
}

export default CalculateExpenses;