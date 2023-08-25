import React , {useEffect , useState} from 'react'
import axios from 'axios';
import { ToastContainer , toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/ExpensesCharge.css'
function ExpensesCharge() {
    const [selectedFile , setSelectedFile] = useState(null); //New state for selected file
    const [formData , setFormData] = useState({
        profile: '',
        total: '',
        date_created:'',
        document:'',
        month:'',
        year:'',
        type_expenses:''

    })
    const [building , setBuilding] = useState(null);
    const [expenses , setExpenses ] = useState([]);
    const [administratorProfile , setAdministrator] = useState(null);
    const expenseTypes = ['Heating', 'Elevator' , 'General'];
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
     //Fetch all expenses
     const fetchExpenses = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/expenses');
        setExpenses(response.data);
      } catch(error) {
        console.error('Error Fetching expenses:' , error);
      }
     };

     const handleInputChange = (event) => {
      const {name , value } = event.target;
      setFormData({
        ...formData,
        [name] : value,
      });
      };
      useEffect (() => {
        const fetchBuildingAdministrator = async () => {
          try {
             const token = window.localStorage.getItem('token');
              const response = await axios.get('http://localhost:5000/api/profile', {
                headers: {Authorization : token},
              });
  
              if (response.data.profileId){
                //If true give me the building he's admin to 
                const buildingResponse = await axios.get(`
                http://localhost:5000/api/buildings/${response.data.profileId}`);
                const fetchedBuilding = buildingResponse.data;
                setBuilding(fetchedBuilding);
                //Fetch the profile user name tied to the Building
                setAdministrator(fetchedBuilding.profile.user);
              }
        }catch(error){
              console.error(error);
        }
      }
        fetchBuildingAdministrator();
      }, []);
      
     const handleSubmit = async (event) => {
      event.preventDefault();
      try{
        // Use the administrator's _id in the formData
        const newFormData = {...formData , profile: administratorProfile._id}
        //Set the current data and time for date_created
        newFormData.date_created = new Date();
         //formData to Send WILL IMPLEMENT LATER THE UPLOADING OF FILES FOR RECEIPT
        const formDataToSend = new FormData();
        for (const key in newFormData) {
          formDataToSend.append(key , newFormData[key]);
        }
        if (selectedFile) {
          formDataToSend.append('document' , selectedFile);
        }
        await axios.post('http://localhost:5000/api/expenses' , newFormData);
        toast.success('Expense for apartment passed succesfully');
      } catch(error) {
        toast.error('Error passing expense')
      }
    }
    const handleFileInputChange = (event) => {
      const file = event.target.files[0]; //Get the selected file
      setSelectedFile(file); //Set the selected file to the state variable
    };


  return (
    <div className='container'>
      <h2 className='text-center'>Pass Building Expenses </h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor='profile'>Administrator: </label>
        <p className='form-control'>{administratorProfile ? administratorProfile.name : 'Loading...'}</p>
        <label htmlFor='type_expenses'>Expense type: </label>
        <select 
          id='type_expenses'
          name='type_expenses'
          className='form-control'
          value={formData.type_expenses}
          onChange={handleInputChange}
          required
          >
            <option value=''>Select Expense Type</option>
            {expenseTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        <label htmlFor = 'total'> Total: </label>
        <input
          type = "number"
          id="total"
          name="total"
          className='form-control'
          value={formData.total}
          onChange={handleInputChange}
          />

          <label htmlFor='document' className='receipt-label'> Receipt: </label>
          <input 
            type='file'
            id='document'
            name='document'
            value= {formData.document}
            accept='image/*, .pdf' //Specify the allowed file types
            onChange={handleFileInputChange}
            />
            {selectedFile && <p>Selected File: {selectedFile.name}</p>} {/*Display the selected file name */}


          <label htmlFor='month' className='month-label'>Month: </label>
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
            <label htmlFor='year'> Year: </label>
            <select
              id='year'
              name='year'
              className='form-control'
              value={formData.year}
              onChange={handleInputChange}
              >
                <option value=''>Select a year</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            <button type='submit' className='btn btn-primary'>
              Pass Expense
            </button>
      </form>
    </div>
  )
}

export default ExpensesCharge
