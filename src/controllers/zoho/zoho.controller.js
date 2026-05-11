import axios from "axios";
import { getZohoAccessToken } from "../../services/ZohoEmail/zohoAuth.service.js";
import { zohoConfig } from "../../config/zoho.config.js";
import { sendError, handleError } from "../../helpers/error.helper.js";
import { sendSuccess } from "../../helpers/response.helper.js";

export const getAccountId = async (req, res) => {
  try {
    /* =========================
       GET ACCESS TOKEN
    ========================= */
    const accessToken = await getZohoAccessToken();

    if (!accessToken) {
      throw {
        message: "Failed to generate Zoho access token",
        statusCode: 401,
        errorCode: "ZOHO_AUTH_FAILED",
      };
    }

    /* =========================
       CALL ZOHO API
    ========================= */
    const response = await axios.get(
      `${zohoConfig.mailApiUrl}/v1/accounts`,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      }
    );

    const data = response?.data;

    /* =========================
       VALIDATE RESPONSE
    ========================= */
    if (!data?.data || data.data.length === 0) {
      return sendError(res, {
        message: "No Zoho accounts found",
        statusCode: 404,
        errorCode: "ZOHO_ACCOUNT_NOT_FOUND",
      });
    }

    /* =========================
       EXTRACT ACCOUNT ID
    ========================= */
    const accountId = data.data[0]?.accountId;

    if (!accountId) {
      throw {
        message: "Invalid Zoho response structure",
        statusCode: 500,
        errorCode: "ZOHO_INVALID_RESPONSE",
      };
    }

    /* =========================
       SUCCESS RESPONSE
    ========================= */
    return sendSuccess(
      res,
      {
        accountId,
        accounts: data.data, // optional
      },
      200,
      "Zoho accounts fetched successfully"
    );

  } catch (error) {
    console.error(
      "getAccountId error:",
      error?.response?.data || error.message
    );

    /* =========================
       HANDLE AXIOS ERRORS
    ========================= */
    if (error.response) {
      return sendError(res, {
        message: error.response.data?.message || "Zoho API error",
        statusCode: error.response.status || 500,
        errorCode: "ZOHO_API_ERROR",
        details: error.response.data,
      });
    }

    return handleError(res, error);
  }
};





    

