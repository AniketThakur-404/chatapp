const express = require('express');

class WhatsAppCarProtectionBot {
    constructor() {
        this.sessions = new Map(); // Store user sessions
        this.initializePricing();
    }

    initializePricing() {
        // Base pricing structure (GST-inclusive prices converted to base prices)
        // All current prices include 18% GST, so we calculate base price = inclusive_price / 1.18
        this.pricing = {
            ppf: {
                exterior: {
                    compact: {
                        essential: Math.round(82600 / 1.18),
                        essential_matte: Math.round(94400 / 1.18),
                        core: Math.round(112100 / 1.18),
                        titanium: Math.round(165200 / 1.18)
                    },
                    large_suv: {
                        essential: Math.round(94400 / 1.18),
                        essential_matte: Math.round(106200 / 1.18),
                        core: Math.round(123900 / 1.18),
                        titanium: Math.round(177000 / 1.18)
                    },
                    luxury: {
                        essential: Math.round(106200 / 1.18),
                        essential_matte: Math.round(118000 / 1.18),
                        core: Math.round(135700 / 1.18),
                        titanium: Math.round(188800 / 1.18)
                    },
                    bike: {
                        essential: Math.round(20060 / 1.18),
                        essential_matte: Math.round(23600 / 1.18),
                        core: Math.round(25960 / 1.18),
                        titanium: Math.round(37760 / 1.18)
                    }
                },
                interior: {
                    essential: Math.round(11000 / 1.18),
                    essential_matte: Math.round(13000 / 1.18),
                    core: Math.round(15000 / 1.18),
                    titanium: Math.round(20000 / 1.18)
                },
                both: {
                    compact: {
                        essential: Math.round((82600 + 11000) / 1.18),
                        essential_matte: Math.round((94400 + 13000) / 1.18),
                        core: Math.round((112100 + 15000) / 1.18),
                        titanium: Math.round((165200 + 20000) / 1.18)
                    },
                    large_suv: {
                        essential: Math.round((94400 + 11000) / 1.18),
                        essential_matte: Math.round((106200 + 13000) / 1.18),
                        core: Math.round((123900 + 15000) / 1.18),
                        titanium: Math.round((177000 + 20000) / 1.18)
                    },
                    luxury: {
                        essential: Math.round((106200 + 11000) / 1.18),
                        essential_matte: Math.round((118000 + 13000) / 1.18),
                        core: Math.round((135700 + 15000) / 1.18),
                        titanium: Math.round((188800 + 20000) / 1.18)
                    },
                    bike: {
                        essential: Math.round((20060 + 11000) / 1.18),
                        essential_matte: Math.round((23600 + 13000) / 1.18),
                        core: Math.round((25960 + 15000) / 1.18),
                        titanium: Math.round((37760 + 20000) / 1.18)
                    }
                }
            },
            ceramic: {
                compact: {
                    '1yr': Math.round(15000 / 1.18),
                    '3yr': Math.round(25000 / 1.18),
                    '5yr': Math.round(30000 / 1.18),
                    '7yr': Math.round(36000 / 1.18)
                },
                large_suv: {
                    '1yr': Math.round(16000 / 1.18),
                    '3yr': Math.round(27000 / 1.18),
                    '5yr': Math.round(32000 / 1.18),
                    '7yr': Math.round(37000 / 1.18)
                },
                luxury: {
                    '1yr': Math.round(17000 / 1.18),
                    '3yr': Math.round(33000 / 1.18),
                    '5yr': Math.round(40000 / 1.18),
                    '7yr': Math.round(50000 / 1.18)
                },
                bike: {
                    '1yr': Math.round(3000 / 1.18),
                    '3yr': Math.round(6000 / 1.18),
                    '5yr': Math.round(6000 / 1.18),
                    '7yr': Math.round(6000 / 1.18)
                }
            },
            graphene: {
                standard: {
                    compact: Math.round(40000 / 1.18),
                    large_suv: Math.round(45000 / 1.18),
                    luxury: Math.round(50000 / 1.18),
                    bike: Math.round(9000 / 1.18)
                },
                premium: {
                    compact: Math.round(60000 / 1.18),
                    large_suv: Math.round(70000 / 1.18),
                    luxury: Math.round(80000 / 1.18),
                    bike: Math.round(14000 / 1.18)
                }
            }
        };
    }

    // Helper method to format price display
    formatPrice(basePrice) {
        return `₹${basePrice.toLocaleString()} + 18% GST`;
    }


    calculateDynamicPricing() {
        // Calculate exterior PPF pricing
        const baseExteriorPrices = this.pricing.ppf.exterior.compact;
        const baseBothPrices = this.pricing.ppf.both.compact;
        
        // Large SUV: +20%
        Object.keys(baseExteriorPrices).forEach(packageName => {
            this.pricing.ppf.exterior.large_suv[packageName] = Math.round(baseExteriorPrices[packageName] * 1.2);
            this.pricing.ppf.both.large_suv[packageName] = Math.round(baseBothPrices[packageName] * 1.2);
        });

        // Luxury: +40%
        Object.keys(baseExteriorPrices).forEach(packageName => {
            this.pricing.ppf.exterior.luxury[packageName] = Math.round(baseExteriorPrices[packageName] * 1.4);
            this.pricing.ppf.both.luxury[packageName] = Math.round(baseBothPrices[packageName] * 1.4);
        });

        // Bike: -60%
        Object.keys(baseExteriorPrices).forEach(packageName => {
            this.pricing.ppf.exterior.bike[packageName] = Math.round(baseExteriorPrices[packageName] * 0.4);
            this.pricing.ppf.both.bike[packageName] = Math.round(baseBothPrices[packageName] * 0.4);
        });
    }

    getSession(userId) {
        if (!this.sessions.has(userId)) {
            this.sessions.set(userId, {
                step: 'initial',
                user_service_type: null,
                vehicle_type: null,
                ppf_coverage_type: null, // exterior, interior, both
                selected_package: null,
                protection_duration: null,
                user_location: null,
                preferred_date: null,
                preferred_time: null,
                conversation_history: [],
                ppf_interior_addon: false, // For upsell in exterior path
                expert_requested: false, // Track if expert was requested
                navigation_history: [], // Track navigation steps for "Previous" functionality
                previous_step_data: {} // Store data from previous steps
            });
        }
        return this.sessions.get(userId);
    }

    processMessage(userId, message) {
        const session = this.getSession(userId);
        const normalizedMessage = message.toLowerCase().trim();
        
        // Add to conversation history
        session.conversation_history.push({ user: message, timestamp: new Date() });

        let response;

        // Handle global commands first
        if (this.isGlobalCommand(normalizedMessage)) {
            response = this.handleGlobalCommand(normalizedMessage, session);
        } else {
            response = this.handleStepBasedFlow(normalizedMessage, session);
        }

        // Add bot response to history
        session.conversation_history.push({ bot: response.text, timestamp: new Date() });

        return response;
    }

