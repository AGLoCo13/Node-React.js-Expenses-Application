import React, { useState } from 'react';
import axios from 'axios';

const UpdateUser = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [cellphone, setCellphone] = useState('');

  const handleUpdate = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token'); // Get the JWT token from localStorage
      const config = {
        headers: {
          Authorization: token, // Pass the token in the request headers
        },
      };

      const data = {
        name,
        email,
        address,
        cellphone,
      };

      // Send a PUT request to update the user's profile
      const response = await axios.put('/api/profile', data, config);

      console.log(response.data); // Log the response data
      // You can handle the success response here (e.g., show a success message)
    } catch (error) {
      console.error(error);
      // You can handle the error response here (e.g., show an error message)
    }
  };

  return (
    <form onSubmit={handleUpdate}>
      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="text"
        placeholder="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <input
        type="text"
        placeholder="Cellphone"
        value={cellphone}
        onChange={(e) => setCellphone(e.target.value)}
      />
      <button type="submit">Update Profile</button>
    </form>
  );
};

export default UpdateUser;