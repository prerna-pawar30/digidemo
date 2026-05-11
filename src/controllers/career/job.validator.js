import Joi from "joi";

export const createJobValidator = Joi.object({
  title: Joi.string().trim().required(),
  department: Joi.string().trim().required(),
  location: Joi.string().trim().required(),
  workplaceType: Joi.string().valid("onsite", "remote", "hybrid").required(),
  employmentType: Joi.string()
    .valid("full_time", "part_time", "internship", "contract", "freelance")
    .required(),
  experienceLevel: Joi.string()
    .valid("fresher", "junior", "mid", "senior", "lead")
    .optional(),
  minExperienceYears: Joi.number().min(0).optional(),
  maxExperienceYears: Joi.number().min(0).optional(),
  openings: Joi.number().min(1).optional(),
  salary: Joi.object({
    min: Joi.number().min(0).optional(),
    max: Joi.number().min(0).optional(),
    currency: Joi.string().trim().optional(),
    isVisible: Joi.boolean().optional(),
  }).optional(),
  shortDescription: Joi.string().trim().allow("").optional(),
  description: Joi.array()
    .items(
      Joi.object({
        text: Joi.string().trim().required(),
      })
    )
    .min(1)
    .required(),
  responsibilities: Joi.array().items(Joi.string().trim()).optional(),
  requirements: Joi.array().items(Joi.string().trim()).optional(),
  skills: Joi.array().items(Joi.string().trim()).optional(),
  perks: Joi.array().items(Joi.string().trim()).optional(),
  applicationDeadline: Joi.date().optional().allow(null),
  status: Joi.string().valid("draft", "published", "closed").optional(),
  isFeatured: Joi.boolean().optional(),
  permission: Joi.string().required(),
});

export const updateJobValidator = Joi.object({
  permission: Joi.string().required(),
  title: Joi.string().trim().optional(),
  department: Joi.string().trim().optional(),
  location: Joi.string().trim().optional(),
  workplaceType: Joi.string().valid("onsite", "remote", "hybrid").optional(),
  employmentType: Joi.string()
    .valid("full_time", "part_time", "internship", "contract", "freelance")
    .optional(),
  experienceLevel: Joi.string()
    .valid("fresher", "junior", "mid", "senior", "lead")
    .optional(),
  minExperienceYears: Joi.number().min(0).optional(),
  maxExperienceYears: Joi.number().min(0).optional(),
  openings: Joi.number().min(1).optional(),
  salary: Joi.object({
    min: Joi.number().min(0).optional(),
    max: Joi.number().min(0).optional(),
    currency: Joi.string().trim().optional(),
    isVisible: Joi.boolean().optional(),
  }).optional(),
  shortDescription: Joi.string().trim().allow("").optional(),
  description: Joi.array()
    .items(
      Joi.object({
        text: Joi.string().trim().required(),
      })
    )
    .optional(),
  responsibilities: Joi.array().items(Joi.string().trim()).optional(),
  requirements: Joi.array().items(Joi.string().trim()).optional(),
  skills: Joi.array().items(Joi.string().trim()).optional(),
  perks: Joi.array().items(Joi.string().trim()).optional(),
  applicationDeadline: Joi.date().optional().allow(null),
  status: Joi.string().valid("draft", "published", "closed").optional(),
  isFeatured: Joi.boolean().optional(),
});