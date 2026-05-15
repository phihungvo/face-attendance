import axios from "axios";

const baseURL = (import.meta as any).env?.VITE_NOTIF_URL || "http://localhost:8010";

export const notifApi = axios.create({
  baseURL,
  timeout: 15_000
});

