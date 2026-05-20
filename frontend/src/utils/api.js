import axios from 'axios';

// ---------------------------------------------------------
// Create Axios Instance
// Configured with the FastAPI backend URL (http://localhost:8000)
// ---------------------------------------------------------
const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------
// Response Interceptor
// ---------------------------------------------------------
// WHAT AN INTERCEPTOR DOES:
// An Axios interceptor is a middleware function that can run automatically 
// before a request is sent (request interceptor) or after a response is 
// received (response interceptor). In this case, the response interceptor 
// intercepts any incoming response from the server. If the request was 
// successful, it passes the response through. If there was an error 
// (e.g., network failure, 4xx or 5xx status code), it intercepts the failure 
// to log it globally for debugging before forwarding the error back to the 
// calling code via Promise.reject.
// ---------------------------------------------------------
api.interceptors.response.use(
  (response) => {
    // If the request succeeds, simply return the response
    return response;
  },
  (error) => {
    // Globally log the API error details
    console.error('[API ERROR INTERCEPTOR]:', {
      message: error.message,
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
    });
    // Forward the error to the calling function to handle locally
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------
// 2) Exported translate Function
// Sends a POST request to the /translate endpoint with the text 
// and target_language fields.
// ---------------------------------------------------------
export const translate = async (text, target_language, source_language = 'auto') => {
  const response = await api.post('/translate', {
    text,
    target_language,
    source_language,
  });
  return response.data;
};

// ---------------------------------------------------------
// 3) Exported fetchHistory Function
// Sends a GET request to retrieve the translation history log.
// ---------------------------------------------------------
export const fetchHistory = async () => {
  const response = await api.get('/history');
  return response.data;
};

// ---------------------------------------------------------
// 4) Exported toggleFavourite Function
// Sends a PUT request to toggle the favourite status of a record by ID.
// ---------------------------------------------------------
export const toggleFavourite = async (id) => {
  const response = await api.put(`/history/${id}/favourite`);
  return response.data;
};

export default api;
