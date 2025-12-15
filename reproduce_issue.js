const BASE_URL = 'http://localhost:3000/api/users';
const USERNAME = `testuser_${Date.now()}`;
const PASSWORD = 'Password123&WithAmpersand';
const EMAIL = `${USERNAME}@example.com`;

async function reproduceIssue() {
    try {
        console.log('1. Registering user...');
        const registerResponse = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: USERNAME,
                email: EMAIL,
                password: PASSWORD
            })
        });

        if (!registerResponse.ok) {
            throw new Error(`Registration failed: ${await registerResponse.text()}`);
        }
        console.log('User registered successfully.');

        console.log('2. Attempting login...');
        const loginResponse = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: EMAIL,
                password: PASSWORD
            })
        });

        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${await loginResponse.text()}`);
        }

        const data = await loginResponse.json();
        console.log('Login successful!', data.message);
        if (data.accessToken) {
            console.log('Access token received.');
        }
    } catch (error) {
        console.error('An error occurred:', error.message);
        process.exit(1);
    }
}

reproduceIssue();
