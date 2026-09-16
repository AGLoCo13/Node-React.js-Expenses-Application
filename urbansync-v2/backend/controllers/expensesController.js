const Expense = require('../models/expenses.js');
const {extractReceiptData} = require('../services/aiService.js');
const { extractViaKnative, TIMEOUT_MS: KNATIVE_TIMEOUT_MS } = require('../services/knativeService');
const cloudService = require('../services/cloudService');

const createExpense = async (req, res) => {
  let documentData = null;
  let documentMetadata = null;
  const bucketName = process.env.MINIO_BUCKET || 'receipts';
  let uploadResult = null;

  try {
    const { profile, total, date_created, month, year, type_expenses } = req.body;

    if (req.file && req.file.buffer) {
      const fileName = `${Date.now()}-${req.file.originalname}`;
      uploadResult = await cloudService.uploadToMinIO(fileName, req.file.buffer, {
        'Content-Type': req.file.mimetype
      });

      documentData = fileName;
      documentMetadata = {
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        uploadedAt: new Date()
      };
    }

    const expense = new Expense({
      profile, total, date_created,
      document: documentData,
      documentBucket: bucketName,
      documentMetadata,
      month, year, type_expenses
    });

    const savedExpense = await expense.save();

    const response = {
      ...savedExpense.toObject(),
      receiptInfo: uploadResult ? {
        uploaded: true, filename: documentData, url: uploadResult.url, bucket: bucketName
      } : null
    };
    res.status(201).json(response);

  } catch (error) {
    console.error(error);

    // PATTERN: COMPENSATING LOGIC — το MinIO upload πέτυχε αλλά κάτι μετά
    // (validation/save στο Mongo) απέτυχε. Χωρίς αυτό, κάθε τέτοια αποτυχία
    // αφήνει για πάντα ένα ορφανό object στο bucket.
    if (documentData) {
      try {
        await cloudService.deleteFromMinIO(bucketName, documentData);
        console.warn(`[createExpense] Compensated: rolled back MinIO object ${documentData} after save failure`);
      } catch (compErr) {
        console.error(`[createExpense] Compensating delete FAILED for ${documentData} — orphan left in ${bucketName}:`, compErr.message);
      }
    }

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

//Συναρτηση για το ΑΙ εξαγωγής δεδομένων από την απόδειξη
const extractDataFromReceipt = async (req, res) => {
  if(!req.file) {
    return res.status(400).json({ message: "No receipt file provided" });
  }

  try {
    //Στελνουμε το αρχειο στο ΑΙ
    const extractedData = await extractReceiptData(req.file.buffer, req.file.mimetype);
    res.status(200).json(extractedData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to extract data from receipt' });
  }
}


// Serverless path — forwards the receipt to the Knative Service `receipt-annotator`.
// Used by POST /api/expenses/knative-extract (the button in the UI).
// The legacy extractDataFromReceipt above calls Gemini directly from the backend and
// stays available on /api/expenses/extract-receipt-data as a documented fallback.
const extractDataViaKnative = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No receipt file provided" });
  }

  try {
    const { data, elapsedMs, coldStartSuspected } =
      await extractViaKnative(req.file.buffer, req.file.mimetype, req.file.originalname);

    // Observability headers — visible in the browser's network tab during the demo.
    res.set('X-Extraction-Backend', 'knative');
    res.set('X-Extraction-Ms', String(elapsedMs));
    res.set('X-Extraction-Cold-Start', coldStartSuspected ? 'suspected' : 'no');
    return res.status(200).json(data);
  } catch (error) {
    if (error.circuitOpen) {
      console.warn('[Knative] circuit OPEN — answering 503');
      return res.status(503).json({
        error: 'AI extraction temporarily unavailable',
        detail: 'receipt-annotator circuit is OPEN; retry shortly',
        retryAfterSeconds: 30,
      });
    }
    if (error.timeout) {
      console.error('[Knative] timeout:', error.message);
      return res.status(504).json({ error: 'AI extraction timed out', detail: error.message,
                                    timeoutMs: KNATIVE_TIMEOUT_MS });
    }
    if (error.status === 504) {
      // Knative's own revision timeout (kservice timeoutSeconds) fired before ours.
      return res.status(504).json({ error: 'AI extraction timed out inside the serverless tier', detail: error.detail });
    }
    if (error.status && error.status < 500) {
      return res.status(error.status).json({ error: 'receipt-annotator rejected the request', detail: error.detail });
    }
    console.error('[Knative] extraction failed upstream:', error.message, error.detail || '');
    return res.status(502).json({ error: 'AI extraction failed upstream', detail: error.detail || error.message });
  }
}

module.exports = {
  createExpense,
  getAllExpenses,
  updateExpense,
  deleteExpense,
  extractDataFromReceipt,
  extractDataViaKnative
};