import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

export const sendMessage = async (message) => {
  const res = await axios.post(`${API_BASE}/chat`, {
    message,
  });
  return res.data;
};