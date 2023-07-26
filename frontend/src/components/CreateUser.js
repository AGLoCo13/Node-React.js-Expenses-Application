import React, { useState } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';

function CreateUser() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [cellphone,setCellphone] = useState('');
  const [role, setRole] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Send a request to create a new user
    try {
      await axios.post('/api/register', 
      { name,
        email,
        password,
        address,
        cellphone,
        role,
    });
      
      console.log(response.data); //Handle the response as needed
    } catch (error) {
      console.error(error);
      //Handle any error during registration
    }
  };

  return (
    <div>
    <h1>Create User</h1>
    <form onSubmit={handleSubmit}>
      <label>
        Name:
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <br />
      <label>
        Email:
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <br />
      <label>
        Password:
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <br />
      <label>
        Address:
        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      <br />
      <label>
        Cellphone:
        <input type="text" value={cellphone} onChange={(e) => setCellphone(e.target.value)} />
      </label>
      <br />
      <label>
        Role:
        <input type="text" value={role} onChange={(e) => setRole(e.target.value)} />
      </label>
      <br />
      <button type="submit">Create User</button>
    </form>
  </div>
  );
}

export default CreateUser;