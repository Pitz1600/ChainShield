const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    // SECURITY: Enable TLS for production MongoDB connections
    if (process.env.MONGODB_TLS === 'true') {
      options.tls = true;
      options.tlsAllowInvalidCertificates = process.env.MONGODB_TLS_ALLOW_INVALID === 'true';
      if (process.env.MONGODB_TLS_CA_FILE) {
        options.tlsCAFile = process.env.MONGODB_TLS_CA_FILE;
      }
    }

    await mongoose.connect(process.env.MONGODB_URI, options);
    console.log('MongoDB Connected Successfully');
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;