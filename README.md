# Node-React.js-Expenses-Application
1.Prerequisities:
You have to install : 
-Node.js(preferably the latest LTS version)
-MongoDB running locally

2.Setup and installation 
-Clone the repository:
  git clone https://github.com/AGLoCo13/Node-React.js-Expenses-Application.git
  
  cd Expenses-Application

#install backend dependecies
cd backend

npm install

#move to frontend directory and install dependecies 
(Assuming you are on the frontend directory)
cd.. 

cd frontend

npm install

3.MongoDB configuration
Ensure that MongoDB is running locally. By Default the application tries to connect to `mongodb://127.0.0.1:27017/commons-db`

4.Running the application
-Navigate to backend directory:

cd backend

npm run dev

-Navigate to frontend directory:

cd frontend 

npm start
