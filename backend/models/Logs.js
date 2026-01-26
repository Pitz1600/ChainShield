const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  user: {
    type:String,  
    required: true,
  },
  userRole: {
    type:String,
    required: true,
  },
  email: {
    type:String,
    required: true,
  }
  action:{
    type:String,
    required: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('Log', logSchema);
