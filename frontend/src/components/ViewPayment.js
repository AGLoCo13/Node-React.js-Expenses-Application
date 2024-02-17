import React, { useEffect, useState } from 'react'
import axios from 'axios';
function ViewPayment() {
    const [payments , setPayments] = useState([]);
    const [apartments , setApartments] = useState([]);
    const [building , setBuilding] = useState(null);
    useEffect(() => {
        const fetchData = async () => {
            const token = window.localStorage.getItem('token');
            
            if (!token) {
                console.error('No token found in local storage.');
                return;
            }
    
            try {
                const profileResponse = await axios.get(`/api/profile`, {
                    headers: { Authorization: token },
                });
    
                const buildingId = profileResponse.data.profileId;
    
                const buildingResponse = await axios.get(`/api/buildings/${buildingId}`, {
                    headers: { Authorization: token },
                });
                const fetchedBuilding = buildingResponse.data;
                setBuilding(fetchedBuilding);
    
                const apartmentsResponse = await axios.get(`/aps/Apartments/${fetchedBuilding._id}`, {
                    headers: { Authorization: token },
                });
                setApartments(apartmentsResponse.data);
    
                const allPaymentsPromises = apartmentsResponse.data.map((apartment) =>
                    axios.get(`/api/payments/${apartment._id}`, {
                        headers: { Authorization: token },
                    }).catch(error => {
                        console.error(`Error fetching payments for apartment ${apartment._id}:`, error);
                        return { data: [] };
                    })
                );
    
                const allPaymentsResponses = await Promise.all(allPaymentsPromises);
                const allPayments = allPaymentsResponses.flatMap(response => response.data);
    
                setPayments(allPayments);
    
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        }
    
        fetchData();
    }, []);

    const deletePayment = async(paymentId) => {
        const confirmDelete = window.confirm("Are you sure you want to delete this payment?");
        if (!confirmDelete) {
            return;
        }
    
    try {
        const token = window.localStorage.getItem("token");
        const response = await axios.delete(`/api/payments/${paymentId}`, {
            headers: {Aythorization: token},
        });

        if (response.status === 200) {
            const updatedPayments = payments.filter(payment => payment._id  !== paymentId );
            setPayments(updatedPayments);
        } else {
            console.error('Failed to delete payment');
        }
    } catch(error) {
        console.error('Error deleting payment:' , error);
    }
}

    const markAsCompleted = async ( paymentId) => {
        const token = window.localStorage.getItem('token');
        try {
            const response = await axios.put(`/api/payments/${paymentId}`,{} , {
                headers : {Authorization : token}
            })
            //Update local state so the UI reflects the change without having to refresh or re=fetch all data.
            setPayments(prevPayments => 
                prevPayments.map(p => 
                    p._id === paymentId ? { ...p , payment_made : true} : p
                    )
                    );
                }catch(error) {
                    console.error("Failed to mark payment as Completed:" , error);
                }
        };


    
  return (
    <div className="container mt-5">
            <h1 className="mb-5">Payments</h1>
            <table className="table table-striped">
                <thead>
                    <tr>
                        <th>Apartment Name</th>
                        <th>Month</th>
                        <th>Year</th>
                        <th>Heating</th>
                        <th>Elevator</th>
                        <th>General</th>
                        <th>Payment Made</th>
                        <th> Action </th>
                    </tr>
                </thead>
                <tbody>
                    {payments.map(payment => {
                        const apartmentName = apartments.find(apt => apt._id === payment.apartment)?.name || 'Unknown';

                        return (
                            <tr key={payment._id}>
                                <td>{apartmentName}</td>
                                <td>{payment.month}</td>
                                <td>{payment.year}</td>
                                <td>{payment.total_heating.toFixed(2)}</td>
                                <td>{payment.total_elevator.toFixed(2)}</td>
                                <td>{payment.total_general.toFixed(2)}</td>
                                <td>{payment.payment_made ? 'Yes' : 'No'}</td>
                                <td>
                                    { payment.payment_made ? 
                                         <button onClick={() => deletePayment(payment._id)} className='btn btn-danger'>
                                            Delete
                                         </button>
                                         :
                                         <button onClick={() => markAsCompleted(payment._id)} className='btn btn-primary'>
                                            Tenant Payed
                                            </button>
                                            }
                                    
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
  )
}

export default ViewPayment
