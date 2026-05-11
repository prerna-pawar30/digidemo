import axios from "axios";
import { getZohoAccessToken } from "./zohoAuth.service.js";
import { zohoConfig } from "../../config/zoho.config.js";

export const sendZohoMail = async (to, subject, content) => {
  console.log("Sending Zoho Mail to:", to);
  console.log("Subject:", zohoConfig.senderEmail);
  try {
    const accessToken = await getZohoAccessToken();
    const url = `${zohoConfig.mailApiUrl}/${zohoConfig.accountId}/messages`;
    const body = {
      fromAddress: zohoConfig.senderEmail,
      toAddress: to,
      subject,
      content,
      mailFormat: "html",
    };
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (err) {
    console.error("Zoho Mail API Error:", err.response?.data || err.message);
    throw new Error("Zoho Mail Sending Failed");
  }
};