    isGlobalCommand(message) {
        const globalCommands = ['expert', 'menu', 'start', 'help', 'services', 'prices', 'location', 'start over', 'previous', 'back'];
        return globalCommands.some(cmd => message.includes(cmd));
    }

    handleGlobalCommand(message, session) {
        if (message.includes('expert')) {
            return this.handleExpertRequest(session);
        }

        if (message.includes('start over')) {
            return this.handleStartOver(session);
        }

        if (message.includes('previous') || message.includes('back')) {
            return this.handlePrevious(session);
        }

        if (message.includes('menu')) {
            return {
                text: `📋 **UNLAYR Quick Menu:**\n• 'start' - Begin protection consultation\n• 'services' - View our services\n• 'expert' - Connect with senior protection expert\n• 'location' - Check service areas (Delhi NCR only)\n• 'previous' - Go back to last step\n• 'start over' - Restart conversation`,
                buttons: ['Start Protection Plan', 'Expert Consultation', 'View Services']
            };
        }

        if (message.includes('start')) {
            session.step = 'service_selection';
            return this.handleInitialTrigger(session);
        }

        if (message.includes('services')) {
            return {
                text: `✨ **Explore Our Portfolio**\n\n🛡️ **Advanced Pre-Cut PPF**\nThe ultimate invisible, self-healing shield with precision engineering\n\n🌟 **Graphene Coating**\nDiamond-hard 10H protection with liquid-glass finish\n\n💎 **Ceramic Coating**\nMirror-like brilliance with hydrophobic self-cleaning\n\nEach treatment includes complimentary maintenance and doorstep luxury application.`,
                buttons: ['Craft Protection Plan', 'Expert Consultation']
            };
        }

        if (message.includes('prices')) {
            return {
                text: `💰 **Investment Overview:**\n\n**PPF Collections (Exterior):**\n• ESSENTIAL Collection: From ₹70,000 + 18% GST\n• CORE Collection: From ₹95,000 + 18% GST\n• TITANIUM Collection: From ₹1,40,000 + 18% GST\n\n**Graphene Coatings:**\n• Standard Package: From ₹34,000 + 18% GST\n• Premium Package: From ₹51,000 + 18% GST\n\n**Ceramic Programs:**\n• 1-Year Plan: ₹12,700 + 18% GST\n• 7-Year Ultimate: ₹42,400 + 18% GST\n\n*Exact investment varies by vehicle class. Begin consultation for precise quote.*`,
                buttons: ['Begin Consultation', 'Expert Call']
            };
        }

        return this.handleUnknownInput(session);
    }

    handleStepBasedFlow(message, session) {
        switch (session.step) {
            case 'initial':
                return this.handleInitialTrigger(session);
            
            case 'service_selection':
                return this.handleServiceSelection(message, session);
            
            case 'vehicle_selection':
                return this.handleVehicleSelection(message, session);
            
            case 'ppf_coverage_selection':
                return this.handlePPFCoverageSelection(message, session);
            
            case 'ppf_package_selection':
                return this.handlePPFPackageSelection(message, session);
            
            case 'ppf_interior_upsell':
                return this.handlePPFInteriorUpsell(message, session);
            
            case 'graphene_package_selection':
                return this.handleGraphenePackageSelection(message, session);
            
            case 'ceramic_duration_selection':
                return this.handleCeramicDurationSelection(message, session);
            
            case 'location_input':
                return this.handleLocationInput(message, session);
            
            case 'expert_contact':
                return this.handleExpertContact(message, session);
            
            case 'simplified_confirmation':
                return this.handleSimplifiedConfirmationResponse(message, session);
            
            default:
                return this.handleUnknownInput(session);
        }
    }

    handleInitialTrigger(session) {
        this.saveToNavigationHistory(session, session.step);
        session.step = 'service_selection';
        return {
            text: `Welcome to the UNLAYR experience. We are India's premier studio for bespoke automotive protection, delivered with white-glove service to your doorstep.\n\n📍 Service Area: Delhi NCR only\n🌐 Website: https://unlayr.com/\n📸 Instagram: https://www.instagram.com/unlayr.in?igsh=emw5dm44azdodWtj\n\nI am your digital concierge and can assist you in crafting the perfect protection plan for your vehicle. At any moment, you may request a call from our senior protection expert by typing 'Expert'.\n\nPlease select the nature of protection you envision for your vehicle:`,
            buttons: [
                'Advanced Pre Cut PPF(An Invisible, Self-Healing Shield)',
                'Ceramic Coating (A Deep, Mirror-Like Finish)',
                'Graphene Coating (Diamond-Hard Protection)',
                'Custom Service',
                'Expert Recommendation (Guide Me to the Ideal Solution)',
                '🔄 Start Over'
            ]
        };
    }

    handleServiceSelection(message, session) {
        const normalizedMessage = message.toLowerCase();

        // Service selection logic - direct from welcome message
        if (message.includes('Advanced Pre Cut PPF') || normalizedMessage.includes('ppf') || normalizedMessage.includes('paint protection')) {
            this.saveToNavigationHistory(session, session.step);
            session.user_service_type = 'PPF';
            session.step = 'vehicle_selection';
            return this.handleVehicleSelection('', session);
        }

        if (message.includes('Ceramic Coating') || normalizedMessage.includes('ceramic')) {
            this.saveToNavigationHistory(session, session.step);
            session.user_service_type = 'Ceramic';
            session.step = 'vehicle_selection';
            return this.handleVehicleSelection('', session);
        }

        if (message.includes('Graphene Coating') || normalizedMessage.includes('graphene')) {
            this.saveToNavigationHistory(session, session.step);
            session.user_service_type = 'Graphene';
            session.step = 'vehicle_selection';
            return this.handleVehicleSelection('', session);
        }

        if (message.includes('Custom Service') || normalizedMessage.includes('custom')) {
            return this.handleExpertRequest(session);
        }

        if (message.includes('Expert Recommendation') || normalizedMessage.includes('expert')) {
            return this.handleExpertRequest(session);
        }

        // Handle legacy "Craft My Protection Plan" or "Explore Our Portfolio" if they still come through
        if (message.includes('Craft My Protection Plan') || normalizedMessage.includes('craft') || normalizedMessage.includes('protection plan')) {
            return {
                text: `Please select the nature of protection you envision for your vehicle:`,
                buttons: [
                    'Advanced Pre Cut PPF(An Invisible, Self-Healing Shield)',
                    'Ceramic Coating (A Deep, Mirror-Like Finish)',
                    'Graphene Coating (Diamond-Hard Protection)',
                    'Custom Service',
                    'Expert Recommendation (Guide Me to the Ideal Solution)',
                    '🔄 Start Over'
                ]
            };
        }

        if (message.includes('Explore Our Portfolio') || normalizedMessage.includes('explore') || normalizedMessage.includes('portfolio')) {
            return this.handleGlobalCommand('services', session);
        }

        return {
            text: `Please select the protection service you envision:`,
            buttons: [
                'Advanced Pre Cut PPF(An Invisible, Self-Healing Shield)',
                'Ceramic Coating (A Deep, Mirror-Like Finish)',
                'Graphene Coating (Diamond-Hard Protection)',
                'Custom Service',
                'Expert Recommendation (Guide Me to the Ideal Solution)',
                '🔄 Start Over'
            ]
        };
    }

