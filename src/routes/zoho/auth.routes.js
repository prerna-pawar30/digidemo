import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/redirect", async (req, res) => {
  const { code } = req.query;

  const params = new URLSearchParams();
  params.append("code", code);
  params.append("grant_type", "authorization_code");
  params.append("client_id", process.env.ZOHO_CLIENT_ID);
  params.append("client_secret", process.env.ZOHO_CLIENT_SECRET);
  params.append("redirect_uri", process.env.ZOHO_REDIRECT_URI); 

  console.log("Hit redirect route:", req.query);
  if (!code) return res.status(400).send("No code provided");

  try {
    const response = await axios.post(
      "https://accounts.zoho.in/oauth/v2/token",
      params,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );


    const data = response.data;
    console.log("Zoho Token Response:", data);
    return res.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,  
      expires_in: data.expires_in,
      api_domain: data.api_domain,
      token_type: data.token_type,
    });
  } catch (err) {
    console.error("Zoho OAuth Error:", err.response?.data || err.message);
    return res.status(500).send("Token exchange failed");
  }
});

export default router;

