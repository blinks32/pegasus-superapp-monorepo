require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const axios = require('axios');
const Razorpay = require('razorpay');
const OneSignal = require('@onesignal/node-onesignal');

const ONE_SIGNAL_APP_ID = process.env.ONE_SIGNAL_APP_ID;
const ONE_SIGNAL_API_KEY = process.env.ONE_SIGNAL_API_KEY;

const app_key_provider = {
  getToken() {
    return ONE_SIGNAL_API_KEY;
  }
};

const configuration = OneSignal.createConfiguration({
  authMethods: {
    app_key: {
      tokenProvider: app_key_provider
    }
  }
});
const oneSignalClient = new OneSignal.DefaultApi(configuration);

const app = express();
const port = process.env.PORT || 3000;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'your_razorpay_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_razorpay_secret_key',
});

// Use CORS middleware
app.use(cors({
  origin: 'http://localhost:8101' // Rplace with your client's origin
}));

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Payment Server is running');
});

// Stripe setup-intent route
app.post('/setup-intent', async (req, res) => {
  try {
    const { email } = req.body;

    let customer = await stripe.customers.list({ email: email, limit: 1 });
    if (customer.data.length === 0) {
      customer = await stripe.customers.create({
        email: email,
      });
    } else {
      customer = customer.data[0];
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
    });

    res.status(200).send({ client_secret: setupIntent.client_secret });
  } catch (error) {
    console.error('Stripe Error:', error);
    res.status(500).send({ error: error.message || error.toString() });
  }
});

// Stripe retrieve payment method route
app.post('/retrieve-payment-method', async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    res.status(200).send(paymentMethod);
  } catch (error) {
    console.error('Stripe Error:', error);
    res.status(500).send({ error: error.message || error.toString() });
  }
});

app.post('/save-payment-method', async (req, res) => {
  try {
    const { email, paymentMethodId } = req.body;
    console.log(`Saving payment method for email: ${email}, paymentMethodId: ${paymentMethodId}`);

    let customer = await stripe.customers.list({ email: email, limit: 1 });
    if (customer.data.length === 0) {
      console.log('Customer does not exist. Creating a new customer.');
      customer = await stripe.customers.create({
        email: email,
      });
    } else {
      customer = customer.data[0];
      console.log(`Customer found: ${customer.id}`);
    }

    const paymentMethod = await stripe.paymentMethods.attach(
      paymentMethodId,
      { customer: customer.id }
    );

    console.log(`Payment method saved: ${paymentMethod.id}`);
    res.status(200).send({ paymentMethodId: paymentMethod.id });
  } catch (error) {
    console.error('Stripe Error:', error);
    res.status(500).send({ error: error.message || error.toString() });
  }
});

app.post('/check-card-exists', async (req, res) => {
  try {
    const { email, last4 } = req.body;
    console.log(`Checking if card exists for email: ${email}, last4: ${last4}`);

    let customer = await stripe.customers.list({ email: email, limit: 1 });
    if (customer.data.length === 0) {
      console.log('Customer does not exist.');
      return res.status(200).send({ exists: false });
    }

    customer = customer.data[0];
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      type: 'card',
    });

    const cardExists = paymentMethods.data.some((method) => method.card.last4 === last4);
    console.log(`Card exists: ${cardExists}`);

    res.status(200).send({ exists: cardExists });
  } catch (error) {
    console.error('Stripe Error:', error);
    res.status(500).send({ error: error.message || error.toString() });
  }
});

// Stripe payment route
app.post('/pay/stripe', async (req, res) => {
  const { amount, currency, paymentMethodId, customerId } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method: paymentMethodId,
      customer: customerId,
      off_session: true,
      confirm: true,
    });

    res.status(200).send(paymentIntent);
  } catch (error) {
    console.error('Stripe Error:', error);
    res.status(500).send({ error: error.message || error.toString() });
  }
});

