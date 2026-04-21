import axios from "axios";

const API_BASE = "http://18.232.105.88:8000";

export const sendMessage = async (message) => {
  const res = await axios.post(`${API_BASE}/chat`, {
    message,
  });
  return res.data;
};