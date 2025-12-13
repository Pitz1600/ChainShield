const Alert = require('../models/Alert');

exports.getAlerts = async (req, res) => {
  try {
    const { status, severity, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (severity) query.severity = severity;
    
    const alerts = await Alert.find(query)
      .populate('transactionId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await Alert.countDocuments(query);
    
    res.json({
      alerts,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateAlertStatus = async (req, res) => {
  try {
    const { status, assignedTo } = req.body;
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status, assignedTo },
      { new: true }
    );
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAlertStats = async (req, res) => {
  try {
    const stats = await Alert.aggregate([
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const statusStats = await Alert.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({ severityStats: stats, statusStats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};