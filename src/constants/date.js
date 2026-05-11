export const getISTNow = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 60 * 60000; // IST = UTC +5:30
  return new Date(utc + istOffset);
};

export const getISTDateString = (date) => {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
};