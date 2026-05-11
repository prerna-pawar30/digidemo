import { handleError, sendError } from "../../helpers/error.helper.js";
import { sendSuccess } from "../../helpers/response.helper.js";
import {addAddressService,  updateAddressService, clearAllAddressesService, deleteAddressService, getDefaultAddressService, setDefaultAddressService } from "../../services/address.service.js";
import { addAddressValidator } from "./address.validator.js";

/**
 * @function addAddress
 *
 * @route POST /api/user/address
 *
 * @params
 * body: {
 *   label: "Home" | "Work" | "Other",
 *   firstName: string,
 *   lastName: string,
 *   phone: string,
 *   street: string,
 *   area: string,
 *   city: string,
 *   state: string,
 *   pincode: string,
 *   country: string,
 *   isDefault?: boolean
 * }
 *
 * @process
 * 1. Extract authenticated user from req.currentUser.
 * 2. Validate request body using addAddressValidator.
 * 3. If validation fails, return validation errors.
 * 4. Call addAddressService with validated data.
 * 5. Add address to user document.
 * 6. Return updated addresses list.
 *
 * @response
 * 201 {
 *   success: true,
 *   message: "Address added successfully",
 *   data: [AddressObject]
 * }
 *
 * @errors
 * 400 - VALIDATION_ERROR
 * 409 - ADDRESS_ALREADY_EXISTS
 * 500 - INTERNAL_SERVER_ERROR
 */
