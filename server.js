const express = require('express');
const axios = require('axios');
const WhatsAppCarProtectionBot = require('./bot');
require('dotenv').config();


const app = express();
const bot = new WhatsAppCarProtectionBot();

// Replace these with your actual values from Meta Dashboard
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;


// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add logging middleware to see all incoming requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Serve static files from public directory
app.use(express.static('public'));

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'WhatsApp Car Protection Chatbot Server',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
            webhook: '/webhook',
            test: '/test-message'
        }
    });
});

// Simple health check route for uptime monitors / load balancers
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// WhatsApp webhook endpoint for verification (GET)
app.get('/webhook', (req, res) => {
    console.log('GET /webhook called with query params:', req.query);
    
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log(`Verification attempt - Mode: ${mode}, Token: ${token}, Challenge: ${challenge}`);
    console.log(`Expected token: ${VERIFY_TOKEN}`);

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verified successfully!');
        res.status(200).send(challenge);
    } else {
        console.log('❌ Webhook verification failed');
        res.status(403).send('Verification failed');
    }
});

// WhatsApp webhook endpoint for receiving messages (POST)
app.post('/webhook', async (req, res) => {
    console.log('📨 POST /webhook called');
    console.log('Raw body:', JSON.stringify(req.body, null, 2));
    
    try {
        const body = req.body;

        // Acknowledge receipt immediately
        res.status(200).json({ status: 'received' });

        // Check if this is a WhatsApp Business Account webhook
        if (body.object !== 'whatsapp_business_account') {
            console.log(`⚠️  Ignoring webhook for object type: ${body.object}`);
            return;
        }

        // Check for entry and changes
        if (!body.entry || !Array.isArray(body.entry) || body.entry.length === 0) {
            console.log('⚠️  No entry found in webhook body');
            return;
        }

        const entry = body.entry[0];
        console.log('Entry:', JSON.stringify(entry, null, 2));

        if (!entry.changes || !Array.isArray(entry.changes) || entry.changes.length === 0) {
            console.log('⚠️  No changes found in entry');
            return;
        }

        const change = entry.changes[0];
        console.log('Change:', JSON.stringify(change, null, 2));

        // Check if this is a message event
        if (!change.value || !change.value.messages || !Array.isArray(change.value.messages) || change.value.messages.length === 0) {
            console.log('⚠️  No messages found in change value');
            
            // Check if this is a status update
            if (change.value.statuses) {
                console.log('📊 Received status update:', JSON.stringify(change.value.statuses, null, 2));
                return;
            }
            
            return;
        }

        const message = change.value.messages[0];
        console.log('Message:', JSON.stringify(message, null, 2));

        const senderId = message.from;
        let messageText = '';

        // Handle different message types
        if (message.type === 'text') {
            messageText = message.text.body;
            console.log(`📝 Text message from ${senderId}: ${messageText}`);
        } else if (message.type === 'interactive') {
            if (message.interactive.type === 'button_reply') {
                messageText = message.interactive.button_reply.title;
                console.log(`🔘 Button reply from ${senderId}: ${messageText}`);
            } else if (message.interactive.type === 'list_reply') {
                messageText = message.interactive.list_reply.title;
                console.log(`📋 List reply from ${senderId}: ${messageText}`);
            }
        } else {
            console.log(`⚠️  Unsupported message type: ${message.type}`);
            return;
        }

        // Handle number selection for fallback text buttons
        if (/^\d+$/.test(messageText.trim())) {
            const buttonNumber = parseInt(messageText.trim());
            const session = bot.getSession(senderId);
            
            // Get the last bot response from session history to find available buttons
            const lastBotMessage = getLastBotMessageWithButtons(session);
            if (lastBotMessage && lastBotMessage.buttons && buttonNumber >= 1 && buttonNumber <= lastBotMessage.buttons.length) {
                messageText = lastBotMessage.buttons[buttonNumber - 1];
                console.log(`🔢 Converted number ${buttonNumber} to button text: ${messageText}`);
            }
        }

        // Process the message with bot logic
        console.log(`🤖 Processing message: ${messageText}`);
        const botResponse = bot.processMessage(senderId, messageText);
        console.log('Bot response:', JSON.stringify(botResponse, null, 2));

        // Send response back to WhatsApp
        await sendWhatsAppResponse(senderId, botResponse);

    } catch (error) {
        console.error('❌ Webhook error:', error);
        console.error('Error stack:', error.stack);
    }
});

