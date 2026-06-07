const axios = require('axios');
const config = require('../config/config');
const BASE_URL = 'https://kdwholesale.co.uk/api';
const { AUTH_PASSWORD , AUTH_USERNAME } = require("../config/config");


async function deleteProduct(productId) {
    
    const url = `${BASE_URL}/products/${productId}/`; // trailing slash is okay per docs
    
    try {
        // Attempt normal DELETE with Basic Auth
        const response = await axios.delete(url, {
            auth: {
                username: AUTH_USERNAME,
                password: AUTH_PASSWORD
            }
        });
        console.log(`DELETE request successful for product ID: ${productId}`);

        return {
            success: true,
            status: response.status,
            data: response.data
        };

    } catch (error) {
        // If DELETE fails, fallback using POST + method override
        if (error.response && error.response.status === 400) {
            try {
                const response = await axios.post(url, {}, {
                    headers: {
                        'X-HTTP-Method-Override': 'DELETE'
                    },
                    auth: {
                        username: AUTH_USERNAME,
                        password: AUTH_PASSWORD
                    }
                });

                return {
                    success: true,
                    status: response.status,
                    data: response.data,
                    fallback: true
                };

            } catch (fallbackError) {
                return {
                    success: false,
                    status: fallbackError.response?.status,
                    error: fallbackError.response?.data || fallbackError.message
                };
            }
        }

        return {
            success: false,
            status: error.response?.status,
            error: error.response?.data || error.message
        };
    }
}

module.exports = {
    deleteProduct
};