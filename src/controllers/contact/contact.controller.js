import { createContactService,getAllContactsService,getContactByIdService, deleteAllContactsService } from "../../services/contact.service.js";
import { contactValidationSchema } from "./contact.validation.js";
import { sendError, handleError } from "../../helpers/error.helper.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import { getPagination } from "../../helpers/pagination.helper.js";

/**
 * @function createContact
 *
 * @params
 * body: {
 *   firstName: string,
 *   lastName: string,
 *   email: string,
 *   phone: string,
 *   message: string
 * }
 *
 * @process
 * Validate request body using Joi schema
 * Extract validated data
 * Create contact entry in database
 * Send email to user and admin (handled in service)
 * Return created contact
 *
 * @response
 * 201 {
 *   success: true,
 *   message: "Message saved and emails sent successfully!",
 *   data: contact
 * }
 */
export const createContact = async (req, res) => {
  try {
    /* ---------- VALIDATION ---------- */
    const { error, value } = contactValidationSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error){
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map(err => err.message),
      });
    }
    /* ---------- SERVICE CALL ---------- */
    const contact = await createContactService(value);
    /* ---------- RESPONSE ---------- */
    return sendSuccess(
      res,
      contact,
      201,
      "Message saved and emails sent successfully!"
    );
  } catch (error) {
    console.error("Create Contact Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function getAllContacts
 *
 * @params
 * query: {
 *   page?: number,
 *   limit?: number
 * }
 *
 * @process
 * Extract page and limit from query
 * Set default values if not provided
 * Calculate skip value for pagination
 * Fetch contacts from service
 * Return paginated contacts
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Contact messages fetched successfully",
 *   data: {
 *     contacts,
 *     pagination
 *   }
 * }
 */
export const getAllContacts = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { contacts, pagination } = await getAllContactsService({
      page,
      limit,
      skip,
    });
    return sendSuccess(res, { contacts, pagination }, 200);
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @function getContactById
 *
 * @params
 * params: {
 *   contactId: string
 * }
 *
 * @process
 * Extract contactId from params
 * Validate contactId
 * Fetch contact from database
 * Return contact details
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Contact fetched successfully",
 *   data: contact
 * }
 */
export const getContactById = async (req, res) => {
  try {
    const { contactId } = req.params;
    /* ---------- VALIDATION ---------- */
    if (!contactId){
      return sendError(res, {
        message: "ContactId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
      });
    }
    /* ---------- SERVICE CALL ---------- */
    const contact = await getContactByIdService({ contactId });
    /* ---------- NOT FOUND ---------- */
    if (!contact) {
      return sendError(res, {
        message: "Contact not found",
        statusCode: 404,
        errorCode: "NOT_FOUND",
      });
    }
    /* ---------- SUCCESS ---------- */
    return sendSuccess(
      res,
      contact,
      200,
      "Contact fetched successfully"
    );
  } catch (error) {
    console.error("Error in getContactById:", error);
    return handleError(res, error);
  }
};

/**
 * @function deleteAllContacts
 *
 * @process
 * Delete all contact messages from database
 * Return number of deleted records
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "All contact messages deleted successfully",
 *   data: { deletedCount }
 * }
 */
export const deleteAllContacts = async (req, res) => {
  try {
    /* ---------- SERVICE CALL ---------- */
    const { deletedCount } = await deleteAllContactsService();
    /* ---------- NO DATA ---------- */
    if (deletedCount === 0){
      return sendSuccess(
        res,
        { deletedCount: 0 },
        200,
        "No contact messages to delete"
      );
    }
    /* ---------- SUCCESS ---------- */
    return sendSuccess(
      res,
      { deletedCount },
      200,
      "All contact messages deleted successfully"
    );
  } catch (error) {
    console.error("Error in deleteAllContacts:", error);
    return handleError(res, error);
  }
};