import React, { useEffect, useState } from 'react';
import '../css/userList.css';
const UserList = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // Fetch the list of users from the server
    fetch('/api/users')
      .then((response) => response.json())
      .then((data) => setUsers(data))
      .catch((error) => console.error(error));
  }, []);

  return (
    <div>
      <h2>User List</h2>
      <table className='user-table'>
      <thead>
          <tr>
            <th>id</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserList;