import React , {useState , useEffect } from 'react'
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';

function TenantPayments() {
const [apartmentData , setApartmentData] = useState(null);
const [userData , setUserData] = useState(null);
const [tenantPayments , setTetantPayments] = useState(null);






useEffect(() => {
    fetchUserApartmentPaymentsData();
}, []);

//Function that fetches tenant's profile , the apartment he's tenant to and the payments that are created by the building administrator.
const fetchUserApartmentPaymentsData = async () => {
    try{
        //Get the token from local storage 
        const token = window.localStorage.getItem('token');
        //Fetch the user's profile data from the server with the token in the headers 
        //Fetch the user's profile data from the server 
        const response = await axios.get('/api/profile', {
            headers: {
                Authorization : `${token}`,
            },
        });
        setUserData(response.data);

        //Fetch apartment based on the user's profile (tenant ID)
        const apartmentResponse = await axios.get(`/api/apartment/${response.data.profileId}`,{
            headers : {
                Authorization : `${token}` , 
            },
        });
        setApartmentData(apartmentResponse.data);
        console.log(apartmentResponse.data);

        //Fetch payments created by the building administrator and tied to the specific apartment
        const paymentResponse = await axios.get(`/api/payments/${apartmentResponse.data._id}`)
        setTetantPayments(paymentResponse.data);
    }catch(error) {
        console.error('Error fetching user data:' , error);
    }

};
 {/*From the fetched payments for the apartment , i created a getTotalCosts that gets 
 all the payments and sums into a grandTotal in order for the Tenant to see
his total cost */}
 
const getTotalCosts = (payments) => {
    let totalHeating = 0;
    let totalElevator = 0;
    let totalGeneral = 0;


payments.forEach(payment => {
    totalHeating += payment.total_heating;
    totalElevator += payment.total_elevator;
    totalGeneral += payment.total_general;
});

return {
    totalHeating,
    totalElevator,
    totalGeneral,
    grandTotal : totalHeating + totalElevator + totalGeneral
};
}

  const totals = tenantPayments ? getTotalCosts(tenantPayments) : null;
  return (
    <div className='container mt-5'>
        <h2>Your Payments</h2>
        {tenantPayments ? (
            <table className='table table-stripped'>
                <thead>
                    <tr>
                        <th>Apartment Name</th>
                        <th>Month</th>
                        <th>Year</th>
                        <th>Heating</th>
                        <th>Elevator</th>
                        <th>General</th>
                        <th> Grand Total</th>
                        <th>Payment Made</th>
                    </tr>
                </thead>
            <tbody>
                {tenantPayments.map(payment => (
                    <tr key={payment._id}>
                        <td>{apartmentData.name}</td>
                        <td>{payment.month}</td>
                        <td>{payment.year}</td>
                        <td>${totals.totalHeating.toFixed(2)}</td>
                        <td>${totals.totalElevator.toFixed(2)}</td>
                        <td>${totals.totalGeneral.toFixed(2)}</td>
                        <td>${totals.grandTotal.toFixed(2)}</td>
                        <td>{payment.payment_made ? 'Yes' : 'No'}</td>
                    </tr>
                ))}
            </tbody>
            </table>
        ) : (
            <p> Loading payments...</p>
        )}
      
    </div>
  )
  }

export default TenantPayments;