// Helper function to get last bot message with buttons from session
function getLastBotMessageWithButtons(session) {
    // This is a simplified approach - in a production system, you'd store the full response
    // For now, we'll return null and rely on the bot's internal logic
    return null;
}

// Function to send response back to WhatsApp
// async function sendWhatsAppResponse(to, response) {
//     const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
//     const headers = {
//         'Authorization': `Bearer ${ACCESS_TOKEN}`,
//         'Content-Type': 'application/json'
//     };

//     let data;

//     if (response.buttons && response.buttons.length > 0) {
//         if (response.buttons.length <= 3) {
//             // Create interactive buttons (only for 3 or fewer buttons)
//             data = {
//                 messaging_product: 'whatsapp',
//                 recipient_type: 'individual',
//                 to: to,
//                 type: 'interactive',
//                 interactive: {
//                     type: 'button',
//                     body: {
//                         text: response.text
//                     },
//                     action: {
//                         buttons: response.buttons.map((button, index) => ({
//                             type: 'reply',
//                             reply: {
//                                 id: `btn_${index}_${Date.now()}`,
//                                 title: button.length > 20 ? button.substring(0, 20) : button
//                             }
//                         }))
//                     }
//                 }
//             };
//         } else {
//             // For more than 3 buttons, use list format
//             if (response.buttons.length <= 10) {
//                 data = {
//                     messaging_product: 'whatsapp',
//                     recipient_type: 'individual',
//                     to: to,
//                     type: 'interactive',
//                     interactive: {
//                         type: 'list',
//                         header: {
//                             type: 'text',
//                             text: 'Select an option'
//                         },
//                         body: {
//                             text: response.text
//                         },
//                         action: {
//                             button: 'View Options',
//                             sections: [{
//                                 title: 'Available Services',
//                                 rows: response.buttons.map((button, index) => ({
//                                     id: `option_${index}_${Date.now()}`,
//                                     title: button.length > 24 ? button.substring(0, 24) : button,
//                                     description: ''
//                                 }))
//                             }]
//                         }
//                     }
//                 };
//             } else {
//                 // Fallback to text with numbered options for more than 10 buttons
//                 let textWithButtons = response.text + '\n\n*Reply with number:*\n';
//                 response.buttons.forEach((button, index) => {
//                     textWithButtons += `${index + 1}. ${button}\n`;
//                 });
                
//                 data = {
//                     messaging_product: 'whatsapp',
//                     to: to,
//                     type: 'text',
//                     text: {
//                         preview_url: false,
//                         body: textWithButtons
//                     }
//                 };
//             }
//         }
//     } else {
//         // Simple text response
//         data = {
//             messaging_product: 'whatsapp',
//             to: to,
//             type: 'text',
//             text: {
//                 preview_url: false,
//                 body: response.text
//             }
//         };
//     }

//     try {
//         console.log('📤 Sending WhatsApp message:', JSON.stringify(data, null, 2));
        
//         const config = {
//             headers,
//             timeout: 30000,
//             retry: 3,
//             retryDelay: 1000
//         };
        
//         const apiResponse = await axios.post(url, data, config);
//         console.log('✅ Message sent successfully:', apiResponse.data);
//         return apiResponse.data;
//     } catch (error) {
//         console.error('❌ Error sending message:', error.response ? error.response.data : error.message);
        
//         if (error.response) {
//             console.error('Response status:', error.response.status);
//             console.error('Response headers:', error.response.headers);
            
//             // Handle specific WhatsApp API errors
//             if (error.response.status === 400) {
//                 console.error('🚨 Bad Request - Check message format or access token');
//             } else if (error.response.status === 401) {
//                 console.error('🚨 Unauthorized - Check access token');
//             } else if (error.response.status === 403) {
//                 console.error('🚨 Forbidden - Check permissions');
//             }
//         }
        
