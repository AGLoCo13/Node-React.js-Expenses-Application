import React , {useState , useEffect} from 'react'
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/consumptionHistory.css'

function ConsumptionHistory({apartmentId}) {
  const [consumptions , setConsumptions] = useState([]);
  const [loading , setLoading] = useState(true);

  useEffect(() => {
    const fetchConsumptions = async() => {
        try {
            const response = await axios.get('http://localhost:5000/api/consumptions');
            setConsumptions(response.data.consumptions);
            setLoading(false);

        }catch(error) {
            console.error(error);
            setLoading(false);
        }
        };
        fetchConsumptions();
    }, [apartmentId]);
    
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
                    <td>{consumption.month}</td>
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
