const Payment = require('../models/payment')

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

        if ( !building ) {
            return res.status(404).json({message: 'Payment not found'});

        }
        res.status(200).json({message: "Payment deleted succesfully"});
    } catch(error) {
        console.error(error);
        res.status(500).json({error: "Failed to delete Payment"});
    }
}

module.exports = {
    createPayment,
    deletePayment,
}