//         // For critical errors, try sending a simple text fallback
//         if (data.type === 'interactive') {
//             console.log('🔄 Attempting fallback to simple text...');
//             try {
//                 const fallbackData = {
//                     messaging_product: 'whatsapp',
//                     to: to,
//                     type: 'text',
//                     text: {
//                         preview_url: false,
//                         body: response.text + (response.buttons ? '\n\nPlease type your choice or contact support.' : '')
//                     }
//                 };
                
//                 const fallbackResponse = await axios.post(url, fallbackData, { headers, timeout: 10000 });
//                 console.log('✅ Fallback message sent:', fallbackResponse.data);
//                 return fallbackResponse.data;
//             } catch (fallbackError) {
//                 console.error('❌ Fallback also failed:', fallbackError.message);
//             }
//         }
        
//         throw error;
//     }
// }

// Function to send response back to WhatsApp
// // Function to send response back to WhatsApp
// async function sendWhatsAppResponse(to, response) {
//     const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
//     const headers = {
//         'Authorization': `Bearer ${ACCESS_TOKEN}`,
//         'Content-Type': 'application/json'
//     };

//     let data;

//     if (response.buttons && response.buttons.length > 0) {
//         // Check if any button text is longer than 20 characters
//         const hasLongButtons = response.buttons.some(button => button.length > 20);
        
//         if (response.buttons.length <= 3 && !hasLongButtons) {
//             // Create interactive buttons (only for 3 or fewer buttons AND all buttons are short)
//             data = {
//                 messaging_product: 'whatsapp',
//                 recipient_type: 'individual',
//                 to: to,
//                 type: 'interactive',
//                 interactive: {
//                     type: 'button',
//                     body: {
//                         text: response.text
//                     },
//                     action: {
//                         buttons: response.buttons.map((button, index) => ({
//                             type: 'reply',
//                             reply: {
//                                 id: `btn_${index}_${Date.now()}`,
//                                 title: button
//                             }
//                         }))
//                     }
//                 }
//             };
//         } else {
//             // For more than 3 buttons, use list format with proper text handling
//             if (response.buttons.length <= 10) {
//                 data = {
//                     messaging_product: 'whatsapp',
//                     recipient_type: 'individual',
//                     to: to,
//                     type: 'interactive',
//                     interactive: {
//                         type: 'list',
//                         header: {
//                             type: 'text',
//                             text: 'Select an option'
//                         },
//                         body: {
//                             text: response.text
//                         },
//                         action: {
//                             button: 'View Options',
//                             sections: [{
//                                 title: 'Available Options',
//                                 rows: response.buttons.map((button, index) => {
//                                     // Handle long button text properly
//                                     let title, description;
//                                     if (button.length > 24) {
//                                         // Split long text between title and description
//                                         title = button.substring(0, 24);
//                                         description = button.substring(24, 72); // WhatsApp allows up to 72 chars in description
//                                     } else {
//                                         title = button;
//                                         description = '';
//                                     }
                                    
//                                     return {
//                                         id: `option_${index}_${Date.now()}`,
//                                         title: title,
//                                         description: description
//                                     };
//                                 })
//                             }]
//                         }
//                     }
//                 };
//             } else {
//                 // Fallback to text with numbered options for more than 10 buttons
//                 let textWithButtons = response.text + '\n\n*Reply with number:*\n';
//                 response.buttons.forEach((button, index) => {
//                     textWithButtons += `${index + 1}. ${button}\n`;
//                 });
                
//                 data = {
//                     messaging_product: 'whatsapp',
//                     to: to,
//                     type: 'text',
//                     text: {
//                         preview_url: false,
//                         body: textWithButtons
//                     }
//                 };
//             }
//         }
//     } else {
//         // Simple text response
//         data = {
//             messaging_product: 'whatsapp',
//             to: to,
//             type: 'text',
//             text: {
//                 preview_url: false,
//                 body: response.text
//             }
//         };
//     }

//     try {
//         console.log('📤 Sending WhatsApp message:', JSON.stringify(data, null, 2));
        
//         const config = {
//             headers,
//             timeout: 30000,
//             retry: 3,
//             retryDelay: 1000
//         };
        
