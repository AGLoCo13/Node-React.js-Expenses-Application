const Payment = require('../models/payment')
const Apartment = require('../models/apartment')
const jwt = require('jsonwebtoken');
//Create a payment
const createPayment = async (req , res ) => {
    try {
        const {apartment , month , year , total_heating , total_elevator , total_general , payment_made} = req.body;

        //Create a new payment instance 
        const payment = new Payment ({
            apartment,
            month , 
            year , 
            total_heating,
            total_elevator,
            total_general , 
            payment_made,

        });
        //Save the payment to the database 
        await payment.save();

        res.status(200).json({message: "Payment Created successfully", payment});
    }catch(error) {
        console.error(error);
        res.status(500).json({error: 'Failed to create payment'});
    }
    }


//Delete a payment 
const deletePayment = async (req , res ) => {
    try {
        const { id } = req.params;

        //Find the payment by ID and remove it 
        const payment = await Payment.findByIdAndDelete(id);

        if ( !payment ) {
            return res.status(404).json({message: 'Payment not found'});

        }
        res.status(200).json({message: "Payment deleted succesfully"});
    } catch(error) {
        console.error(error);
        res.status(500).json({error: "Failed to delete Payment"});
    }
}
//Handler to mark a payment as completed 
const markPaymentAsCompleted = async (req , res) => {
    try {
        const {paymentId} = req.params;

        //find the pament and update payment_made to true
        const updatedPayment = await Payment.findByIdAndUpdate(paymentId,{payment_made: true} , {new: true});
            if (!updatedPayment) {
                return res.status(404).json({error: 'Payment not found'})
            }
            res.status(200).json(updatedPayment);
        }catch(error){
            console.error(error);
            res.status(500).json({error:'Failed to update payment'});

        }
    }
    


    

module.exports = {
    createPayment,
    deletePayment,
    markPaymentAsCompleted
}