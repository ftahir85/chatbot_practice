import axios from "axios";

// Change this line:
const API_BASE = "/api"; 

export const sendMessage = async (message) => {
  const res = await axios.post(`${API_BASE}/chat`, {
    message,
  });
  return res.data;
};
