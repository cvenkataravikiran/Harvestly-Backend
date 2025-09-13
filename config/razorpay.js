// Razorpay Configuration
const getRazorpayConfig = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.warn('⚠️  Razorpay API keys not configured. Payment features will be disabled.');
    console.warn('   To enable payments, set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file');
    return null;
  }

  return {
    key_id: keyId,
    key_secret: keySecret
  };
};

module.exports = {
  getRazorpayConfig,
  isConfigured: () => {
    return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  }
}; 