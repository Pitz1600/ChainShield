const mongoose = require('mongoose');

const connectDB = async () => {
  const maxRetries = 5;
  const retryDelay = 5000; // 5 seconds
  let retries = 0;

  const attemptConnection = async () => {
    try {
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      };

      // SECURITY: Enable TLS for production MongoDB connections
      if (process.env.MONGODB_TLS === 'true') {
        options.tls = true;
        options.tlsAllowInvalidCertificates = process.env.MONGODB_TLS_ALLOW_INVALID === 'true';
        if (process.env.MONGODB_TLS_CA_FILE) {
          options.tlsCAFile = process.env.MONGODB_TLS_CA_FILE;
        }
      }

      console.log(`[${new Date().toISOString()}] Attempting MongoDB connection...`);
      await mongoose.connect(process.env.MONGODB_URI, options);
      console.log('[MongoDB] Connected Successfully');
      return true;
    } catch (error) {
      retries++;
      console.error(`[MongoDB] Connection attempt ${retries}/${maxRetries} failed:`, error.message);
      
      if (retries < maxRetries) {
        console.log(`[MongoDB] Retrying in ${retryDelay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return attemptConnection();
      } else {
        console.error('[MongoDB] Max retries exceeded. Exiting.');
        process.exit(1);
      }
    }
  };

  return attemptConnection();
};

module.exports = connectDB;