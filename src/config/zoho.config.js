import dotenv from "dotenv";
dotenv.config();

export const zohoConfig = {
  accountsUrl: "https://accounts.zoho.in",
  mailApiUrl: "https://mail.zoho.in/api/accounts",
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  redirectUri: process.env.ZOHO_REDIRECT_URI,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN,
  accountId: process.env.ZOHO_ACCOUNT_ID, 
  senderEmail: process.env.ZOHO_EMAIL,
};
