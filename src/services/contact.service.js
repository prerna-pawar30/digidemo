import Contact from "../models/ecommarace/contact.model.js";
import { v6 as uuidv6 } from "uuid";
import { sendZohoMail } from "../services/ZohoEmail/zohoMail.service.js";
import { adminContactTemplate } from "../config/templates/adminContact.js";
import { userContactTemplate } from "../config/templates/userContact.js"; 

export const createContactService = async ({
  firstName,
  lastName,
  email,
  phone,
  message,
}) => {
  /* ---------- CREATE CONTACT ---------- */
  const newContact = await Contact.create({
    contactId: uuidv6(),
    firstName,
    lastName,
    email,
    phone,
    message,
  });

  /* ---------- SEND EMAILS (NON-BLOCKING) ---------- */
  sendEmails({
    firstName,
    lastName,
    email,
    phone,
    message,
  });
  return newContact;
};

/* ---------- EMAIL HANDLER ---------- */
const sendEmails = async ({
  firstName,
  lastName,
  email,
  phone,
  message,
}) => {
  /* ---------- USER EMAIL ---------- */
  sendZohoMail(
    email,
    "We’ve received your message | Digident Support",
    userContactTemplate(firstName, message)
  ).catch((err) => {
    console.error("User email failed:", err.message);
  });
  /* ---------- ADMIN EMAIL ---------- */
  sendZohoMail(
    process.env.ADMIN_EMAIL,
    `New Contact from ${firstName} ${lastName}`,
    adminContactTemplate(firstName, lastName, email, phone, message)
  ).catch((err) => {
    console.error("Admin email failed:", err.message);
  });
};

export const getAllContactsService = async ({ page, limit, skip }) => {
  const [totalContacts, contacts] = await Promise.all([
    Contact.countDocuments(),
    Contact.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);
  return {
    contacts,
    pagination: {
      totalContacts,
      totalPages: Math.ceil(totalContacts / limit),
      currentPage: page,
      limit,
    },
  };
};

export const getContactByIdService = async ({ contactId }) => {
  if (!contactId) {
    throw new Error("CONTACT_ID_REQUIRED");
  }
  const contact = await Contact.findOne({ contactId }).lean();
  if (!contact) {
    throw new Error("CONTACT_NOT_FOUND");
  }
  return contact;
};

export const deleteAllContactsService = async () => {
  const result = await Contact.deleteMany({});
  return {
    deletedCount: result.deletedCount,
  };
};