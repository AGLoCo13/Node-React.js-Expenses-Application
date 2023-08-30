import React, { useEffect , useState} from 'react';
import axios from 'axios';

function CalculateExpenses() {
  const [user , setUser] = useState(null);
  const [apartments , setApartments] = useState([]);
  const [building , setBuilding] = useState(null);
  const [expenses , setExpenses] = useState([]);
  const [consumptions , setConsumptions] = useState([]);
  const [total_heating , setTotalHeating] = useState(0.0);
  const [total_elevator , setTotalElevator] = useState(0.0);
  const [total_general , setTotalGeneral] = useState(0.0);
  const [product , setProduct] = useState([]);
  const [totalProduct , setTotalProduct] = useState(0);
  const [division , setDivision] = useState({});
  let product_static = 0.0;
  const apartment_geating =[]
  const apartment_elevator = []
  const apartment_general = []
  const consumption = []
  const apartment_cons = []


  const now = new Date(); //Gets the current date and time
  const currentMonth = now.getMonth() + 1; //returns months from 0-11 (0 for January , 11 for december)
  const currentYear = now.getFullYear();

  
  


  {/*  const [CalculateExpenses , setCalculatedExpenses] = useState([])
    useEffect(() => {
      fetchExpenses();
      CalculateExpenses();
    } , []);
    //Fetching the expenses for the building 

  */}
   //Get the current administrator , profile , building , expenses and apartments
    useEffect(() => {
      const fetchBuildingAndApartments = async () => {
        try {
          const token = window.localStorage.getItem('token');
          const response = await axios.get('http://localhost:5000/api/profile', {
            headers: {Authorization: token},
          });
  
          //Check if the user's profile has a profileId
          if (response.data.profileId){
            //if true give me the building that he's admin to 
            const buildingResponse = await axios.get(`http://localhost:5000/api/buildings/${response.data.profileId}`);
            const fetchedBuilding = buildingResponse.data;
            setBuilding(fetchedBuilding);
            console.log(fetchedBuilding);
  
            //Fetch apartments tied to the building 
            const apartmentsResponse = await axios.get(`http://localhost:5000/aps/Apartments/${fetchedBuilding._id}`);
             //Extract the "apartments" field
            setApartments(apartmentsResponse.data);
            console.log(apartmentsResponse.data);
          }
         
        } catch(error) {
          console.error(error);
        }
      };
      
      const fetchExpenses = async() => {
        try {
          const token = window.localStorage.getItem('token');
          const response = await axios.get(`http://localhost:5000/api/profile`, {
            headers: {Authorization: token},
          });
          console.log(response.data.userId);
          if (response.data.userId) {
            //If true give me the expenses he's admin to
            const expensesResponse = await axios.get(
              `http://localhost:5000/api/expenses/${response.data.userId}`
            );
            const fetchedExpenses = expensesResponse.data;
            console.log(fetchedExpenses)

            console.log("Fetched Expenses:" , fetchedExpenses);
            console.log("Current month:" , currentMonth , "Current Year" ,currentYear )

            const currentExpenses = fetchedExpenses.filter(expense => 
              expense.month === currentMonth &&
              expense.year === currentYear);
      
              console.log("Filtered Current Expenses: " , currentExpenses);
            setExpenses(currentExpenses || []);
            
            //calculate the total of every type of expense
            currentExpenses.forEach(expense => {
              switch(expense.type_expenses) {
                case 'Heating':
                  console.log('Heating expense found:' , total_heating)
                  setTotalHeating(prevTotal => prevTotal + expense.total);
                  break;
                case 'Elevator':
                  setTotalElevator(prevTotal => prevTotal + expense.total);
                  break;
                default:
                  setTotalGeneral(prevTotal => prevTotal + expense.total );

              }
            });
          }
        }catch (error) {
          console.log(error);
        }
      }
     
      fetchBuildingAndApartments();
      fetchExpenses();
    }, []);
    useEffect(() => {
      console.log("Consumptions:", consumptions);
    }, [consumptions]);

    //Get the consumption for every Apartment
    let allConsumptions =[];
useEffect(() => {
  const fetchConsumptions = async() => {
    
    let filteredConsumptions = [];
    //Get the consumption for each apartment
    for (let apartment of apartments) {
      try {
        const response = await axios.get(`http://localhost:5000/api/consumptions/${apartment._id}`)
        filteredConsumptions = response.data.filter(consumption => 
          consumption.month === currentMonth && consumption.year === currentYear)
        allConsumptions.push(...filteredConsumptions);
      }catch(error) {
        console.error(error);
      }
      setConsumptions(filteredConsumptions);
    }
  }

  if(apartments.length > 0){
  fetchConsumptions();
}
} , [apartments])
  //   useEffect(() => {
  //     console.log(total_heating);  // This will be called whenever total_heating changes
  // }, [total_heating]);


 //Multiplies heating millimetre with the hours of every apartment
 useEffect(() => {
  const newProduct = {};

  apartments.forEach(apartment => {
    //Assuming consumption is an object indexed by apartment.id
    const apartmentConsumption = consumption[apartment.id];
    if (apartmentConsumption) {
      newProduct[apartment.id] = apartment.heating * apartmentConsumption;
    }
  })

  setProduct(newProduct);
} , [apartments , consumption]);   
//And gets the total of the previous multiplications
useEffect(() => {
  const computedTotalProduct = apartments.reduce((accumulator, apartment) => {
  return accumulator + (product[apartment.id] || 0);
}, 0);

setTotalProduct(computedTotalProduct);
},[apartments , product]);

useEffect(() => {
  const newDivision = {};
  apartments.forEach(apartment => {
    if(totalProduct !== 0) {
      newDivision[apartment.id] = product[apartment.id] / totalProduct;
    } else {
      newDivision[apartment.id] = 0;
    }
  });

  setDivision(newDivision);
}, [apartments, product , totalProduct]);

  return (
    <div>
      
    </div>
  )
}


export default CalculateExpenses
