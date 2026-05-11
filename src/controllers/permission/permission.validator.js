import Joi from "joi";

export const validatePermissionBody = (data) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
  });

  return schema.validate(data, { abortEarly: false });
};



export const validateAssignPermissionBody = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    permission: Joi.string().trim().required(),
  });

  return schema.validate(data, { abortEarly: false });
};