//         const apiResponse = await axios.post(url, data, config);
//         console.log('✅ Message sent successfully:', apiResponse.data);
//         return apiResponse.data;
//     } catch (error) {
//         console.error('❌ Error sending message:', error.response ? error.response.data : error.message);
        
//         if (error.response) {
//             console.error('Response status:', error.response.status);
//             console.error('Response headers:', error.response.headers);
            
//             // Handle specific WhatsApp API errors
//             if (error.response.status === 400) {
//                 console.error('🚨 Bad Request - Check message format or access token');
//             } else if (error.response.status === 401) {
//                 console.error('🚨 Unauthorized - Check access token');
//             } else if (error.response.status === 403) {
//                 console.error('🚨 Forbidden - Check permissions');
//             }
//         }
        
//         // For critical errors, try sending a simple text fallback
//         if (data.type === 'interactive') {
//             console.log('🔄 Attempting fallback to simple text...');
//             try {
//                 const fallbackData = {
//                     messaging_product: 'whatsapp',
//                     to: to,
//                     type: 'text',
//                     text: {
//                         preview_url: false,
//                         body: response.text + (response.buttons ? '\n\nPlease type your choice or contact support.' : '')
//                     }
//                 };
                
//                 const fallbackResponse = await axios.post(url, fallbackData, { headers, timeout: 10000 });
//                 console.log('✅ Fallback message sent:', fallbackResponse.data);
//                 return fallbackResponse.data;
//             } catch (fallbackError) {
//                 console.error('❌ Fallback also failed:', fallbackError.message);
//             }
//         }
        
//         throw error;
//     }
// }


// Function to send response back to WhatsApp
// async function sendWhatsAppResponse(to, response) {
//     const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
//     const headers = {
//         'Authorization': `Bearer ${ACCESS_TOKEN}`,
//         'Content-Type': 'application/json'
//     };

//     let data;

//     if (response.buttons && response.buttons.length > 0) {
//         // Check if any button text is longer than 20 characters
//         const hasLongButtons = response.buttons.some(button => button.length > 20);
        
//         if (response.buttons.length <= 3 && !hasLongButtons) {
//             // Create interactive buttons (only for 3 or fewer buttons AND all buttons are short)
//             data = {
//                 messaging_product: 'whatsapp',
//                 recipient_type: 'individual',
//                 to: to,
//                 type: 'interactive',
//                 interactive: {
//                     type: 'button',
//                     body: {
//                         text: response.text
//                     },
//                     action: {
//                         buttons: response.buttons.map((button, index) => ({
//                             type: 'reply',
//                             reply: {
//                                 id: `btn_${index}_${Date.now()}`,
//                                 title: button
//                             }
//                         }))
//                     }
//                 }
//             };
//         } else {
//             // For more than 3 buttons OR long buttons, use list format with proper text handling
//             if (response.buttons.length <= 10) {
//                 data = {
//                     messaging_product: 'whatsapp',
//                     recipient_type: 'individual',
//                     to: to,
//                     type: 'interactive',
//                     interactive: {
//                         type: 'list',
//                         header: {
//                             type: 'text',
//                             text: 'Select an option'
//                         },
//                         body: {
//                             text: response.text
//                         },
//                         action: {
//                             button: 'View Options',
//                             sections: [{
//                                 title: 'Available Options',
//                                 rows: response.buttons.map((button, index) => {
//                                     // Handle long button text properly
//                                     let title, description;
//                                     if (button.length > 24) {
//                                         // Split long text between title and description
//                                         title = button.substring(0, 24);
//                                         description = button.substring(24, 72); // WhatsApp allows up to 72 chars in description
//                                     } else {
//                                         title = button;
//                                         description = '';
//                                     }
                                    
//                                     return {
//                                         id: `option_${index}_${Date.now()}`,
//                                         title: title,
//                                         description: description
//                                     };
//                                 })
//                             }]
//                         }
//                     }
//                 };
//             } else {
//                 // Fallback to text with numbered options for more than 10 buttons
//                 let textWithButtons = response.text + '\n\n*Reply with number:*\n';
//                 response.buttons.forEach((button, index) => {
//                     textWithButtons += `${index + 1}. ${button}\n`;
//                 });
                
