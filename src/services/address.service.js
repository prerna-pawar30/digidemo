import { v6 as uuidv6 } from "uuid";
export const addAddressService = async (user, data) => {
  const {
    label,
    firstName,
    lastName,
    phone,
    street,
    area,
    city,
    state,
    pincode,
    country,
    isDefault = false
  } = data;
  if(!user.address){
    user.address = []; // ✅ prevent crash
  }
  const allowedLabels = ["Home", "Work", "Other"];
  if (!allowedLabels.includes(label)) {
    throw new Error("INVALID_ADDRESS_LABEL");
  }
  const duplicate = user.address.some(
    (a) =>
      a.street === street &&
      a.area === area
  );
  if(duplicate){
    throw new Error("ADDRESS_ALREADY_EXISTS");
  }
  if (isDefault) {
    user.address.forEach((a) => {
      a.isDefault = false;
    });
  }
  const newAddress = {
    addressId: uuidv6(),
    label,
    firstName,
    lastName, 
    phone,
    street,
    area,
    city,
    state,
    pincode,
    country,
    isDefault
  };
  user.address.push(newAddress);
  await user.save();
  return user.address;
};

export const updateAddressService = async (user, addressId, updates) => {
  const addressIndex = user.address.findIndex(
    (addr) => addr.addressId === addressId
  );
  if (addressIndex === -1) {
    const err = new Error("ADDRESS_NOT_FOUND");
    throw err;
  }
  delete updates.addressId;
  if (updates.isDefault === true) {
    user.address.forEach((addr) => {
      addr.isDefault = false;
    });
  }
  const allowedFields = [
    "label",
    "firstName",
    "lastName",
    "phone",
    "street",
    "area",
    "city",
    "state",
    "pincode",
    "country",
    "isDefault"
  ];
  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      user.address[addressIndex][field] = updates[field];
    }
  });
  await user.save();
  return user.address;
};

export const deleteAddressService = async (user, addressId) => {
  const addressIndex = user.address.findIndex(
    (addr) => addr.addressId === addressId
  );
  if (addressIndex === -1) {
    const error = new Error("ADDRESS_NOT_FOUND");
    throw error;
  }
  const wasDefault = user.address[addressIndex].isDefault;
  user.address.splice(addressIndex, 1);
  if (wasDefault && user.address.length > 0) {
    user.address[0].isDefault = true;
  }
  await user.save();
  return user.address;
};

export const clearAllAddressesService = async (user) => {
  if (!user){
    const error = new Error("USER_NOT_FOUND");
    throw error;
  }
  /* If already empty */
  if (!user.address || user.address.length === 0) {
    return [];
  }
  /* Clear all addresses */
  user.address = [];
  await user.save();
  return user.address;
};

export const getDefaultAddressService = async (user) => {
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    error.errorCode = "USER_NOT_FOUND";
    throw error;
  }

  const address = user?.address?.find(
    (addr) => addr.isDefault === true
  );

  if (!address) {
    const error = new Error("No default address found");
    error.statusCode = 404;
    error.errorCode = "DEFAULT_ADDRESS_NOT_FOUND";
    throw error;
  }
  return address;
};

export const setDefaultAddressService = async (user, addressId) => {

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    error.errorCode = "USER_NOT_FOUND";
    throw error;
  }

  if (!addressId) {
    const error = new Error("AddressId is required");
    error.statusCode = 400;
    error.errorCode = "VALIDATION_ERROR";
    throw error;
  }

  const addressIndex = user?.address?.findIndex(
    (addr) => addr.addressId === addressId
  );
  if (addressIndex === -1 || addressIndex === undefined) {
    const error = new Error("Address not found");
    error.statusCode = 404;
    error.errorCode = "ADDRESS_NOT_FOUND";
    throw error;
  }

  // ✅ Avoid unnecessary DB write
  if (user.address[addressIndex].isDefault) {
    return user.address;
  }

  // ✅ Reset all defaults
  user.address.forEach((addr) => {
    addr.isDefault = false;
  });

  // ✅ Set selected as default
  user.address[addressIndex].isDefault = true;

  await user.save();

  return user.address;
};