    handleVehicleSelection(message, session) {
        if (!message) {
            return {
                text: `Understood. To tailor our offerings precisely, please classify your vehicle.`,
                buttons: [
                    'Compact SUV/Sedan (e.g., Creta, Seltos)',
                    'Full-Size SUV / MUV (e.g., Fortuner, Safari)',
                    'Luxury Class (e.g., BMW, Mercedes, Audi)',
                    'Bike/Superbike',
                    '⬅️ Previous',
                    '🔄 Start Over'
                ]
            };
        }

        // Handle vehicle selection
        if (message.includes('Compact SUV/Sedan') || message.toLowerCase().includes('compact')) {
            session.vehicle_type = 'compact';
        } else if (message.includes('Full-Size SUV / MUV') || message.toLowerCase().includes('full-size')) {
            session.vehicle_type = 'large_suv';
        } else if (message.includes('Luxury Class') || message.toLowerCase().includes('luxury')) {
            session.vehicle_type = 'luxury';
        } else if (message.includes('Bike/Superbike') || message.toLowerCase().includes('bike')) {
            session.vehicle_type = 'bike';
        } else {
            return {
                text: `Please select your vehicle classification:`,
                buttons: [
                    'Compact SUV/Sedan (e.g., Creta, Seltos)',
                    'Full-Size SUV / MUV (e.g., Fortuner, Safari)',
                    'Luxury Class (e.g., BMW, Mercedes, Audi)',
                    'Bike/Superbike',
                    '⬅️ Previous',
                    '🔄 Start Over'
                ]
            };
        }

        // Route to next step based on service type
        this.saveToNavigationHistory(session, session.step);
        if (session.user_service_type === 'PPF') {
            session.step = 'ppf_coverage_selection';
            return this.handlePPFCoverageSelection('', session);
        } else if (session.user_service_type === 'Graphene') {
            session.step = 'graphene_package_selection';
            return this.handleGraphenePackageSelection('', session);
        } else if (session.user_service_type === 'Ceramic') {
            session.step = 'ceramic_duration_selection';
            return this.handleCeramicDurationSelection('', session);
        }
    }

    handlePPFCoverageSelection(message, session) {
        if (!message) {
            return {
                text: `An excellent choice. Paint Protection Film is the ultimate defense against scratches and swirls.\n\nTo begin, where would you like us to apply this protection?`,
                buttons: [
                    'Exterior Paint',
                    'Interior Surfaces',
                    'Both Exterior & Interior',
                    '⬅️ Previous',
                    '🔄 Start Over'
                ]
            };
        }

        if (message.includes('Both Exterior & Interior') || message.toLowerCase().includes('both')) {
            session.ppf_coverage_type = 'both';
        } else if (message.includes('Exterior Paint') || message.toLowerCase().includes('exterior')) {
            session.ppf_coverage_type = 'exterior';
        } else if (message.includes('Interior Surfaces') || message.toLowerCase().includes('interior')) {
            session.ppf_coverage_type = 'interior';
        } else {
            return {
                text: `Please select your preferred coverage area:`,
                buttons: [
                    'Exterior Paint',
                    'Interior Surfaces',
                    'Both Exterior & Interior',
                    '⬅️ Previous',
                    '🔄 Start Over'
                ]
            };
        }

        this.saveToNavigationHistory(session, session.step);
        session.step = 'ppf_package_selection';
        return this.handlePPFPackageSelection('', session);
    }

    // handlePPFPackageSelection(message, session) {
    //     if (!message) {
    //         const coverageType = session.ppf_coverage_type;
    //         const vehicleType = session.vehicle_type;
    //         const exteriorPrices = this.pricing.ppf.exterior[vehicleType];
    //         const interiorPrices = this.pricing.ppf.interior;
    //         const bothPrices = this.pricing.ppf.both[vehicleType];

    //         let investmentDisplay;
    //         let packageInclusions;
    //         let botText = `An exceptional choice. Our films are meticulously engineered from advanced thermoplastic urethane, delivering unrivaled clarity, impenetrable defense, sophisticated self-healing capabilities, and paramount heat and UV resistance.\n\n`;

    //         if (coverageType === 'both') {
    //             investmentDisplay = {
    //                 essential: `Exterior - ₹${exteriorPrices.essential.toLocaleString()}, Interior - ₹${interiorPrices.essential.toLocaleString()}`,
    //                 essential_matte: `Exterior - ₹${exteriorPrices.essential_matte.toLocaleString()}, Interior - ₹${interiorPrices.essential_matte.toLocaleString()}`,
    //                 core: `Exterior - ₹${exteriorPrices.core.toLocaleString()}, Interior - ₹${interiorPrices.core.toLocaleString()}`,
    //                 titanium: `Exterior - ₹${exteriorPrices.titanium.toLocaleString()}, Interior - ₹${interiorPrices.titanium.toLocaleString()}`
    //             };
    //             packageInclusions = `*THE UNLAYR PPF PACKAGE INCLUDES -*\n• Full-body precision pre-cut PPF\n• Interior PPF for screens & trims\n• Blade-free installation\n• No dismantling of car parts\n• Multi-stage paint correction\n• Swirl mark & scratch removal\n• Deep interior cleaning & detailing\n• Exterior clay & decontamination\n• Doorstep luxury application\n• *Complimentary alloy wheel and windshield/sunroof ceramic coating (worth ₹15k)*`;
    //         } else if (coverageType === 'exterior') {
    //             investmentDisplay = {
    //                 essential: `₹${exteriorPrices.essential.toLocaleString()}`,
    //                 essential_matte: `₹${exteriorPrices.essential_matte.toLocaleString()}`,
    //                 core: `₹${exteriorPrices.core.toLocaleString()}`,
    //                 titanium: `₹${exteriorPrices.titanium.toLocaleString()}`
    //             };
    //             packageInclusions = `*THE UNLAYR PPF PACKAGE INCLUDES -*\n• Full-body precision pre-cut PPF\n• Blade-free installation\n• No dismantling of car parts\n• Multi-stage paint correction\n• Swirl mark & scratch removal\n• Deep interior cleaning & detailing\n• Exterior clay & decontamination\n• Doorstep luxury application\n• *Complimentary alloy wheel and windshield/sunroof ceramic coating (worth ₹15k)*`;
    //         } else if (coverageType === 'interior') {
    //             investmentDisplay = {
    //                 essential: `₹${interiorPrices.essential.toLocaleString()}`,
    //                 essential_matte: `₹${interiorPrices.essential_matte.toLocaleString()}`,
    //                 core: `₹${interiorPrices.core.toLocaleString()}`,
    //                 titanium: `₹${interiorPrices.titanium.toLocaleString()}`
    //             };
    //             packageInclusions = `*THE UNLAYR PPF PACKAGE INCLUDES -*\n• Advanced Pre Cut Interior PPF \n• Blade-free installation\n• Dashboard, screens, console, trims & panels protected with precision-cut films.\n• Complete interior cleaning & detailing\n• Doorstep luxury application\n• *Complimentary alloy wheel and windshield/sunroof ceramic coating (worth ₹15k🎁)*`;
    //         }

