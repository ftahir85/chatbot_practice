import axios from "axios";

// Use your verified EC2 Public IP
const API_BASE = "http://18.232.105.88:8000";

export const sendMessage = async (message) => {
  // Use the full URL to bypass the ngrok domain
  const res = await axios.post(`${API_BASE}/api/chat`, {
    message,
  });
  return res.data;
};