export const addAddress = async (req, res) => {
  try{
    const user = req.currentUser;
    const { value, error } = addAddressValidator.validate(req.body, {
      abortEarly: false
    });
    if(error){
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message)
      });
    }
    const result = await addAddressService(user, value);
    return sendSuccess(
      res,
      result,
      201,
      "Address added successfully"
    );
  } catch (error) {
    console.error("Add Address Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function updateAddress
 *
 * @route PUT /api/user/address/:addressId
 *
 * @params
 * params: {
 *   addressId: string
 * }
 *
 * body: {
 *   label?: "Home" | "Work" | "Other",
 *   firstName?: string,
 *   lastName?: string,
 *   phone?: string,
 *   street?: string,
 *   area?: string,
 *   city?: string,
 *   state?: string,
 *   pincode?: string,
 *   country?: string,
 *   isDefault?: boolean
 * }
 *
 * @process
 * 1. Extract addressId from request params.
 * 2. Validate request body.
 * 3. Call updateAddressService.
 * 4. Update address fields.
 * 5. Return updated addresses list.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Address updated successfully",
 *   data: [AddressObject]
 * }
 *
 * @errors
 * 400 - VALIDATION_ERROR
 * 404 - ADDRESS_NOT_FOUND
 * 500 - INTERNAL_SERVER_ERROR
 */
export const updateAddress = async (req, res) => {
  try {
    const user = req.currentUser;
    const { addressId } = req.params;
    if (!addressId) {
      return sendError(res, {
        message: "AddressId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    const { value, error } = addAddressValidator.validate(req.body, {
      abortEarly: false
    });
    if (error) {
      return sendError(res, {
        message: "Validation failed",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        details: error.details.map((err) => err.message)
      });
    }
    const result = await updateAddressService(user, addressId, value);
    return sendSuccess(
      res,
      result,
      200,
      "Address updated successfully"
    );
  } catch (error) {
    console.error("Update Address Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function getAllAddresses
 *
 * @route GET /api/user/addresses
 *
 * @process
 * 1. Extract authenticated user from req.currentUser.
 * 2. Fetch all addresses from user document.
 * 3. Return addresses list.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Addresses fetched successfully",
 *   data: [AddressObject]
 * }
 *
 * @errors
 * 500 - INTERNAL_SERVER_ERROR
 */
export const getAllAddresses = async (req, res) => {
  try {
    const user = req.currentUser;
    const address = user?.address;
    return sendSuccess(
      res,  
      address,
      200,
      "Addresses fetched successfully"
    );

  } catch (error) {
    console.error("Get Addresses Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function deleteAddress
 *
 * @route DELETE /api/user/address/:addressId
 *
 * @params
 * params: {
 *   addressId: string
 * }
 *
 * @process
 * 1. Extract addressId from request params.
 * 2. Get authenticated user from req.currentUser.
 * 3. Check if address exists.
 * 4. Remove address from user.addresses array.
 * 5. If deleted address was default, assign first address as default.
 * 6. Save user document.
 * 7. Return updated addresses list.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Address deleted successfully",
 *   data: [AddressObject]
 * }
 *
 * @errors
 * 400 - VALIDATION_ERROR
 * 404 - ADDRESS_NOT_FOUND
 * 500 - INTERNAL_SERVER_ERROR
 */
export const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = req.currentUser;
    if (!addressId) {
      return sendError(res, {
        message: "AddressId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    const result = await deleteAddressService(user, addressId);
    return sendSuccess(
      res,
      result,
      200,
      "Address deleted successfully"
    );
  } catch (error) {
    console.error("Delete Address Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function clearAllAddresses
 *
 * @route DELETE /api/user/addresses/clear
 *
 * @process
 * 1. Extract authenticated user from req.currentUser.
 * 2. Call clearAllAddressesService.
 * 3. Remove all addresses from user document.
 * 4. Return empty address list.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "All addresses cleared successfully",
 *   data: []
 * }
 *
 * @errors
 * 404 - USER_NOT_FOUND
 * 500 - INTERNAL_SERVER_ERROR
 */
export const clearAllAddresses = async (req, res) => {
  try {
    const user = req.currentUser;
    const result = await clearAllAddressesService(user);
    return sendSuccess(
      res,
      result,
      200,
      result.length === 0
        ? "No address to clear"
        : "All address cleared successfully"
    );
  } catch (error) {
    console.error("Clear Address Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function getDefaultAddress
 *
 * @route GET /api/user/address/default
 *
 * @description
 * Fetch the default address of the authenticated user.
 *
 * @process
 * 1. Extract authenticated user from req.currentUser.
 * 2. Check if user has addresses.
 * 3. Find address where isDefault = true.
 * 4. Return default address.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Default address fetched successfully",
 *   data: AddressObject
 * }
 *
 * @errors
 * 404 - DEFAULT_ADDRESS_NOT_FOUND
 * 500 - INTERNAL_SERVER_ERROR
 */
export const getDefaultAddress = async (req, res) => {
  try {
    const user = req.currentUser;
    const result = await getDefaultAddressService(user);
    return sendSuccess(
      res,
      result,
      200,
      "Default address fetched successfully"
    );
  } catch (error) {
    console.error("Get Default Address Error:", error);
    return handleError(res, error);
  }
};

/**
 * @function setDefaultAddress
 *
 * @route PUT /api/user/address/default/:addressId
 *
 * @params
 * params: {
 *   addressId: string
 * }
 *
 * @description
 * Set a specific address as default for the authenticated user.
 *
 * @process
 * 1. Extract addressId from request params.
 * 2. Extract authenticated user from req.currentUser.
 * 3. Validate addressId.
 * 4. Find address by addressId.
 * 5. Reset all addresses isDefault = false.
 * 6. Set selected address isDefault = true.
 * 7. Save user document.
 * 8. Return updated addresses list.
 *
 * @response
 * 200 {
 *   success: true,
 *   message: "Default address updated successfully",
 *   data: [AddressObject]
 * }
 *
 * @errors
 * 400 - VALIDATION_ERROR
 * 404 - ADDRESS_NOT_FOUND
 * 500 - INTERNAL_SERVER_ERROR
 */
export const setDefaultAddress = async (req, res) => {
  try {
    const user = req.currentUser;
    const { addressId } = req.params;
    // ✅ Basic validation (controller level)
    if (!addressId) {
      return sendError(res, {
        message: "AddressId is required",
        statusCode: 400,
        errorCode: "VALIDATION_ERROR"
      });
    }
    const result = await setDefaultAddressService(user, addressId);
    return sendSuccess(
      res,
      result,
      200,
      "Default address updated successfully"
    );
  } catch (error) {
    console.error("Set Default Address Error:", error);
    return handleError(res, error);
  }
};



