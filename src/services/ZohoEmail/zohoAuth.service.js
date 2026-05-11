import axios from "axios";
import { zohoConfig } from "../../config/zoho.config.js";

let accessTokenCache = null;
let accessTokenExpiry = null;
export const getZohoAccessToken = async () => {
  const currentTime = Date.now();
  //  If token is cached and NOT expired
  if (accessTokenCache && accessTokenExpiry && currentTime < accessTokenExpiry) {
    return accessTokenCache;
  }
  try {
    const response = await axios.post(
      `${zohoConfig.accountsUrl}/oauth/v2/token`,
      null,
      {
        params: {
          grant_type: "refresh_token",
          client_id: zohoConfig.clientId,
          client_secret: zohoConfig.clientSecret,
          refresh_token: zohoConfig.refreshToken,
        },
      }
    );
    const { access_token, expires_in } = response.data;
    accessTokenCache = access_token;
    accessTokenExpiry = Date.now() + (expires_in-120) * 1000;
    return access_token;
  } catch (err) {
    console.error("Zoho Access Token Error:", err.response?.data || err.message);
    throw new Error("Failed to refresh Zoho access token");
  }
};
