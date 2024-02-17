import React , {useState , useEffect} from 'react'
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/consumptionHistory.css'

function ConsumptionHistory({apartmentId , refresh}) {
  const [consumptions , setConsumptions] = useState([]);
  const [loading , setLoading] = useState(true);
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
  useEffect(() => {
    const fetchConsumptions = async() => {
        try {
            const response = await axios.get(`/api/consumptions/${apartmentId}`);
            setConsumptions(response.data);
            console.log(response.data);
            setLoading(false);

        }catch(error) {
            console.error(error);
            setLoading(false);
        }
        };
        fetchConsumptions();
    }, [apartmentId , refresh]);
    
    if(loading) {
        return <p>Loading...</p>;
    }

    if (consumptions.length === 0) {
        return <p> No consumption data available.</p>
    }

  return (
    <div className='consumption-history'>
        History...
      <table className='table table-striped'>
        <thead>
            <tr>
                <th scope='col'>Apartment</th>
                <th scope="col">Month</th>
                <th scope="col">Year</th>
                <th scope="col">Consumption</th>
            </tr>
        </thead>
        <tbody>
            {consumptions.map((consumption) => (
                <tr key={consumption._id}>
                    <td>{consumption.apartment.name}</td>
                    <td>{months.find(month => month.value === consumption.month)?.label || 'N/A'}</td>
                    <td>{consumption.year}</td>
                    <td>{consumption.consumption}</td>
                </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

export default ConsumptionHistory
