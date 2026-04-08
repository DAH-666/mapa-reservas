// ==========================================
// CONFIGURACIÓN PRINCIPAL
// ==========================================
const GOOGLE_CLIENT_ID = '521209969592-0c3dhj0gp8sjt00nt8v12i9p0rm1a607.apps.googleusercontent.com'; 
const ALLOWED_DOMAINS = ['@mapastudios', '@rimasmusic', '@melodias']; 

const CENTRAL_CALENDAR_ID = 'booking.madrid@mapastudios.com'; 
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxdo2VYgXk9dnPg0G1A3tp1K-b2EdK-kJBsTBcK8Gm6LJCBxdZPb613N-Ee8vXq4bnQ1w/exec'; 

// ==========================================
// Lógica de UI e Inicialización
// ==========================================
const dateInput = document.getElementById('bookingDate');
const today = new Date().toISOString().split('T')[0];
dateInput.setAttribute('min', today);

let tokenClient;
let gapiAccessToken = null;
let currentUserInfo = null;

const loginSection = document.getElementById('loginSection');
const bookingForm = document.getElementById('bookingForm');
const userEmailDisplay = document.getElementById('userEmail');
const userInitialDisplay = document.getElementById('userInitial');
const loginError = document.getElementById('loginError');

window.onload = function () {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
        callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                await validateUser(tokenResponse.access_token);
            }
        },
    });
};

async function validateUser(token) {
    loginError.classList.add('hidden');
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const userInfo = await response.json();

        const userEmail = userInfo.email.toLowerCase();
        const hasAccess = ALLOWED_DOMAINS.some(domain => userEmail.includes(domain));

        if (!hasAccess && GOOGLE_CLIENT_ID !== 'TU_CLIENT_ID_AQUI.apps.googleusercontent.com') {
            loginError.innerHTML = `<i class="fa-solid fa-lock mr-1"></i> Acceso denegado. Usa una cuenta corporativa autorizada.`;
            loginError.classList.remove('hidden');
            google.accounts.oauth2.revoke(token, () => {});
            gapiAccessToken = null;
            currentUserInfo = null;
        } else {
            gapiAccessToken = token;
            currentUserInfo = userInfo;
            showBookingForm(userInfo);
        }
    } catch (error) {
        console.error("Error validando usuario:", error);
        loginError.textContent = "Error al verificar la cuenta de Google.";
        loginError.classList.remove('hidden');
    }
}

document.getElementById('googleLoginBtn').addEventListener('click', () => {
    if (GOOGLE_CLIENT_ID === 'TU_CLIENT_ID_AQUI.apps.googleusercontent.com') {
        alert("Modo Simulación: Como no has ingresado un GOOGLE_CLIENT_ID real, pasaremos directamente al formulario.");
        gapiAccessToken = "SIMULATED_TOKEN";
        currentUserInfo = { name: "Manager", email: "manager@mapastudios.com", picture: "" };
        showBookingForm(currentUserInfo);
        return;
    }
    tokenClient.requestAccessToken({prompt: 'consent'});
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    if (gapiAccessToken && gapiAccessToken !== "SIMULATED_TOKEN") {
        google.accounts.oauth2.revoke(gapiAccessToken, () => {});
    }
    gapiAccessToken = null;
    currentUserInfo = null;
    bookingForm.classList.add('hidden');
    loginSection.classList.remove('hidden');
    loginError.classList.add('hidden');
});

function showBookingForm(userInfo) {
    loginSection.classList.add('hidden');
    bookingForm.classList.remove('hidden');
    userEmailDisplay.textContent = userInfo.email; 
    if (userInfo.picture) {
        userInitialDisplay.innerHTML = `<img src="${userInfo.picture}" class="w-full h-full rounded-full border-2 border-indigo-400