    //         botText += `◯ ESSENTIAL Collection\n▪ 7-Year Assurance\n▪ Advanced TPU - 190m\n▪ Investment: ${investmentDisplay.essential}\n\n`;
    //         botText += `◯ ESSENTIAL MATTE\n▪ 7-year assurance\n▪ Advanced TPU material - 190m\n▪ Investment: ${investmentDisplay.essential_matte}\n\n`;
    //         botText += `◯ CORE Collection\n▪ 10-Year Assurance\n▪ Next Gen Aliphatic TPU - 200m\n▪ Investment: ${investmentDisplay.core}\n\n`;
    //         botText += `◯ TITANIUM Collection\n▪ Warranty: Lifetime Assurance\n▪ Ultra-premium aliphatic TPU with advanced polycaprolactone - 215m\n▪ Investment: ${investmentDisplay.titanium}\n\n`;
    //         botText += packageInclusions;

    //         return {
    //             text: botText,
    //             buttons: [
    //                 'Select ESSENTIAL',
    //                 'Select ESSENTIAL MATTE',
    //                 'Select CORE',
    //                 'Select TITANIUM',
    //                 'Request Expert Call ',
                     
    //             ]
    //         };
    //     }

    //     const normalizedMessage = message.toLowerCase();
    //     let selectedPackage;
    //     if (normalizedMessage.includes('essential matte')) {
    //         selectedPackage = 'essential_matte';
    //     } else if (normalizedMessage.includes('essential')) {
    //         selectedPackage = 'essential';
    //     } else if (normalizedMessage.includes('core')) {
    //         selectedPackage = 'core';
    //     } else if (normalizedMessage.includes('titanium')) {
    //         selectedPackage = 'titanium';
    //     } else if (normalizedMessage.includes('expert') || normalizedMessage.includes('call')) {
    //         return this.handleExpertRequest(session);
    //     } else if (normalizedMessage.includes('technical') || normalizedMessage.includes('dossier')) {
    //         return this.handleExpertRequest(session);
    //     } else {
    //         return {
    //             text: `Please choose your PPF collection:`,
    //             buttons: [
    //                 'Select ESSENTIAL',
    //                 'Select ESSENTIAL MATTE',
    //                 'Select CORE',
    //                 'Select TITANIUM',
    //                 'Request Expert Call ',
    //                 ' View Technical Dossier'
    //             ]
    //         };
    //     }

    //     session.selected_package = selectedPackage;

    //     if (session.ppf_coverage_type === 'exterior') {
    //         session.step = 'ppf_interior_upsell';
    //         return this.handlePPFInteriorUpsell('', session);
    //     } else {
    //         session.step = 'location_input';
    //         return this.handleLocationInput('', session);
    //     }
    // }


    handlePPFPackageSelection(message, session) {
        if (!message) {
            const coverageType = session.ppf_coverage_type;
            const vehicleType = session.vehicle_type;
            const exteriorPrices = this.pricing.ppf.exterior[vehicleType];
            const interiorPrices = this.pricing.ppf.interior;
            const bothPrices = this.pricing.ppf.both[vehicleType];

            let investmentDisplay;
            let botText = `Our PPF collections deliver unrivaled clarity and self-healing protection:\n\n`;

            if (coverageType === 'both') {
                investmentDisplay = {
                    essential: this.formatPrice(bothPrices.essential),
                    essential_matte: this.formatPrice(bothPrices.essential_matte),
                    core: this.formatPrice(bothPrices.core),
                    titanium: this.formatPrice(bothPrices.titanium)
                };
            } else if (coverageType === 'exterior') {
                investmentDisplay = {
                    essential: this.formatPrice(exteriorPrices.essential),
                    essential_matte: this.formatPrice(exteriorPrices.essential_matte),
                    core: this.formatPrice(exteriorPrices.core),
                    titanium: this.formatPrice(exteriorPrices.titanium)
                };
            } else if (coverageType === 'interior') {
                investmentDisplay = {
                    essential: this.formatPrice(interiorPrices.essential),
                    essential_matte: this.formatPrice(interiorPrices.essential_matte),
                    core: this.formatPrice(interiorPrices.core),
                    titanium: this.formatPrice(interiorPrices.titanium)
                };
            }

            // Shortened message to fit WhatsApp's 1024 character limit
            botText += `◯ ESSENTIAL - 7yr warranty: ${investmentDisplay.essential}\n`;
            botText += `◯ ESSENTIAL MATTE - 7yr warranty: ${investmentDisplay.essential_matte}\n`;
            botText += `◯ CORE - 10yr warranty: ${investmentDisplay.core}\n`;
            botText += `◯ TITANIUM - Lifetime warranty: ${investmentDisplay.titanium}\n\n`;
            botText += `Includes: Full PPF, paint correction, detailing & complimentary ceramic coating`;

            return {
                text: botText,
                buttons: [
                    'Select ESSENTIAL',
                    'Select ESSENTIAL MATTE',
                    'Select CORE',
                    'Select TITANIUM',
                    'Request Expert Call',
                    '⬅️ Previous',
                    '🔄 Start Over'
                ]
            };
        }

        const normalizedMessage = message.toLowerCase();
        let selectedPackage;
        if (normalizedMessage.includes('essential matte')) {
            selectedPackage = 'essential_matte';
        } else if (normalizedMessage.includes('essential')) {
            selectedPackage = 'essential';
        } else if (normalizedMessage.includes('core')) {
            selectedPackage = 'core';
        } else if (normalizedMessage.includes('titanium')) {
            selectedPackage = 'titanium';
        } else if (normalizedMessage.includes('expert') || normalizedMessage.includes('call')) {
            return this.handleExpertRequest(session);
        } else if (normalizedMessage.includes('technical') || normalizedMessage.includes('dossier')) {
            return this.handleExpertRequest(session);
        } else {
            return {
                text: `Please choose your PPF collection:`,
                buttons: [
                    'Select ESSENTIAL',
                    'Select ESSENTIAL MATTE',
                    'Select CORE',
                    'Select TITANIUM',
                    'Request Expert Call',
                    '⬅️ Previous',
                    '🔄 Start Over'
                ]
            };
        }

        session.selected_package = selectedPackage;
        this.saveToNavigationHistory(session, session.step);

        if (session.ppf_coverage_type === 'exterior') {
            session.step = 'ppf_interior_upsell';
            return this.handlePPFInteriorUpsell('', session);
        } else {
            session.step = 'location_input';
            return this.handleLocationInput('', session);
        }
    }

