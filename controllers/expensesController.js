const Expense = require('../models/expenses.js');

// Create a new expense
const createExpense = async (req, res) => {
  try {
    // Retrieve the necessary data from the request body
    const { profile, total, date_created, document, month, year, type_expenses } = req.body;

    // Create a new expense instance
    const expense = new Expense({
      profile,
      total,
      date_created,
      document,
      month,
      year,
      type_expenses
    });

    // Save the expense to the database
    const savedExpense = await expense.save();

    res.status(201).json(savedExpense);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create a new expense' });
  }
};

// Retrieve all expenses
const getAllExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find();
    res.json(expenses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve expenses' });
  }
};

// Update an expense
const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { total, date_created, document, month, year, type_expenses } = req.body;

    const updatedExpense = await Expense.findByIdAndUpdate(
      id,
      { total, date_created, document, month, year, type_expenses },
      { new: true }
    );

    if (!updatedExpense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(updatedExpense);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update the expense' });
  }
};

// Delete an expense
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedExpense = await Expense.findByIdAndRemove(id);

    if (!deletedExpense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(deletedExpense);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete the expense' });
  }
};

module.exports = {
  createExpense,
  getAllExpenses,
  updateExpense,
  deleteExpense
};

//NEED TO IMPLEMENT AN INTELLIGENCE FOR THE CALCULATION OF EXPENSES