// Paystack payment route
app.post('/pay/paystack', async (req, res) => {
  const { email, amount, currency, authorizationCode } = req.body;

  try {
    let response;
    if (authorizationCode) {
      // Use saved authorization code for subsequent charge
      response = await axios.post('https://api.paystack.co/transaction/charge_authorization', {
        email,
        amount,
        currency,
        authorization_code: authorizationCode,
      }, {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      });
    } else {
      // Initialize transaction and get authorization code for the first time
      response = await axios.post('https://api.paystack.co/transaction/initialize', {
        email,
        amount,
        currency,
        callback_url: 'http://localhost:8101/paymentcallback'
      }, {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      });

      const { authorization_url, reference } = response.data.data;
      res.status(200).send({ url: authorization_url, reference });
      return;
    }

    res.status(200).send(response.data);
  } catch (error) {
    console.error('Paystack Error:', error);
    res.status(500).send({ error: error.message || error.toString() });
  }
});

// Paystack verification route
app.get('/paystack/verify/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      }
    });

    res.status(200).send(response.data);
  } catch (error) {
    console.error('Paystack Verification Error:', error);
    res.status(500).send({ error: error.message || error.toString() });
  }
});

// Flutterwave payment route
app.post('/pay/flutterwave', async (req, res) => {
  const { email, amount, currency, token } = req.body;

  try {
    let response;
    if (token) {
      // Use saved token for subsequent charge
      response = await axios.post('https://api.flutterwave.com/v3/tokenized-charges', {
        token,
        amount,
        currency,
        email
      }, {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`
        }
      });
    } else {
      // Initialize transaction and get payment link for the first time
      response = await axios.post('https://api.flutterwave.com/v3/payments', {
        tx_ref: `tx-${Date.now()}`,
        amount,
        currency,
        redirect_url: 'http://localhost:8101/paymentcallback',
        customer: {
          email,
        },
        customizations: {
          title: 'Payment for Ride Booking',
          description: 'Ride booking payment',
        },
      }, {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`
        }
      });

      res.status(200).send({ link: response.data.data.link });
      return;
    }

    res.status(200).send(response.data);
  } catch (error) {
    handlePaymentError(error, res);
  }
});

// Razorpay payment route
app.post('/pay/razorpay', async (req, res) => {
  const { amount, currency, receipt, paymentMethodId } = req.body;

  try {
    let response;
    if (paymentMethodId) {
      // Capture payment for subsequent charge
      response = await razorpay.payments.capture(paymentMethodId, amount, currency);
    } else {
      // Create order for the first time
      const options = {
        amount,
        currency,
        receipt,
      };
      response = await razorpay.orders.create(options);
    }

    res.status(200).send(response);
  } catch (error) {
    handlePaymentError(error, res);
  }
});

function handlePaymentError(error, res) {
  if (error.response) {
    console.error('Payment Error Response:', error.response.data);
    res.status(500).send({ error: error.response.data.message || error.response.data });
  } else if (error.request) {
    console.error('Payment Error Request:', error.request);
    res.status(500).send({ error: 'Request to payment gateway failed.' });
  } else {
    console.error('Payment Error Message:', error.message);
    res.status(500).send({ error: error.message || 'An unexpected error occurred.' });
  }
}

// OneSignal Notification Route
app.post('/send-notification', async (req, res) => {
  const { message, playerIds, headings } = req.body;

  try {
    const notification = new OneSignal.Notification();
    notification.app_id = ONE_SIGNAL_APP_ID;
    notification.contents = {
      en: message || 'Default Notification Message',
    };
    if (headings) {
      notification.headings = {
        en: headings,
      }
    }

    if (playerIds && playerIds.length > 0) {
      notification.include_player_ids = playerIds;
    } else {
      // If no specific players, maybe send to all? Or just fail? 
      // For safety, let's default to a segment if needed, or just require playerIds.
      // notification.included_segments = ['All']; 
      // For now, let's just log a warning if no targets are specified, but proceed (OneSignal might handle "All" if nothing specified, or error out).
      // Better to be explicit.
      notification.included_segments = ['All'];
    }

    const response = await oneSignalClient.createNotification(notification);
    console.log('OneSignal Notification sent:', response);
    res.status(200).send(response);
  } catch (error) {
    console.error('OneSignal Error:', error);
    res.status(500).send({ error: error.message || error.toString() });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app;