    handlePPFInteriorUpsell(message, session) {
        if (!message) {
            const interiorPrices = this.pricing.ppf.interior;
            return {
                text: `Excellent choice! Your ${session.selected_package.toUpperCase()} exterior PPF is confirmed.\n\nWould you like to add interior PPF protection for your dashboard, screens, and trim panels?\n\n◯ Interior PPF Protection\n▪ Same ${session.selected_package.toUpperCase()} quality\n▪ Dashboard, console & trim coverage\n▪ Investment: ${this.formatPrice(interiorPrices[session.selected_package])}\n\nThis completes your comprehensive protection package.`,
                buttons: [
                    'Add Interior PPF',
                    'Continue with Exterior Only',
                    'Expert Consultation',
                    '⬅️ Previous',
                    '🔄 Start Over'
                ]
            };
        }

        const normalizedMessage = message.toLowerCase();
        
        if (normalizedMessage.includes('add interior') || normalizedMessage.includes('yes')) {
            session.ppf_interior_addon = true;
            this.saveToNavigationHistory(session, session.step);
            session.step = 'location_input';
            return this.handleLocationInput('', session);
        } else if (normalizedMessage.includes('continue') || normalizedMessage.includes('exterior only') || normalizedMessage.includes('no')) {
            session.ppf_interior_addon = false;
            this.saveToNavigationHistory(session, session.step);
            session.step = 'location_input';
            return this.handleLocationInput('', session);
        } else if (normalizedMessage.includes('expert')) {
            return this.handleExpertRequest(session);
        } else {
            return {
                text: `Would you like to add interior PPF protection?`,
                buttons: [
                    'Add Interior PPF',
                    'Continue with Exterior Only',
                    'Expert Consultation',
                    '⬅️ Previous',
                    '🔄 Start Over'
                ]
            };
        }
    }

    handleGraphenePackageSelection(message, session) {
        if (!message) {
            const vehicleType = session.vehicle_type;
            const standardPrice = this.pricing.graphene.standard[vehicleType];
            const premiumPrice = this.pricing.graphene.premium[vehicleType];

            let vehicleDisplayName = {
                compact: 'Compact SUV/Sedan (e.g., Creta, Seltos)',
                large_suv: 'Full-Size SUV / MUV (e.g., Fortuner, Safari)',
                luxury: 'Luxury Class (e.g., BMW, Mercedes, Audi)',
                bike: 'Bike/Superbike'
            }[vehicleType];

            const grapheneText = `An excellent decision for achieving a breathtaking, liquid-glass finish. Our Graphene-infused coatings create a 10H diamond-hard shield over your paintwork to shield against scratches, UV rays, and heat, plus hydrophobic self-cleaning.\n\nFor your ${vehicleDisplayName}, we present the UNLAYR Collection:\n\n◯ Standard Package\n▪ 5-Year Performance Guarantee\n▪ 1+4 periodic checks\n▪ Investment: ${this.formatPrice(standardPrice)}\n\n◯ Premium Package\n▪ 10-Year Performance Guarantee\n▪ 1+9 periodic checks\n▪ Investment: ${this.formatPrice(premiumPrice)}\n\nTHE UNLAYR GRAPHENE PACKAGE INCLUDES -\n• Premium Graphene Coating Application\n• Coverage: Full body, glass, alloys, lights & side mirrors\n• Multi-stage paint correction\n• Swirl mark & scratch removal\n• Deep interior cleaning & detailing\n• Exterior clay & decontamination\n• Doorstep luxury application`;

            return {
                text: grapheneText,
                buttons: [
                    'Select Standard',
                    'Select Premium',
                    'Request Expert Call',
                    '⬅️ Previous',
                    '🔄 Start Over'
                ]
            };
        }

        const normalizedMessage = message.toLowerCase();
        if (normalizedMessage.includes('standard')) {
            session.selected_package = 'standard';
        } else if (normalizedMessage.includes('premium')) {
            session.selected_package = 'premium';
        } else if (normalizedMessage.includes('expert') || normalizedMessage.includes('call')) {
            return this.handleExpertRequest(session);
        } else if (normalizedMessage.includes('technical') || normalizedMessage.includes('dossier')) {
            return this.handleExpertRequest(session);
        } else {
            return {
                text: `Please choose your Graphene package:`,
                buttons: [
                    'Select Standard',
                    'Select Premium',
                    'Request Expert Call',
                    '⬅️ Previous',
                    '🔄 Start Over'
                ]
            };
        }

        session.selected_package = selectedPackage;
        this.saveToNavigationHistory(session, session.step);
        session.step = 'location_input';
        return this.handleLocationInput('', session);
    }

    handleCeramicDurationSelection(message, session) {
        if (!message) {
            const vehicleType = session.vehicle_type;
            const prices = this.pricing.ceramic[vehicleType];
            
            return {
                text: `Excellent choice. We use our Signature Ceramic Coating for a flawless, liquid-glass finish.\n\nSimply choose the duration of your Care Program. Each plan guarantees the performance with a complimentary Annual Maintenance Service to ensure lasting brilliance.\n\n*(All programs include a full paint correction with the initial application.)*\n\n1️⃣ **1-Year Plan | The Annual Refresh**\n• 1-Year Guarantee & 1 Maintenance Service\n• Investment: ${this.formatPrice(prices['1yr'])}\n\n3️⃣ **3-Year Plan | The Enthusiast's Choice**\n• 3-Year Guarantee & 3 Maintenance Services\n• Investment: ${this.formatPrice(prices['3yr'])}\n\n5️⃣ **5-Year Plan | The Professional's Package**\n• 5-Year Guarantee & 5 Maintenance Services\n• ⭐ Includes Interior Detailing\n• Investment: ${this.formatPrice(prices['5yr'])}\n\n7️⃣ **7-Year Plan | The Ultimate Care Program**\n• 7-Year Guarantee & 7 Maintenance Services\n• ⭐ Includes Interior Detailing\n• Investment: ${this.formatPrice(prices['7yr'])}`,
                buttons: [
                    '1-Yr Plan',
                    '3-Yr Plan',
                    '5-Yr Plan',
                    '7-Yr Plan',
                    'About Maintenance',
                    'Talk to Expert',
                    '⬅️ Previous',
                    '🔄 Start Over'
                ]
            };
        }

        const normalizedMessage = message.toLowerCase();
        if (normalizedMessage.includes('1-yr') || normalizedMessage.includes('1 year')) {
            session.protection_duration = '1yr';
        } else if (normalizedMessage.includes('3-yr') || normalizedMessage.includes('3 year')) {
            session.protection_duration = '3yr';
        } else if (normalizedMessage.includes('5-yr') || normalizedMessage.includes('5 year')) {
            session.protection_duration = '5yr';
        } else if (normalizedMessage.includes('7-yr') || normalizedMessage.includes('7 year')) {
            session.protection_duration = '7yr';
        } else if (normalizedMessage.includes('about maintenance')) {
            return {
                text: `Our complimentary Annual Maintenance Service includes a thorough inspection, touch-up coating application if needed, and full exterior decontamination to maintain the coating's performance and brilliance.`,
                buttons: [
                    '1-Yr Plan',
                    '3-Yr Plan',
                    '5-Yr Plan',
                    '7-Yr Plan',
                    'Talk to Expert',
                    '⬅️ Previous',
                    '🔄 Start Over'
                ]
            };
        } else if (normalizedMessage.includes('talk to expert')) {
            return this.handleExpertRequest(session);
        } else {
            return {
                text: `Please select your ceramic care program:`,
                buttons: [
                    '1-Yr Plan',
                    '3-Yr Plan',
                    '5-Yr Plan',
                    '7-Yr Plan',
                    'About Maintenance',
                    'Talk to Expert',
                    '⬅️ Previous',
                    '🔄 Start Over'
                ]
            };
        }

        this.saveToNavigationHistory(session, session.step);
        session.step = 'location_input';
        return this.handleLocationInput('', session);
    }

