const Case = require('../models/Case');

exports.createCase = async (req, res) => {
  try {
    const caseNumber = `CASE-${Date.now()}`;
    const newCase = new Case({
      ...req.body,
      caseNumber
    });
    
    await newCase.save();
    res.status(201).json(newCase);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getCases = async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    
    const cases = await Case.find(query)
      .populate('assignedTo', 'username email')
      .populate('alerts')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await Case.countDocuments(query);
    
    res.json({
      cases,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addNote = async (req, res) => {
  try {
    const { content } = req.body;
    const caseDoc = await Case.findById(req.params.id);
    
    if (!caseDoc) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    caseDoc.notes.push({
      content,
      author: req.user.id,
      timestamp: new Date()
    });
    
    await caseDoc.save();
    res.json(caseDoc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};