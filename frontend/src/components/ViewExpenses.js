import React, { useState , useEffect } from 'react'
import 'bootstrap/dist/css/bootstrap.min.css';
import axios from 'axios';
function ViewExpenses() {
    const [expenses , setExpenses] = useState([]);
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
    const fetchExpenses = async() => {
      try {
        const token = window.localStorage.getItem('token');
        const response = await axios.get('http://localhost:5000/api/profile', {
          headers: {Authorization: token},
        });
        console.log(response.data.userId);
        if(response.data.userId) {
          //If true give me the expenses he's admin to 
          const expensesResponse = await axios.get(
            `http://localhost:5000/api/expenses/${response.data.userId}`
          );
          const fetchedExppenses = expensesResponse.data;
          console.log(fetchedExppenses)
          setExpenses(fetchedExppenses|| []);

        }

      }catch(error) {
        console.log(error);
      }
    };
    fetchExpenses();
  }, []);

  //Log the length of expenses array just before rendering
  console.log('Apartments Array length:' , expenses.length);
     
  return (
    <div>
      <div className='container'>
        <h2 className='text-center'> View Building Expenses </h2>
        <table className='table'>
            <thead>
                <tr>
                    <th>Expense Type</th>
                    <th>Total</th>
                    <th>Date Created</th>
                    <th>Month</th>
                    <th>Year</th>
                </tr>
            </thead>
            <tbody>
              {expenses.length > 0 ? (
                expenses.map((expense) =>(
                  <tr key={expense._id}>
                    <td>{expense.type_expenses}</td> 
                    <td>{expense.total}</td>
                    <td>{new Date(expense.date_created).toLocaleDateString()}</td>
                    {/* Represent the months as words based on the key , value pair */}
                    <td>{months.find(month => month.value === expense.month)?.label}</td>
                    <td>{expense.year}</td>
                  </tr>
                ))
              ) : (
                <tr>
                <td colSpan='5' className='no-expenses'> No expenses tied to this building...</td>
                </tr>
              )}
            </tbody>
        </table>
      </div>
    </div>
  )
}

export default ViewExpenses