    // Updated handleLocationInput method
    handleLocationInput(message, session) {
    if (!message) {
        return {
            text: `To arrange our at-home service, please provide the address for the vehicle's treatment.\n\n*We serve the Delhi NCR region (Delhi, Noida, Gurgaon, Faridabad, Ghaziabad)*\n\n*Example: "Sector 56, Gurgaon" or "CP, New Delhi"*\n(Or share your location)`,
            buttons: ['⬅️ Previous', '🔄 Start Over'] // Free text input, note share location
        };
    }

    // Updated validation for Delhi NCR region
    const delhiNcrAreas = ['delhi', 'gurgaon', 'gurugram', 'noida', 'faridabad', 'ghaziabad', 'ncr'];
    const hasValidArea = delhiNcrAreas.some(area => message.toLowerCase().includes(area));
    
    if (message.length < 5) {
        return {
            text: `Could you please provide your location in Delhi NCR? \n*(e.g., Sector 15, Gurgaon or CP, New Delhi)*\n(Or share your location)`,
            buttons: ['⬅️ Previous', '🔄 Start Over']
        };
    }

    if (!hasValidArea) {
        return {
            text: `We currently serve the Delhi NCR region only. Please provide an address in Delhi, Noida, Gurgaon, Faridabad, or Ghaziabad.\n\n*Example: "Sector 15, Gurgaon" or "CP, New Delhi"*\n(Or share your location)`,
            buttons: ['⬅️ Previous', '🔄 Start Over']
        };
    }

    session.user_location = message;

    // Show intermediate summary as per PDF workflow
    let totalPrice = this.calculateTotalPrice(session);
    let packageName = this.getPackageName(session);
    let vehicleDisplayName = this.getVehicleDisplayName(session.vehicle_type);

    const summaryText = `Exquisite! Our certified applicators are available in your area.\n\n**Your Booking Summary:**\n• Service: ${packageName}\n• Vehicle: ${vehicleDisplayName}\n• Location: ${session.user_location}\n• Total Investment: ${this.formatPrice(totalPrice)}\n\nTo proceed with your booking, our expert will call you to coordinate the perfect timing and finalize your appointment.`;

    this.saveToNavigationHistory(session, session.step);
    session.step = 'expert_contact';
    return {
        text: summaryText,
        buttons: [
            'Request Expert Callback',
            'Continue Chat Booking',
            '⬅️ Previous',
            '🔄 Start Over'
        ]
    };
}

    handleDateSelection(message, session) {
        const normalizedMessage = message.toLowerCase();
        if (normalizedMessage.includes('today')) {
            session.preferred_date = 'Today';
        } else if (normalizedMessage.includes('tomorrow')) {
            session.preferred_date = 'Tomorrow';
        } else if (normalizedMessage.includes('day after')) {
            session.preferred_date = 'Day After Tomorrow';
        } else if (normalizedMessage.includes('weekend')) {
            session.preferred_date = 'This Weekend';
        } else {
            return {
                text: `Please select your preferred date:`,
                buttons: [
                    'Today',
                    'Tomorrow', 
                    'Day After Tomorrow',
                    'This Weekend'
                ]
            };
        }

        session.step = 'time_selection';
        return {
            text: ` **Preferred Time Slot:**`,
            buttons: [
                'Morning (10-1)',
                'Afternoon (1-4)',
                'Evening (4-7)',
                'Flexible'
            ]
        };
    }

    handleTimeSelection(message, session) {
        const normalizedMessage = message.toLowerCase();
        if (normalizedMessage.includes('morning')) {
            session.preferred_time = 'Morning (10-1)';
        } else if (normalizedMessage.includes('afternoon')) {
            session.preferred_time = 'Afternoon (1-4)';
        } else if (normalizedMessage.includes('evening')) {
            session.preferred_time = 'Evening (4-7)';
        } else if (normalizedMessage.includes('flexible')) {
            session.preferred_time = 'Flexible';
        } else {
            return {
                text: `Please select your preferred time:`,
                buttons: [
                    'Morning (10-1)',
                    'Afternoon (1-4)',
                    'Evening (4-7)',
                    'Flexible'
                ]
            };
        }

        session.step = 'final_confirmation';
        return this.handleFinalConfirmation('', session);
    }

    // Updated handleFinalConfirmation method
    handleFinalConfirmation(message, session) {
        if (!message) {
            // Calculate total investment
            let totalPrice = this.calculateTotalPrice(session);
            let collectionName = this.getCollectionName(session);
            let packageDetails = this.getPackageDetails(session);
            let vehicleDisplayName = this.getVehicleDisplayName(session.vehicle_type);

            const confirmationText = `You have made an excellent decision in preserving your investment. Here is the summary of your commission:\n\n✅ **Treatment:** UNLAYR ${collectionName}\n✅ **Service:** ${packageDetails}\n✅ **Vehicle:** ${vehicleDisplayName}\n✅ **Total Investment:** ${this.formatPrice(totalPrice)}\n✅ **Scheduled:** ${session.preferred_date} at ${session.preferred_time}\n\nTo reserve your dedicated application team and materials, we request a nominal token of 20% to confirm your appointment.`;

            return {
                text: confirmationText,
                buttons: [
                    'Secure My Appointment',
                    'Expert Consultation',
                    'Modify Commission'
                ]
            };
        }

        const normalizedMessage = message.toLowerCase();
        
        if (normalizedMessage.includes('secure my appointment') || normalizedMessage.includes('secure')) {
            return this.handlePaymentFlow(session);
        } else if (normalizedMessage.includes('expert') || normalizedMessage.includes('consultation')) {
            return this.handleExpertRequest(session);
        } else if (normalizedMessage.includes('modify') || normalizedMessage.includes('change')) {
            // Reset session and start over
            session.step = 'initial';
            return this.handleInitialTrigger(session);
        } else {
            return {
                text: `Please choose one of the options to proceed:`,
                buttons: [
                    'Secure My Appointment',
                    'Expert Consultation',
                    'Modify Commission'
                ]
            };
        }
    }

