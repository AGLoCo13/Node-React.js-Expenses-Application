const Building = require("../models/building");
const Apartment = require('../models/apartment');


//Create an apartment building 
const createApartmentBuilding = async (req, res) => {
    try {
        const {profile, address,floors, apartments, reserve } = req.body;

        //Create a new building instance
        const building = new Building({
            profile,
            address,
            floors,
            apartments,
            reserve,
        });
        //Save the building to the database
        await building.save();

        res.status(200).json({message:'Apartment building created succesfully',building});
    }catch (error) {
        console.error(error);
        res.status(500).json({error: 'Failed to create apartment building'});
    }
};
// Update an apartment building
const updateApartmentBuilding = async (req, res) => {
    try {
      const { id } = req.params;
      const updatedData = req.body;
  
      // Find the building by ID and update its data
      const building = await Building.findByIdAndUpdate(id, updatedData, { new: true });
  
      if (!building) {
        return res.status(404).json({ message: 'Apartment building not found' });
      }
  
      res.status(200).json({ message: 'Apartment building updated successfully', building });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update apartment building' });
    }
  };
  
  // Delete an apartment building
  const deleteApartmentBuilding = async (req, res) => {
    try {
      const { id } = req.params;
  
      // Find the building by ID and remove it
      const building = await Building.findByIdAndRemove(id);
  
      if (!building) {
        return res.status(404).json({ message: 'Apartment building not found' });
      }
  
      res.status(200).json({ message: 'Apartment building deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete apartment building' });
    }
  };
  
// Create a new apartment
const createApartment = async (req, res) => {
    try {
      const { building, tenant, floor, square_meters, owner, fi, heating, elevator, general_expenses } = req.body;
  
      // Create a new apartment instance
      const newApartment = new Apartment({
        building,
        tenant,
        floor,
        square_meters,
        owner,
        fi,
        heating,
        elevator,
        general_expenses,
      });
  
      // Save the new apartment to the database
      await newApartment.save();
  
      res.status(201).json({ message: 'Apartment created successfully', apartment: newApartment });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create apartment' });
    }
  };
  
  // Get all apartments
  const getAllApartments = async (req, res) => {
    try {
      const apartments = await Apartment.find()
      .populate('building','address')
      .populate({
        path:'tenant',
        populate:{
          path:'user',
          select: 'name',
        },
      });
      res.status(200).json({ apartments });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to retrieve apartments' });
    }
  };
  
  // Get a specific apartment by ID
  const getApartmentById = async (req, res) => {
    try {
      const apartmentId = req.params.id;
      const apartment = await Apartment.findById(apartmentId);
  
      if (!apartment) {
        return res.status(404).json({ message: 'Apartment not found' });
      }
  
      res.status(200).json({ apartment });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to retrieve apartment' });
    }
  };
  
  // Update an apartment
  const updateApartment = async (req, res) => {
    try {
      const apartmentId = req.params.id;
      const { building, tenant, floor, square_meters, owner, fi, heating, elevator, general_expenses } = req.body;
  
      const updatedApartment = await Apartment.findByIdAndUpdate(
        apartmentId,
        {
          building,
          tenant,
          floor,
          square_meters,
          owner,
          fi,
          heating,
          elevator,
          general_expenses,
        },
        { new: true }
      );
  
      if (!updatedApartment) {
        return res.status(404).json({ message: 'Apartment not found' });
      }
  
      res.status(200).json({ message: 'Apartment updated successfully', apartment: updatedApartment });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update apartment' });
    }
  };
  
  // Delete an apartment
  const deleteApartment = async (req, res) => {
    try {
      const apartmentId = req.params.id;
      const deletedApartment = await Apartment.findByIdAndDelete(apartmentId);
  
      if (!deletedApartment) {
        return res.status(404).json({ message: 'Apartment not found' });
      }
  
      res.status(200).json({ message: 'Apartment deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete apartment' });
    }
  };
  
 module.exports = {
    createApartmentBuilding,
    updateApartmentBuilding,
    deleteApartmentBuilding,
    createApartment,
    getApartmentById,
    getAllApartments,
    updateApartment,
    deleteApartment
 };


 //MAY INPLEMENT MORE FUNCTIONS SUCH AS getAllBuildings etc... 