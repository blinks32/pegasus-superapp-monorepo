const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config', 'app-config.json');
const secretsPath = path.join(__dirname, '..', 'config', 'app-secrets.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
let secrets = {};
if (fs.existsSync(secretsPath)) {
    secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
}

const projects = [
    { name: 'Rider', path: path.join(__dirname, '..', 'Rider', 'src', 'environments') },
    { name: 'Driver', path: path.join(__dirname, '..', 'Driver', 'src', 'environments') },
    { name: 'Admin', path: path.join(__dirname, '..', 'Admin', 'src', 'environments') }
];

function updateEnvironmentFile(project, isProduction) {
    const filePath = path.join(project.path, isProduction ? 'environment.prod.ts' : 'environment.ts');
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');

    // Update Firebase
    content = content.replace(/firebase:\s*{[\s\S]*?}/, `firebase: ${JSON.stringify(config.firebase, null, 8).replace(/"/g, "'")}`);

    // Update OneSignal (Merge config and secrets)
    const oneSignalConfig = {
        appId: config.onesignal.appId,
        restApiKey: secrets.onesignal?.restApiKey || config.onesignal.restApiKey || '',
        android_channel_id: config.onesignal.androidChannelId || ''
    };
    content = content.replace(/onesignal:\s*{[\s\S]*?}/, `onesignal: ${JSON.stringify(oneSignalConfig, null, 8).replace(/"/g, "'")}`);

    // Update URLs and other keys
    const urlRegex = /serverUrl:\s*['"].*?['"]/;
    content = content.replace(urlRegex, `serverUrl: '${config.payment.serverUrl}'`);

    const stripeKeyRegex = /stripePublishableKey:\s*['"].*?['"]/;
    content = content.replace(stripeKeyRegex, `stripePublishableKey: '${config.payment.stripePublishableKey}'`);

    const apiKeyRegex = /apiKey:\s*['"].*?['"]/;
    content = content.replace(apiKeyRegex, `apiKey: '${config.googleMaps.apiKey}'`);

    // Update production flag
    content = content.replace(/production:\s*(true|false)/, `production: ${isProduction}`);

    // Update Default Login (Test Mode)
    const appKey = project.name.toLowerCase();
    const appDefaultLogin = config.defaultLogin?.[appKey] || { enabled: false };
    content = content.replace(/defaultLogin:\s*{[\s\S]*?}/, `defaultLogin: ${JSON.stringify(appDefaultLogin, null, 8).replace(/"/g, "'")}`);

    fs.writeFileSync(filePath, content);
    console.log(`Updated: ${filePath}`);
}

// Update Angular Projects
projects.forEach(project => {
    updateEnvironmentFile(project, false);
    updateEnvironmentFile(project, true);
});

// Update Payment Server .env
const envPath = path.join(__dirname, '..', 'PaymentServer', '.env');
const envContent = `STRIPE_SECRET_KEY=${secrets.payment?.stripeSecretKey || ''}
ONE_SIGNAL_APP_ID=${config.onesignal.appId}
ONE_SIGNAL_API_KEY=${secrets.onesignal?.restApiKey || ''}
PAYSTACK_SECRET_KEY=${secrets.payment?.paystackSecretKey || ''}
FLUTTERWAVE_SECRET_KEY=${secrets.payment?.flutterwaveSecretKey || ''}
RAZORPAY_KEY_ID=${secrets.payment?.razorpayKeyId || ''}
RAZORPAY_KEY_SECRET=${secrets.payment?.razorpayKeySecret || ''}
`;

fs.writeFileSync(envPath, envContent);
console.log(`Updated: ${envPath}`);

console.log('Sync complete!');
