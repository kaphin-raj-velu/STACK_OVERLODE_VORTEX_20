import axios from "axios";
const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api", timeout: 30000 });
export const analyzeQuestion = (question, domain) => API.post("/analyze-question", { question, domain });
export const getAllQuestions = (params={}) => API.get("/questions", { params });
export const getFlaggedQuestions = () => API.get("/flagged-questions");
export const getAnalytics = () => API.get("/analytics");
export const deleteQuestion = (id) => API.delete(`/questions/${id}`);
export default API;