//                 data = {
//                     messaging_product: 'whatsapp',
//                     to: to,
//                     type: 'text',
//                     text: {
//                         preview_url: false,
//                         body: textWithButtons
//                     }
//                 };
//             }
//         }
//     } else {
//         // Simple text response
//         data = {
//             messaging_product: 'whatsapp',
//             to: to,
//             type: 'text',
//             text: {
//                 preview_url: false,
//                 body: response.text
//             }
//         };
//     }

//     try {
//         console.log('📤 Sending WhatsApp message:', JSON.stringify(data, null, 2));
        
//         const config = {
//             headers,
//             timeout: 30000,
//             retry: 3,
//             retryDelay: 1000
//         };
        
//         const apiResponse = await axios.post(url, data, config);
//         console.log('✅ Message sent successfully:', apiResponse.data);
//         return apiResponse.data;
//     } catch (error) {
//         console.error('❌ Error sending message:', error.response ? error.response.data : error.message);
        
//         if (error.response) {
//             console.error('Response status:', error.response.status);
//             console.error('Response headers:', error.response.headers);
            
//             // Handle specific WhatsApp API errors
//             if (error.response.status === 400) {
//                 console.error('🚨 Bad Request - Check message format or access token');
//             } else if (error.response.status === 401) {
//                 console.error('🚨 Unauthorized - Check access token');
//             } else if (error.response.status === 403) {
//                 console.error('🚨 Forbidden - Check permissions');
//             }
//         }
        
//         // For critical errors, try sending a simple text fallback
//         if (data.type === 'interactive') {
//             console.log('🔄 Attempting fallback to simple text...');
//             try {
//                 const fallbackData = {
//                     messaging_product: 'whatsapp',
//                     to: to,
//                     type: 'text',
//                     text: {
//                         preview_url: false,
//                         body: response.text + (response.buttons ? '\n\nPlease type your choice or contact support.' : '')
//                     }
//                 };
                
//                 const fallbackResponse = await axios.post(url, fallbackData, { headers, timeout: 10000 });
//                 console.log('✅ Fallback message sent:', fallbackResponse.data);
//                 return fallbackResponse.data;
//             } catch (fallbackError) {
//                 console.error('❌ Fallback also failed:', fallbackError.message);
//             }
//         }
        
//         throw error;
//     }
// }


