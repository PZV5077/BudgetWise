require('dotenv').config();
const { Client } = require('@duosecurity/duo_universal');
const client = new Client({
    clientId: process.env.DUO_CLIENT_ID,
    clientSecret: process.env.DUO_CLIENT_SECRET,
    apiHost: process.env.DUO_API_HOSTNAME,
    redirectUrl: 'http://localhost:3000/login.html'
});
const state = client.generateState();
const url = client.createAuthUrl('alice', state);
console.log('Type of url:', typeof url);
console.log('Is Promise?', url instanceof Promise);
console.log('Value:', url);