    // Updated handlePaymentFlow method
    handlePaymentFlow(session) {
        // Calculate total investment for deposit
        let totalPrice = this.calculateTotalPrice(session);
        let collectionName = this.getCollectionName(session);
        let packageDetails = this.getPackageDetails(session);
        let vehicleDisplayName = this.getVehicleDisplayName(session.vehicle_type);

        return {
            text: `✅ **Your appointment is confirmed.** You have taken the definitive step in automotive preservation.\n\n**Your Commission Summary:**\n• Treatment: UNLAYR ${collectionName}\n• Service: ${packageDetails}\n• Vehicle: ${vehicleDisplayName}\n• Total Investment: ${this.formatPrice(totalPrice)}\n• Scheduled: ${session.preferred_date} at ${session.preferred_time}\n\nTo ensure the meticulous results UNLAYR is known for, a Senior Expert will call you shortly for a pre-treatment consultation and to conduct a quick digital vehicle assessment.\n\n**Complete Your Booking:** Visit our website to finalize your date/time selection and pay the advance amount (${this.formatPrice(Math.round(totalPrice * 0.2))}).\n\n**Visit: https://unlayr.com/ to complete your booking**`,
            buttons: []
        };
    }

    handleExpertRequest(session) {
        session.expert_requested = true;
        this.saveToNavigationHistory(session, session.step);
        session.step = 'expert_contact';
        return {
            text: ` **Expert Consultation Available**\n\nOur Senior Protection Expert is ready to assist you with:\n\n• Detailed service consultation & technical specifications\n• Bespoke recommendations for your specific vehicle\n• Digital vehicle assessment coordination\n• Investment clarification & custom solutions\n• Personalized booking assistance\n\n**Contact Options:**\n\n **Call Us Directly:** +91-XXXX-XXXX-XXX\n(Available 10 AM - 7 PM, Mon-Sat)\n\n **Request Callback:** Our expert will call you within 15 minutes\n\n **Continue on Chat:** Proceed with standard booking process`,
            buttons: [
                'Request Expert Callback',
                'Continue Chat Booking',
                '⬅️ Previous',
                '🔄 Start Over'
            ]
        };
    }

    handleExpertContact(message, session) {
        const normalizedMessage = message.toLowerCase();
        
        if (normalizedMessage.includes('request expert callback') || normalizedMessage.includes('callback')) {
            return {
                text: ` **Callback Scheduled**\n\nThank you! Our Senior Protection Expert will call you within the next 15 minutes to discuss your requirements in detail.\n\nPlease ensure your phone is available at the number you contacted us from.\n\n**What to expect in the call:**\n• Personalized service recommendations\n• Technical specifications discussion\n• Digital vehicle assessment arrangement\n• Custom pricing (if applicable)\n• Booking confirmation with preferred slots\n\nOur expert will handle everything from here to ensure you receive the perfect UNLAYR experience.`,
                buttons: ['🔄 Start Over']
            };
        } else if (normalizedMessage.includes('continue chat') || normalizedMessage.includes('chat booking')) {
            // Proceed to simplified booking confirmation without date/time selection
            if (session.user_service_type && session.vehicle_type && session.selected_package && session.user_location) {
                return this.handleSimplifiedConfirmation(session);
            } else {
                // If missing information, go back to appropriate step
                if (!session.user_service_type) {
                    session.step = 'service_selection';
                    return this.handleServiceSelection('', session);
                } else if (!session.vehicle_type) {
                    session.step = 'vehicle_selection';
                    return this.handleVehicleSelection('', session);
                } else if (!session.selected_package) {
                    // Go back to package selection based on service type
                    if (session.user_service_type === 'PPF') {
                        session.step = 'ppf_package_selection';
                        return this.handlePPFPackageSelection('', session);
                    } else if (session.user_service_type === 'Graphene') {
                        session.step = 'graphene_package_selection';
                        return this.handleGraphenePackageSelection('', session);
                    } else if (session.user_service_type === 'Ceramic') {
                        session.step = 'ceramic_duration_selection';
                        return this.handleCeramicDurationSelection('', session);
                    }
                } else if (!session.user_location) {
                    session.step = 'location_input';
                    return this.handleLocationInput('', session);
                }
            }
        } else {
            return {
                text: `Please choose how you'd like to proceed:`,
                buttons: [
                    'Request Expert Callback',
                    'Continue Chat Booking',
                    '⬅️ Previous',
                    '🔄 Start Over'
                ]
            };
        }
    }

    handleSimplifiedConfirmation(session) {
        // Calculate total investment
        let totalPrice = this.calculateTotalPrice(session);
        let collectionName = this.getCollectionName(session);
        let packageDetails = this.getPackageDetails(session);
        let vehicleDisplayName = this.getVehicleDisplayName(session.vehicle_type);

        const confirmationText = `**Booking Confirmation**\n\n✅ **Treatment:** UNLAYR ${collectionName}\n✅ **Service:** ${packageDetails}\n✅ **Vehicle:** ${vehicleDisplayName}\n✅ **Location:** ${session.user_location}\n✅ **Total Investment:** ${this.formatPrice(totalPrice)}\n\nOur team will contact you within 24 hours to coordinate the perfect timing for your appointment and arrange the 20% booking deposit.`;

        this.saveToNavigationHistory(session, session.step);
        session.step = 'simplified_confirmation';
        return {
            text: confirmationText,
            buttons: [
                'Confirm Booking',
                'Request Expert Call',
                'Modify Details',
                '⬅️ Previous',
                '🔄 Start Over'
            ]
        };
    }

    handleSimplifiedConfirmationResponse(message, session) {
        const normalizedMessage = message.toLowerCase();
        
        if (normalizedMessage.includes('confirm booking') || normalizedMessage.includes('confirm')) {
            return {
                text: `🎉 **Booking Confirmed!**\n\nThank you for choosing UNLAYR! Your booking has been confirmed.\n\n**Next Steps:**\n• Our team will call you within 24 hours\n• We'll coordinate the perfect timing for your appointment\n• Payment details and scheduling will be finalized during the call\n\n**Contact Information:**\n📞 Direct Line: +91-XXXX-XXXX-XXX\n📧 Email: info@unlayr.com\n🌐 Website: https://unlayr.com/\n\nWe look forward to providing you with the ultimate UNLAYR experience!`,
                buttons: ['🔄 Start Over']
            };
        } else if (normalizedMessage.includes('expert') || normalizedMessage.includes('call')) {
            return this.handleExpertRequest(session);
        } else if (normalizedMessage.includes('modify') || normalizedMessage.includes('details')) {
            // Reset session and start over
            session.step = 'initial';
            return this.handleInitialTrigger(session);
        } else {
            return {
                text: `Please choose one of the options to proceed:`,
                buttons: [
                    'Confirm Booking',
                    'Request Expert Call',
                    'Modify Details',
                    '⬅️ Previous',
                    '🔄 Start Over'
                ]
            };
        }
    }