async function sendWhatsAppResponse(to, response) {
    const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
    const headers = {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
    };

    let data;

    if (response.buttons && response.buttons.length > 0) {
        if (response.buttons.length <= 10) {
            data = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'interactive',
                interactive: {
                    type: 'list',
                    header: {
                        type: 'text',
                        text: 'Select an option'
                    },
                    body: {
                        text: response.text
                    },
                    action: {
                        button: 'View Options',
                        sections: [{
                            title: 'Available Options',
                            rows: response.buttons.map((button, index) => {
                                const fullText = button.trim();
                                let title, description;
                                
                                // Smart parsing: detect if text has parentheses for description
                                const parenMatch = fullText.match(/^(.+?)(\(.+\))$/);
                                
                                if (parenMatch) {
                                    // Text has format: "Main Title(Description)"
                                    const mainTitle = parenMatch[1].trim();
                                    const descText = parenMatch[2].trim();
                                    
                                    // Ensure title fits in 24 char limit
                                    if (mainTitle.length <= 24) {
                                        title = mainTitle;
                                        description = descText.substring(0, 72); // WhatsApp description limit
                                    } else {
                                        // Title too long, truncate at 24 and move rest to description
                                        title = mainTitle.substring(0, 24);
                                        description = (mainTitle.substring(24) + ' ' + descText).substring(0, 72);
                                    }
                                } else {
                                    // No parentheses detected - use simple split
                                    if (fullText.length <= 24) {
                                        title = fullText;
                                        description = '';
                                    } else {
                                        // Find natural break point near char 24
                                        let breakIndex = 24;
                                        
                                        // Look for space, dash, or slash near the 24-char mark
                                        for (let i = 24; i >= 18; i--) {
                                            if (fullText[i] === ' ' || fullText[i] === '-' || fullText[i] === '/') {
                                                breakIndex = i;
                                                break;
                                            }
                                        }
                                        
                                        title = fullText.substring(0, breakIndex).trim();
                                        description = fullText.substring(breakIndex).trim().substring(0, 72);
                                    }
                                }
                                
                                return {
                                    id: `option_${index}_${Date.now()}`,
                                    title: title,
                                    description: description
                                };
                            })
                        }]
                    }
                }
            };
        } else {
            // For more than 10 buttons, use numbered text format
            let textWithButtons = response.text + '\n\n*Reply with number:*\n';
            response.buttons.forEach((button, index) => {
                textWithButtons += `\n${index + 1}. ${button}`;
            });
            
            data = {
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: {
                    preview_url: false,
                    body: textWithButtons
                }
            };
        }
    } else {
        data = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: {
                preview_url: false,
                body: response.text
            }
        };
    }

    try {
        console.log('📤 Sending WhatsApp message:', JSON.stringify(data, null, 2));
        
        const config = {
            headers,
            timeout: 30000,
            retry: 3,
            retryDelay: 1000
        };
        
        const apiResponse = await axios.post(url, data, config);
        console.log('✅ Message sent successfully:', apiResponse.data);
        return apiResponse.data;
    } catch (error) {
        console.error('❌ Error sending message:', error.response ? error.response.data : error.message);
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        }
        
        if (data.type === 'interactive') {
            console.log('🔄 Attempting fallback to simple text...');
            try {
                let fallbackText = response.text + '\n\n*Available options:*\n';
                response.buttons.forEach((button, index) => {
                    fallbackText += `\n${index + 1}. ${button}`;
                });
                fallbackText += '\n\nPlease type the number of your choice.';
                
                const fallbackData = {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'text',
                    text: {
                        preview_url: false,
                        body: fallbackText
                    }
                };
                
                const fallbackResponse = await axios.post(url, fallbackData, { headers, timeout: 10000 });
                console.log('✅ Fallback message sent:', fallbackResponse.data);
                return fallbackResponse.data;
            } catch (fallbackError) {
                console.error('❌ Fallback also failed:', fallbackError.message);
            }
        }
        
        throw error;
    }
}

// Test endpoint for manual testing
app.post('/test-message', (req, res) => {
    try {
        const { userId = 'test-user', message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        console.log(` Test message from ${userId}: ${message}`);
        const response = bot.processMessage(userId, message);
        
        res.json({
            userId,
            userMessage: message,
            botResponse: response,
            sessionData: bot.getSession(userId)
        });
    } catch (error) {
        console.error('Test message error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get session data endpoint
app.get('/session/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const session = bot.getSession(userId);
        
        res.json({
            userId,
            sessionData: session
        });
    } catch (error) {
        console.error('Session retrieval error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset session endpoint
app.delete('/session/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        bot.sessions.delete(userId);
        
        res.json({
            userId,
            message: 'Session reset successfully'
        });
    } catch (error) {
        console.error('Session reset error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    res.status(500).json({ error: 'Internal server error' });
});

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_PORT_ATTEMPTS = 10;

function logServerDetails(port) {
    console.log(`WhatsApp Car Protection Chatbot Server running on port ${port}`);
    console.log(`Test the bot at: http://localhost:${port}/test-message`);
    console.log(`View sessions at: http://localhost:${port}/session/USER_ID`);
    console.log(`Reset sessions at: DELETE http://localhost:${port}/session/USER_ID`);
    console.log(`Health check at: http://localhost:${port}/`);
    console.log(`Remember to update your webhook URL in Meta Developer Dashboard if using ngrok!`);
}

function startServer(port, attemptsRemaining) {
    const server = app.listen(port, () => {
        const actualPort = server.address().port;
        if (actualPort !== DEFAULT_PORT) {
            console.warn(`Requested port ${DEFAULT_PORT} unavailable. Server running on available port ${actualPort} instead.`);
        }
        logServerDetails(actualPort);
    });

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE' && attemptsRemaining > 0) {
            console.warn(`Port ${port} is in use. Retrying with ${port + 1}...`);
            setTimeout(() => startServer(port + 1, attemptsRemaining - 1), 100);
        } else {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    });
}

startServer(DEFAULT_PORT, MAX_PORT_ATTEMPTS);
