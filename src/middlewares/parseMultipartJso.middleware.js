/**
 * @function parseMultipartJson
 *
 * @description
 * Middleware to parse stringified JSON fields in a multipart/form-data request.
 * Useful when sending nested JSON objects as form-data.
 *
 * @process
 * 1. Define all fields that may contain JSON strings
 * 2. Loop through each field
 * 3. If the field exists and is a string, attempt to parse it with JSON.parse
 * 4. If parsing fails, return 400 Bad Request with the field name
 * 5. If all fields are parsed successfully, call `next()`
 *
 * @response
 * 400 { success: false, message: "Invalid JSON format in field: <field>" } - if any field contains invalid JSON
 */
export const parseMultipartJson = (req, res, next) => {
  const fields = [
    "brand",
    "description",
    "specification",
    "variants",
    "attributes",
    "tags",
    "labels",
    "customFields",
    "metadata",
    "images", 
    "descriptionImageMap",
    "variantImageMap",          
    "removeImages",     
    "removeDescImages", 
    "removeVariantImages"
  ];

  for (const field of fields) {
    if (req.body[field] && typeof req.body[field] === "string") {
      try {
        req.body[field] = JSON.parse(req.body[field]);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Invalid JSON format in field: ${field}",
        });
      }
    }
  }
  next();
};