    // Updated calculateTotalPrice method
    calculateTotalPrice(session) {
        let totalPrice = 0;
        if (session.user_service_type === 'PPF') {
            let coverage = session.ppf_coverage_type;
            if (coverage === 'exterior' && session.ppf_interior_addon) {
                coverage = 'both';
            }
            if (coverage === 'interior') {
                totalPrice = this.pricing.ppf.interior[session.selected_package];
            } else if (coverage === 'both') {
                totalPrice = this.pricing.ppf.both[session.vehicle_type][session.selected_package];
            } else {
                totalPrice = this.pricing.ppf.exterior[session.vehicle_type][session.selected_package];
            }
        } else if (session.user_service_type === 'Ceramic') {
            totalPrice = this.pricing.ceramic[session.vehicle_type][session.protection_duration];
        } else if (session.user_service_type === 'Graphene') {
            totalPrice = this.pricing.graphene[session.selected_package][session.vehicle_type];
        }
        return totalPrice;
    }

    getPackageName(session) {
        if (session.user_service_type === 'PPF') {
            return session.selected_package.toUpperCase() + ' Collection';
        } else if (session.user_service_type === 'Graphene') {
            return session.selected_package.toUpperCase() + ' Package';
        } else if (session.user_service_type === 'Ceramic') {
            return session.protection_duration.replace('yr', '-Year') + ' Care Program';
        }
        return '';
    }

    getCollectionName(session) {
        return this.getPackageName(session);
    }

    getPackageDetails(session) {
        if (session.user_service_type === 'PPF') {
            let coverage = session.ppf_coverage_type;
            if (coverage === 'exterior' && session.ppf_interior_addon) {
                coverage = 'both';
            }
            return `Advanced Pre-Cut PPF - ${coverage.charAt(0).toUpperCase() + coverage.slice(1)}`;
        } else if (session.user_service_type === 'Ceramic') {
            return 'Signature Ceramic Coating';
        } else if (session.user_service_type === 'Graphene') {
            return 'Graphene-Infused Coating';
        }
        return '';
    }

    getVehicleDisplayName(vehicleType) {
        return {
            compact: 'Compact SUV/Sedan (e.g., Creta, Seltos)',
            large_suv: 'Full-Size SUV / MUV (e.g., Fortuner, Safari)',
            luxury: 'Luxury Class (e.g., BMW, Mercedes, Audi)',
            bike: 'Bike/Superbike'
        }[vehicleType];
    }

    handleUnknownInput(session) {
        return {
            text: `I didn't quite understand that. Allow me to assist you:\n\n• Use the provided buttons for guidance\n• Type 'Expert' for specialist consultation  \n• Type 'menu' to explore all options\n• Type 'previous' to go back\n• Type 'start over' to restart\n\nHow may I better serve you?`,
            buttons: ['Expert Consultation', 'Menu', 'Previous', 'Start Over']
        };
    }

    // Navigation helper methods
    handleStartOver(session) {
        // Clear all session data except conversation history
        const conversationHistory = session.conversation_history;
        Object.keys(session).forEach(key => {
            if (key !== 'conversation_history') {
                session[key] = null;
            }
        });
        
        // Reset to initial state
        session.step = 'initial';
        session.user_service_type = null;
        session.vehicle_type = null;
        session.ppf_coverage_type = null;
        session.selected_package = null;
        session.protection_duration = null;
        session.user_location = null;
        session.preferred_date = null;
        session.preferred_time = null;
        session.ppf_interior_addon = false;
        session.expert_requested = false;
        session.navigation_history = [];
        session.previous_step_data = {};
        session.conversation_history = conversationHistory;

        return this.handleInitialTrigger(session);
    }

    handlePrevious(session) {
        if (session.navigation_history.length === 0) {
            return {
                text: `You're at the beginning of our conversation. There's no previous step to go back to.\n\nWould you like to start over or continue?`,
                buttons: ['Start Over', 'Continue', 'Expert Consultation']
            };
        }

        // Get the previous step
        const previousStep = session.navigation_history.pop();
        
        // Restore previous step data if available
        if (session.previous_step_data[previousStep]) {
            const previousData = session.previous_step_data[previousStep];
            Object.keys(previousData).forEach(key => {
                session[key] = previousData[key];
            });
        }

        // Set the step and handle it
        session.step = previousStep;
        
        // Route to appropriate handler based on previous step
        switch (previousStep) {
            case 'service_selection':
                return this.handleInitialTrigger(session);
            case 'vehicle_selection':
                return this.handleVehicleSelection('', session);
            case 'ppf_coverage_selection':
                return this.handlePPFCoverageSelection('', session);
            case 'ppf_package_selection':
                return this.handlePPFPackageSelection('', session);
            case 'ppf_interior_upsell':
                return this.handlePPFInteriorUpsell('', session);
            case 'graphene_package_selection':
                return this.handleGraphenePackageSelection('', session);
            case 'ceramic_duration_selection':
                return this.handleCeramicDurationSelection('', session);
            case 'location_input':
                return this.handleLocationInput('', session);
            case 'expert_contact':
                return this.handleExpertContact('', session);
            case 'simplified_confirmation':
                return this.handleSimplifiedConfirmation(session);
            default:
                return this.handleInitialTrigger(session);
        }
    }

    // Helper method to save current step to navigation history
    saveToNavigationHistory(session, currentStep) {
        // Don't save the same step twice in a row
        if (session.navigation_history.length === 0 || 
            session.navigation_history[session.navigation_history.length - 1] !== currentStep) {
            
            // Save current session state before moving to next step
            session.previous_step_data[currentStep] = {
                user_service_type: session.user_service_type,
                vehicle_type: session.vehicle_type,
                ppf_coverage_type: session.ppf_coverage_type,
                selected_package: session.selected_package,
                protection_duration: session.protection_duration,
                user_location: session.user_location,
                preferred_date: session.preferred_date,
                preferred_time: session.preferred_time,
                ppf_interior_addon: session.ppf_interior_addon,
                expert_requested: session.expert_requested
            };
            
            session.navigation_history.push(currentStep);
            
            // Keep only last 10 steps to prevent memory issues
            if (session.navigation_history.length > 10) {
                const removedStep = session.navigation_history.shift();
                delete session.previous_step_data[removedStep];
            }
        }
    }
}

module.exports = WhatsAppCarProtectionBot;