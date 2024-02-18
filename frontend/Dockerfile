# Use an official Node runtime as a parent image
FROM node:14

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to work directory
COPY package*.json ./

# Install any needed packages specified in package.json
RUN npm install

# Bundle the source code inside the Docker image
COPY . .

# Build the React application
RUN npm run build

# Install serve to serve the build folder on port 3000
RUN npm install -g serve
CMD ["serve", "-s", "build", "-l", "3000"]

# Make port 3000 available to the world outside this container
EXPOSE 3000